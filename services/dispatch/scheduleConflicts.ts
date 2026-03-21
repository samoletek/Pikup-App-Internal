import { appConfig } from '../../config/appConfig';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type TripLike = Record<string, any>;

const parseEnvNumber = (
  value: unknown,
  fallback: number,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
};

const OVERLAP_MIN_DURATION_MINUTES = parseEnvNumber(
  appConfig.dispatch.overlapMinDurationMinutes,
  25,
  { min: 5, max: 24 * 60 }
);

const OVERLAP_BASE_SERVICE_MINUTES = parseEnvNumber(
  appConfig.dispatch.overlapBaseServiceMinutes,
  15,
  { min: 0, max: 12 * 60 }
);

const OVERLAP_AVERAGE_SPEED_MPH = parseEnvNumber(
  appConfig.dispatch.overlapAverageSpeedMph,
  22,
  { min: 5, max: 120 }
);

const OVERLAP_INTER_TRIP_BUFFER_MINUTES = parseEnvNumber(
  appConfig.dispatch.overlapInterTripBufferMinutes,
  10,
  { min: 0, max: 4 * 60 }
);

const DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS = new Set([
  'accepted',
  'in_progress',
  'inprogress',
  'arrived_at_pickup',
  'arrivedatpickup',
  'picked_up',
  'pickedup',
  'en_route_to_dropoff',
  'enroutetodropoff',
  'arrived_at_dropoff',
  'arrivedatdropoff',
]);

const normalizeCoordinates = (value: unknown): Coordinate | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  const latitude = Number(source.latitude);
  const longitude = Number(source.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMilesBetweenPoints = (
  first: Coordinate | null,
  second: Coordinate | null
): number => {
  if (!first || !second) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMiles = 3959;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLng = toRadians(second.longitude - first.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
};

const getPickupCoordinates = (trip: TripLike): Coordinate | null =>
  normalizeCoordinates(trip?.pickup?.coordinates);

const getDropoffCoordinates = (trip: TripLike): Coordinate | null =>
  normalizeCoordinates(trip?.dropoff?.coordinates);

const toPositiveNumber = (value: unknown): number => {
  const normalizedValue = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const parsedNumber = Number(normalizedValue);
  if (Number.isFinite(parsedNumber) && parsedNumber > 0) {
    return parsedNumber;
  }

  if (typeof normalizedValue === 'string') {
    const fallbackMatch = normalizedValue.match(/-?\d+(?:\.\d+)?/);
    const fallbackNumber = fallbackMatch?.[0] ? Number(fallbackMatch[0]) : Number.NaN;
    if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) {
      return fallbackNumber;
    }
  }

  return Number.NaN;
};

const normalizeStatusToken = (statusValue: unknown): string =>
  String(statusValue || '').trim().toLowerCase();

const isDriverScheduleBlockingStatus = (statusValue: unknown): boolean => {
  const statusToken = normalizeStatusToken(statusValue);
  return (
    DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS.has(statusToken) ||
    DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS.has(statusToken.replace(/_/g, ''))
  );
};

const resolveTripDistanceMiles = (trip: TripLike): number => {
  const candidates = [
    trip?.dispatchRequirements?.estimatedDistanceMiles,
    trip?.dispatch_requirements?.estimatedDistanceMiles,
    trip?.pricing?.distanceMiles,
    trip?.pricing?.distance_miles,
    trip?.pricing?.distance,
    trip?.distance,
    trip?.distance_miles,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const resolveTripDurationMinutes = (trip: TripLike): number => {
  const candidates = [
    trip?.dispatchRequirements?.estimatedDurationMinutes,
    trip?.dispatch_requirements?.estimatedDurationMinutes,
    trip?.pricing?.durationMinutes,
    trip?.pricing?.duration_minutes,
    trip?.pricing?.duration,
    trip?.pricing?.timeMinutes,
    trip?.pricing?.time_minutes,
    trip?.pricing?.time,
    trip?.durationMinutes,
    trip?.duration_minutes,
    trip?.duration,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

const resolveEstimatedTripDurationMinutes = (trip: TripLike): number => {
  const directDurationMinutes = resolveTripDurationMinutes(trip);
  const distanceMiles = resolveTripDistanceMiles(trip);
  const distanceEstimatedMinutes =
    distanceMiles > 0
      ? (distanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60 + OVERLAP_BASE_SERVICE_MINUTES
      : Number.NaN;

  const fallbackDuration = Number.isFinite(distanceEstimatedMinutes)
    ? Math.max(OVERLAP_MIN_DURATION_MINUTES, distanceEstimatedMinutes)
    : OVERLAP_MIN_DURATION_MINUTES;

  if (Number.isFinite(directDurationMinutes)) {
    return Math.max(fallbackDuration, directDurationMinutes);
  }

  return fallbackDuration;
};

const resolveScheduledStartMs = (trip: TripLike): number => {
  const scheduledTime =
    trip?.dispatchRequirements?.scheduledTime ||
    trip?.dispatch_requirements?.scheduledTime ||
    trip?.scheduledTime ||
    trip?.scheduled_time ||
    null;
  const parsed = scheduledTime ? new Date(scheduledTime).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const estimateInterTripTransferMinutes = (
  fromTrip: TripLike,
  toTrip: TripLike
): number => {
  const fromDropoffCoordinates = getDropoffCoordinates(fromTrip);
  const toPickupCoordinates = getPickupCoordinates(toTrip);
  const transferDistanceMiles = distanceMilesBetweenPoints(
    fromDropoffCoordinates,
    toPickupCoordinates
  );

  if (!Number.isFinite(transferDistanceMiles)) {
    return OVERLAP_INTER_TRIP_BUFFER_MINUTES;
  }

  const travelMinutes = (transferDistanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60;
  return Math.max(OVERLAP_INTER_TRIP_BUFFER_MINUTES, travelMinutes);
};

const resolveTripWindow = ({
  trip,
  nowMs,
  driverLocation,
  isAssignedTrip = false,
}: {
  trip: TripLike;
  nowMs: number;
  driverLocation: Coordinate | null;
  isAssignedTrip?: boolean;
}) => {
  const scheduledStartMs = resolveScheduledStartMs(trip);
  const hasFutureSchedule = Number.isFinite(scheduledStartMs) && scheduledStartMs > nowMs;
  const pickupCoordinates = getPickupCoordinates(trip);
  const approachDistanceMiles = distanceMilesBetweenPoints(driverLocation, pickupCoordinates);
  const approachMinutes = Number.isFinite(approachDistanceMiles)
    ? (approachDistanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60
    : 0;

  let startMs = hasFutureSchedule
    ? scheduledStartMs
    : nowMs + Math.max(0, Math.round(approachMinutes)) * 60 * 1000;

  if (isAssignedTrip && isDriverScheduleBlockingStatus(trip?.status) && !hasFutureSchedule) {
    startMs = nowMs;
  }

  if (!Number.isFinite(startMs)) {
    startMs = nowMs;
  }

  const durationMinutes = resolveEstimatedTripDurationMinutes(trip);
  const endMs = startMs + Math.max(OVERLAP_MIN_DURATION_MINUTES, durationMinutes) * 60 * 1000;

  return { startMs, endMs };
};

export const findDriverScheduleConflictForTrip = ({
  candidateTrip,
  assignedTrips,
  driverLocation = null,
  nowDate = new Date(),
}: {
  candidateTrip: TripLike | null;
  assignedTrips: TripLike[];
  driverLocation?: Coordinate | null;
  nowDate?: Date;
}): TripLike | null => {
  const normalizedAssignedTrips = Array.isArray(assignedTrips) ? assignedTrips : [];
  if (!candidateTrip || normalizedAssignedTrips.length === 0) {
    return null;
  }

  const nowMs = nowDate.getTime();
  const candidateWindow = resolveTripWindow({
    trip: candidateTrip,
    nowMs,
    driverLocation,
    isAssignedTrip: false,
  });

  return (
    normalizedAssignedTrips.find((assignedTrip) => {
      if (!assignedTrip) {
        return false;
      }

      const candidateId = String(candidateTrip?.id || '').trim();
      const assignedId = String(assignedTrip?.id || '').trim();
      if (candidateId && assignedId && candidateId === assignedId) {
        return false;
      }

      if (!isDriverScheduleBlockingStatus(assignedTrip?.status)) {
        return false;
      }

      const assignedWindow = resolveTripWindow({
        trip: assignedTrip,
        nowMs,
        driverLocation,
        isAssignedTrip: true,
      });

      if (candidateWindow.startMs >= assignedWindow.startMs) {
        const transferMinutes = estimateInterTripTransferMinutes(assignedTrip, candidateTrip);
        return assignedWindow.endMs + transferMinutes * 60 * 1000 > candidateWindow.startMs;
      }

      const transferMinutes = estimateInterTripTransferMinutes(candidateTrip, assignedTrip);
      return candidateWindow.endMs + transferMinutes * 60 * 1000 > assignedWindow.startMs;
    }) || null
  );
};
