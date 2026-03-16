import { DROPOFF_PHASE_STATUSES, PICKUP_PHASE_STATUSES, TRIP_STATUS } from '../../constants/tripStatus';
import { getDistanceFromLatLonInKm } from './navigationMath.utils';
import { logger } from '../../services/logger';

const FALLBACK_DRIVER_DESTINATION = {
  latitude: 33.7540,
  longitude: -84.3830,
};

function parseCoordinates(coords) {
  if (!coords) {
    return null;
  }

  if (typeof coords === 'object' && coords.latitude && coords.longitude) {
    return coords;
  }

  if (typeof coords === 'string') {
    try {
      const parsed = JSON.parse(coords);
      if (parsed.latitude && parsed.longitude) {
        return parsed;
      }
    } catch (error) {
      logger.error('NavigationRouteUtils', 'Failed to parse coordinates', error);
    }
  }

  return null;
}

function toLatLng(coords) {
  if (!coords) {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

export function extractDestinationFromStatus(requestData) {
  if (!requestData) {
    return null;
  }

  if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
    return requestData.pickup?.coordinates || null;
  }

  return requestData.dropoff?.coordinates || null;
}

export function extractCustomerLocationFromRequest({ requestData, routeRequest, driverLocation }) {
  if (requestData) {
    if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
      const coords = parseCoordinates(requestData.pickup?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using pickup coordinates from requestData', coords);
        return toLatLng(coords);
      }
    } else if (DROPOFF_PHASE_STATUSES.includes(requestData.status)) {
      const coords = parseCoordinates(requestData.dropoff?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using dropoff coordinates from requestData', coords);
        return toLatLng(coords);
      }
    }
  }

  if (routeRequest) {
    const status = routeRequest.status || requestData?.status || TRIP_STATUS.ACCEPTED;
    if (PICKUP_PHASE_STATUSES.includes(status)) {
      const coords = parseCoordinates(routeRequest.pickup?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using pickup coordinates from route params', coords);
        return toLatLng(coords);
      }
    } else if (DROPOFF_PHASE_STATUSES.includes(status)) {
      const coords = parseCoordinates(routeRequest.dropoff?.coordinates);
      if (coords) {
        logger.debug('NavigationRouteUtils', 'Using dropoff coordinates from route params', coords);
        return toLatLng(coords);
      }
    }
  }

  logger.warn('NavigationRouteUtils', 'No valid customer location found, using fallback location');

  if (driverLocation) {
    return {
      latitude: driverLocation.latitude + 0.005,
      longitude: driverLocation.longitude + 0.003,
    };
  }

  return { ...FALLBACK_DRIVER_DESTINATION };
}

export function calculateDistanceAndEta(driverCoords, customerCoords) {
  const distanceInKm = getDistanceFromLatLonInKm(
    driverCoords.latitude,
    driverCoords.longitude,
    customerCoords.latitude,
    customerCoords.longitude
  );

  const distanceText =
    distanceInKm < 1
      ? `${Math.round(distanceInKm * 1000)} m`
      : `${distanceInKm.toFixed(1)} km`;

  const timeInMinutes = Math.ceil((distanceInKm / 30) * 60);
  const etaText = timeInMinutes < 1 ? '<1 min' : `${timeInMinutes} min`;

  return {
    distanceText,
    etaText,
  };
}

export function generateFallbackRoute(start, end) {
  return [start, end];
}
