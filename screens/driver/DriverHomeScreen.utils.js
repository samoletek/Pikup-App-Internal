import { isDriverReadinessBypassEnabled } from '../../config/appConfig';

export const DEFAULT_REQUEST_TIMER_SECONDS = 180;

export const REQUEST_POOLS = Object.freeze({
  ASAP: 'asap',
  SCHEDULED: 'scheduled',
});

export const MIN_MOVE_METERS = 100;

export const shouldBypassDriverReadiness = (user) => {
  return isDriverReadinessBypassEnabled(user);
};

export const ACTIVE_TRIP_STATUS_LABELS = Object.freeze({
  accepted: 'Driver confirmed',
  inProgress: 'On the way to pickup',
  arrivedAtPickup: 'Arrived at pickup',
  pickedUp: 'Package collected',
  enRouteToDropoff: 'On the way to destination',
  arrivedAtDropoff: 'Arrived at destination',
});

export const resolveRequestOfferExpiry = (request) => {
  const rawExpiry = request?.expiresAt || request?.dispatchOffer?.expiresAt;
  if (!rawExpiry) {
    return null;
  }

  const parsedExpiry = new Date(rawExpiry).getTime();
  return Number.isFinite(parsedExpiry) ? parsedExpiry : null;
};

const hasValidCoordinate = (coords) =>
  Number.isFinite(Number(coords?.longitude)) && Number.isFinite(Number(coords?.latitude));

export const fetchIncomingRouteData = async ({ request, mapboxToken, fetchImpl = fetch }) => {
  const pickupCoords = request?.pickup?.coordinates;
  const dropoffCoords = request?.dropoff?.coordinates;

  if (!hasValidCoordinate(pickupCoords) || !hasValidCoordinate(dropoffCoords) || !mapboxToken) {
    return null;
  }

  const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords.longitude},${pickupCoords.latitude};${dropoffCoords.longitude},${dropoffCoords.latitude}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
  const response = await fetchImpl(directionsUrl);
  const payload = await response.json();

  if (!Array.isArray(payload?.routes) || payload.routes.length === 0 || !payload.routes[0]?.geometry) {
    return null;
  }

  return {
    route: {
      type: 'Feature',
      properties: {},
      geometry: payload.routes[0].geometry,
    },
    markers: {
      pickup: [pickupCoords.longitude, pickupCoords.latitude],
      dropoff: [dropoffCoords.longitude, dropoffCoords.latitude],
    },
  };
};

export const formatRequestTime = (seconds) => {
  const normalizedSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(normalizedSeconds / 60)}:${(normalizedSeconds % 60).toString().padStart(2, '0')}`;
};

export const isUnavailableAcceptError = (error) => {
  if (!error) return false;
  if (error?.code === 'REQUEST_UNAVAILABLE') return true;

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('no longer pending') ||
    message.includes('no longer available') ||
    message.includes('already accepted') ||
    message.includes('accepted by another driver')
  );
};

const calculateDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMiles = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
};

export const movedEnough = (prev, next, minMoveMeters = MIN_MOVE_METERS) => {
  if (!prev) return true;
  const distanceMiles = calculateDistanceMiles(prev.latitude, prev.longitude, next.latitude, next.longitude);
  const distanceMeters = distanceMiles * 1609.34;
  return distanceMeters >= minMoveMeters;
};
