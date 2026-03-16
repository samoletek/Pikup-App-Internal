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
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)} m`;
  }
  return `${(distanceInMeters / 1000).toFixed(1)} km`;
};

export const getManeuverIcon = (maneuverType) => {
  const iconMap = {
    "turn-right": "turn-sharp-right",
    "turn-left": "turn-sharp-left",
    "turn-slight-right": "trending-up",
    "turn-slight-left": "trending-up",
    continue: "arrow-up",
    straight: "arrow-up",
    uturn: "return-up-back",
    merge: "git-merge",
    "on-ramp": "arrow-up-right",
    "off-ramp": "arrow-down-right",
    roundabout: "refresh",
    rotary: "refresh",
    "roundabout-turn": "refresh",
    notification: "flag",
    depart: "play",
    arrive: "flag-checkered",
  };

  return iconMap[maneuverType] || "arrow-up";
};
