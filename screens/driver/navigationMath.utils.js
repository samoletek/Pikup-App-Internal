export const ARRIVAL_UNLOCK_RADIUS_METERS = 30;
const FEET_PER_METER = 3.28084;
const METERS_PER_MILE = 1609.344;
const MIN_MOVEMENT_HEADING_METERS = 4;
const MIN_MOVEMENT_SPEED_MPS = 1.5;
const DEFAULT_HEADING_SMOOTHING = 0.3;
const FAST_HEADING_SMOOTHING = 0.55;
const LARGE_HEADING_DELTA_DEGREES = 35;

export const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const toRadians = (deg) => {
  return deg * (Math.PI / 180);
};

const toDegrees = (radians) => {
  return radians * (180 / Math.PI);
};

export const formatDistance = (distanceInMeters) => {
  const normalizedDistanceMeters = Number(distanceInMeters);
  if (!Number.isFinite(normalizedDistanceMeters) || normalizedDistanceMeters < 0) {
    return 'Calculating...';
  }

  const feet = normalizedDistanceMeters * FEET_PER_METER;
  if (feet < 1000) {
    return `${Math.round(feet)} ft`;
  }

  const miles = normalizedDistanceMeters / METERS_PER_MILE;
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
};

export const normalizeHeading = (heading) => {
  const normalizedHeading = Number(heading);
  if (!Number.isFinite(normalizedHeading)) {
    return null;
  }

  const boundedHeading = ((normalizedHeading % 360) + 360) % 360;
  return Number.isFinite(boundedHeading) ? boundedHeading : null;
};

export const calculateBearing = (start, end) => {
  const startLatitude = Number(start?.latitude);
  const startLongitude = Number(start?.longitude);
  const endLatitude = Number(end?.latitude);
  const endLongitude = Number(end?.longitude);

  if (
    !Number.isFinite(startLatitude) ||
    !Number.isFinite(startLongitude) ||
    !Number.isFinite(endLatitude) ||
    !Number.isFinite(endLongitude)
  ) {
    return null;
  }

  const latitude1 = toRadians(startLatitude);
  const latitude2 = toRadians(endLatitude);
  const deltaLongitude = toRadians(endLongitude - startLongitude);

  const y = Math.sin(deltaLongitude) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude);

  return normalizeHeading(toDegrees(Math.atan2(y, x)));
};

export const interpolateHeading = (fromHeading, toHeading, factor = DEFAULT_HEADING_SMOOTHING) => {
  const normalizedFrom = normalizeHeading(fromHeading);
  const normalizedTo = normalizeHeading(toHeading);

  if (normalizedTo === null) {
    return normalizedFrom ?? 0;
  }
  if (normalizedFrom === null) {
    return normalizedTo;
  }

  const delta = ((normalizedTo - normalizedFrom + 540) % 360) - 180;
  if (Math.abs(delta) < 1) {
    return normalizedTo;
  }

  const clampedFactor = Math.max(0, Math.min(1, factor));
  return normalizeHeading(normalizedFrom + (delta * clampedFactor)) ?? normalizedTo;
};

export const resolveNavigationHeading = ({
  previousLocation,
  nextLocation,
  nativeHeading,
  currentHeading,
  speedMetersPerSecond = 0,
}) => {
  const normalizedCurrentHeading = normalizeHeading(currentHeading);
  const normalizedNativeHeading = normalizeHeading(nativeHeading);
  const speed = Number(speedMetersPerSecond);
  const movementDistanceMeters =
    previousLocation && nextLocation
      ? getDistanceFromLatLonInKm(
          previousLocation.latitude,
          previousLocation.longitude,
          nextLocation.latitude,
          nextLocation.longitude
        ) * 1000
      : null;
  const movementHeading =
    Number.isFinite(movementDistanceMeters) && movementDistanceMeters >= MIN_MOVEMENT_HEADING_METERS
      ? calculateBearing(previousLocation, nextLocation)
      : null;

  let targetHeading = normalizedNativeHeading;
  if (
    movementHeading !== null &&
    (
      !Number.isFinite(speed) ||
      speed >= MIN_MOVEMENT_SPEED_MPS ||
      normalizedNativeHeading === null
    )
  ) {
    targetHeading = movementHeading;
  }

  if (targetHeading === null) {
    return normalizedCurrentHeading ?? 0;
  }

  const current = normalizedCurrentHeading ?? targetHeading;
  const delta = ((targetHeading - current + 540) % 360) - 180;
  const smoothingFactor =
    Math.abs(delta) >= LARGE_HEADING_DELTA_DEGREES
      ? FAST_HEADING_SMOOTHING
      : DEFAULT_HEADING_SMOOTHING;

  return interpolateHeading(current, targetHeading, smoothingFactor);
};

const resolveTurnLikeIcon = (modifier = '') => {
  const normalizedModifier = String(modifier || '').toLowerCase();

  if (normalizedModifier.includes('uturn') || normalizedModifier.includes('u-turn')) {
    return 'return-up-back';
  }
  if (normalizedModifier.includes('left')) {
    return 'arrow-back';
  }
  if (normalizedModifier.includes('right')) {
    return 'arrow-forward';
  }

  return 'arrow-up';
};

export const normalizeManeuverType = (maneuverType) => {
  return String(maneuverType || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
};

export const getManeuverIcon = (maneuverType, maneuverModifier = '') => {
  const normalizedType = normalizeManeuverType(maneuverType);

  if (
    normalizedType === 'turn' ||
    normalizedType === 'fork' ||
    normalizedType === 'merge' ||
    normalizedType === 'on-ramp' ||
    normalizedType === 'off-ramp'
  ) {
    return resolveTurnLikeIcon(maneuverModifier);
  }

  if (normalizedType === 'new-name') {
    return 'arrow-up';
  }

  const iconMap = {
    continue: 'arrow-up',
    straight: 'arrow-up',
    uturn: 'return-up-back',
    roundabout: 'refresh',
    rotary: 'refresh',
    'roundabout-turn': 'refresh',
    notification: 'arrow-up',
    depart: 'arrow-up',
    arrive: 'flag',
    end: 'flag',
  };

  return iconMap[normalizedType] || resolveTurnLikeIcon(maneuverModifier);
};
