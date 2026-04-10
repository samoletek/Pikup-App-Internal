export const ARRIVAL_UNLOCK_RADIUS_METERS = 50;
export const DROPOFF_ARRIVAL_UNLOCK_RADIUS_METERS = 50;
const FEET_PER_METER = 3.28084;
const METERS_PER_MILE = 1609.344;

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

export const getManeuverIcon = (maneuverType, maneuverModifier = '') => {
  const normalizedType = String(maneuverType || '').toLowerCase();

  if (normalizedType === 'turn' || normalizedType === 'fork') {
    return resolveTurnLikeIcon(maneuverModifier);
  }

  if (normalizedType === 'new name') {
    return 'arrow-up';
  }

  const iconMap = {
    continue: 'arrow-up',
    straight: 'arrow-up',
    uturn: 'return-up-back',
    merge: 'git-merge',
    'on-ramp': 'arrow-up-right',
    'off-ramp': 'arrow-down-right',
    roundabout: 'refresh',
    rotary: 'refresh',
    'roundabout-turn': 'refresh',
    notification: 'flag',
    depart: 'play',
    arrive: 'flag-checkered',
    end: 'flag-checkered',
  };

  return iconMap[normalizedType] || resolveTurnLikeIcon(maneuverModifier);
};
