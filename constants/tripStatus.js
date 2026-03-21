export const TRIP_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'inProgress',
  ARRIVED_AT_PICKUP: 'arrivedAtPickup',
  PICKED_UP: 'pickedUp',
  EN_ROUTE_TO_DROPOFF: 'enRouteToDropoff',
  ARRIVED_AT_DROPOFF: 'arrivedAtDropoff',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
});

const STATUS_TO_DB_MAP = Object.freeze({
  [TRIP_STATUS.PENDING]: 'pending',
  [TRIP_STATUS.ACCEPTED]: 'accepted',
  [TRIP_STATUS.IN_PROGRESS]: 'in_progress',
  [TRIP_STATUS.ARRIVED_AT_PICKUP]: 'arrived_at_pickup',
  [TRIP_STATUS.PICKED_UP]: 'picked_up',
  [TRIP_STATUS.EN_ROUTE_TO_DROPOFF]: 'en_route_to_dropoff',
  [TRIP_STATUS.ARRIVED_AT_DROPOFF]: 'arrived_at_dropoff',
  [TRIP_STATUS.COMPLETED]: 'completed',
  [TRIP_STATUS.CANCELLED]: 'cancelled',
});

const STATUS_ALIAS_MAP = Object.freeze({
  pending: TRIP_STATUS.PENDING,
  accepted: TRIP_STATUS.ACCEPTED,
  inProgress: TRIP_STATUS.IN_PROGRESS,
  in_progress: TRIP_STATUS.IN_PROGRESS,
  arrivedAtPickup: TRIP_STATUS.ARRIVED_AT_PICKUP,
  arrived_at_pickup: TRIP_STATUS.ARRIVED_AT_PICKUP,
  pickedUp: TRIP_STATUS.PICKED_UP,
  picked_up: TRIP_STATUS.PICKED_UP,
  enRouteToDropoff: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
  en_route_to_dropoff: TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
  arrivedAtDropoff: TRIP_STATUS.ARRIVED_AT_DROPOFF,
  arrived_at_dropoff: TRIP_STATUS.ARRIVED_AT_DROPOFF,
  completed: TRIP_STATUS.COMPLETED,
  delivered: TRIP_STATUS.COMPLETED,
  cancelled: TRIP_STATUS.CANCELLED
});

export const ACTIVE_TRIP_STATUSES = Object.freeze([
  TRIP_STATUS.ACCEPTED,
  TRIP_STATUS.IN_PROGRESS,
  TRIP_STATUS.ARRIVED_AT_PICKUP,
  TRIP_STATUS.PICKED_UP,
  TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
  TRIP_STATUS.ARRIVED_AT_DROPOFF
]);

export const PICKUP_PHASE_STATUSES = Object.freeze([
  TRIP_STATUS.ACCEPTED,
  TRIP_STATUS.IN_PROGRESS,
  TRIP_STATUS.ARRIVED_AT_PICKUP
]);

export const DROPOFF_PHASE_STATUSES = Object.freeze([
  TRIP_STATUS.PICKED_UP,
  TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
  TRIP_STATUS.ARRIVED_AT_DROPOFF
]);

export const normalizeTripStatus = (status) => {
  if (typeof status !== 'string') {
    return TRIP_STATUS.PENDING;
  }

  const normalized = status.trim();
  if (!normalized) {
    return TRIP_STATUS.PENDING;
  }

  return STATUS_ALIAS_MAP[normalized] || STATUS_ALIAS_MAP[normalized.toLowerCase()] || normalized;
};

export const toDbTripStatus = (status) => {
  const normalized = normalizeTripStatus(status);
  return STATUS_TO_DB_MAP[normalized] || normalized;
};

export const isActiveTripStatus = (status) => {
  const normalized = normalizeTripStatus(status);
  return ACTIVE_TRIP_STATUSES.includes(normalized);
};

export const getTripScheduledAtMs = (trip) => {
  const rawScheduledTime = trip?.scheduledTime || trip?.scheduled_time || null;
  if (!rawScheduledTime) {
    return Number.NaN;
  }

  return new Date(rawScheduledTime).getTime();
};

export const isFutureScheduledTrip = (trip, nowDate = new Date()) => {
  if (!trip) {
    return false;
  }

  const normalizedStatus = normalizeTripStatus(trip.status);
  if (normalizedStatus !== TRIP_STATUS.ACCEPTED && normalizedStatus !== TRIP_STATUS.PENDING) {
    return false;
  }

  const scheduledAtMs = getTripScheduledAtMs(trip);
  if (!Number.isFinite(scheduledAtMs)) {
    return false;
  }

  return scheduledAtMs > nowDate.getTime();
};
