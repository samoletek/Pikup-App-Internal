const toPositiveInteger = (value) => {
  const normalizedValue =
    typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.round(parsedValue);
};

const toValidDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ACTUAL_DURATION_START_FIELDS = Object.freeze([
  'pickedUpAt',
  'picked_up_at',
  'enRouteToDropoffAt',
  'en_route_to_dropoff_at',
  'arrivedAtPickupAt',
  'arrived_at_pickup_at',
  'inProgressAt',
  'in_progress_at',
]);

const ACTUAL_DURATION_END_FIELDS = Object.freeze([
  'completedAt',
  'completed_at',
]);

const resolveTimestampFromFields = (trip = {}, fields = []) => {
  for (const field of fields) {
    const date = toValidDate(trip?.[field]);
    if (date) {
      return date;
    }
  }

  return null;
};

export const resolveActualTripDurationMinutes = (trip = {}) => {
  const persistedDurationMinutes = [
    trip?.actualDurationMinutes,
    trip?.actual_duration_minutes,
    trip?.actualDuration,
    trip?.actual_duration,
  ]
    .map(toPositiveInteger)
    .find((value) => value !== null);

  if (persistedDurationMinutes !== undefined) {
    return persistedDurationMinutes;
  }

  const startedAt = resolveTimestampFromFields(trip, ACTUAL_DURATION_START_FIELDS);
  const completedAt = resolveTimestampFromFields(trip, ACTUAL_DURATION_END_FIELDS);
  if (!startedAt || !completedAt) {
    return null;
  }

  const durationMs = completedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  return Math.max(1, Math.ceil(durationMs / 60000));
};
