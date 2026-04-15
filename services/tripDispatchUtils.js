import { appConfig } from '../config/appConfig';
import { supabase } from '../config/supabase';
import { findDriverScheduleConflictForTrip } from './dispatch/scheduleConflicts';
import { invokeDriverRequestPool } from './repositories/tripRepository';
import { resolveDispatchRequirements } from './dispatch/requirements';

const parseEnvNumber = (value, fallback, { min = null, max = null } = {}) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    if (typeof min === 'number' && parsed < min) {
        return fallback;
    }
    if (typeof max === 'number' && parsed > max) {
        return fallback;
    }

    return parsed;
};

const parseEnvNumberList = (
  value,
  fallback = [],
  { min = null, max = null } = {}
) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number))
    .map((number) => Math.round(number))
    .filter((number) => (
      (typeof min !== 'number' || number >= min) &&
      (typeof max !== 'number' || number <= max)
    ));

  if (parsed.length === 0) {
    return fallback;
  }

  const deduped = [];
  parsed.forEach((number) => {
    if (!deduped.includes(number)) {
      deduped.push(number);
    }
  });

  return deduped.length > 0 ? deduped : fallback;
};

export const REQUEST_POOLS = Object.freeze({
    ALL: 'all',
    ASAP: 'asap',
    SCHEDULED: 'scheduled',
});

export const DRIVER_REQUEST_POOL_FUNCTION = 'get-driver-request-pool';

const DEFAULT_ASAP_DISPATCH_BATCH_RADII_MILES = Object.freeze([20, 40, 80, 100]);

export const ASAP_DISPATCH_BATCH_RADII_MILES = Object.freeze(
  parseEnvNumberList(
    appConfig.dispatch.asapBatchRadiiMiles,
    [...DEFAULT_ASAP_DISPATCH_BATCH_RADII_MILES],
    { min: 1, max: 1000 }
  )
);

export const ASAP_DISPATCH_BATCH_INTERVAL_SECONDS = parseEnvNumber(
  appConfig.dispatch.asapBatchIntervalSeconds,
  60,
  { min: 15, max: 3600 }
);

export const DISPATCH_REQUEST_SEARCH_MAX_HOURS = parseEnvNumber(
  appConfig.dispatch.requestSearchMaxHours,
  10,
  { min: 1, max: 24 * 30 }
);

const resolveAsapDispatchMaxDistanceMiles = () => (
  ASAP_DISPATCH_BATCH_RADII_MILES[ASAP_DISPATCH_BATCH_RADII_MILES.length - 1] ||
  DEFAULT_ASAP_DISPATCH_BATCH_RADII_MILES[
    DEFAULT_ASAP_DISPATCH_BATCH_RADII_MILES.length - 1
  ]
);

const MAX_REQUEST_DISTANCE_BY_POOL_MILES = Object.freeze({
    [REQUEST_POOLS.ASAP]: resolveAsapDispatchMaxDistanceMiles(),
    [REQUEST_POOLS.SCHEDULED]: resolveAsapDispatchMaxDistanceMiles(),
    [REQUEST_POOLS.ALL]: resolveAsapDispatchMaxDistanceMiles(),
});

const SCHEDULED_LOOKAHEAD_HOURS = parseEnvNumber(
    appConfig.dispatch.scheduledLookaheadHours,
    72,
    { min: 1, max: 24 * 30 }
);

const SCHEDULED_PAST_GRACE_MINUTES = parseEnvNumber(
    appConfig.dispatch.scheduledPastGraceMinutes,
    5,
    { min: 0, max: 120 }
);

export const normalizeRequestPool = (value) => {
    const pool = String(value || REQUEST_POOLS.ALL).trim().toLowerCase();
    if (pool === REQUEST_POOLS.ASAP) return REQUEST_POOLS.ASAP;
    if (pool === REQUEST_POOLS.SCHEDULED) return REQUEST_POOLS.SCHEDULED;
    return REQUEST_POOLS.ALL;
};

export const formatEdgeInvokeError = (error) => {
    if (!error) return 'Unknown edge function error';
    const status = error.status ? `status ${error.status}` : null;
    const message = error.message || error.details || String(error);
    return [status, message].filter(Boolean).join(': ');
};

const getEdgeErrorStatus = (error) => {
  const status = Number(error?.context?.status || error?.status || 0);
  return Number.isFinite(status) ? status : 0;
};

const getEdgeErrorText = async (error) => {
  const directMessage = String(error?.message || error?.details || '').trim().toLowerCase();

  try {
    const payload = await error?.context?.clone?.().json?.();
    const payloadMessage = String(payload?.error || payload?.message || '').trim().toLowerCase();
    const payloadCode = String(payload?.code || payload?.errorCode || '').trim().toLowerCase();
    return [directMessage, payloadMessage, payloadCode].filter(Boolean).join(' | ');
  } catch {
    return directMessage;
  }
};

export const isDriverRequestPoolAuthError = async (error) => {
  const status = getEdgeErrorStatus(error);
  if (status === 401) {
    return true;
  }

  const text = await getEdgeErrorText(error);
  return (
    text.includes('invalid jwt') ||
    text.includes('jwt expired') ||
    text.includes('unauthorized') ||
    text.includes('not authenticated') ||
    text.includes('auth session missing') ||
    text.includes('code 401') ||
    text.includes('status 401')
  );
};

export const invokeDriverRequestPoolWithAuthRetry = async (payload) => {
  let result = await invokeDriverRequestPool(payload);
  if (!result?.error) {
    return result;
  }

  const shouldRetry = await isDriverRequestPoolAuthError(result.error);
  if (!shouldRetry) {
    return result;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return result;
  }
  const accessToken = String(sessionData?.session?.access_token || '').trim();
  if (!accessToken) {
    return result;
  }

  result = await invokeDriverRequestPool(payload, { accessToken });
  return result;
};

export const getAvailableRequestsFromEdge = async ({ requestPool, driverLocation }) => {
    const payload = { requestPool };
    if (driverLocation) {
        payload.driverLocation = driverLocation;
    }

    const { data, error } = await invokeDriverRequestPoolWithAuthRetry(payload);

    if (error) {
        throw error;
    }

    if (data?.error) {
        throw new Error(String(data.error));
    }

    const requests =
        (Array.isArray(data?.trips) ? data.trips : null) ||
        (Array.isArray(data?.requests) ? data.requests : null);

    if (!Array.isArray(requests)) {
        throw new Error('get-driver-request-pool returned an invalid response shape');
    }

    return {
        requests,
        meta: data?.meta || null,
    };
};

export const hasValidCoordinatePair = (value) => {
    if (!value) return false;
    const lat = Number(value.latitude);
    const lng = Number(value.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const distanceMilesBetweenPoints = (first, second) => {
    if (!hasValidCoordinatePair(first) || !hasValidCoordinatePair(second)) {
        return Number.POSITIVE_INFINITY;
    }

    const earthRadiusMiles = 3959;
    const lat1 = Number(first.latitude);
    const lng1 = Number(first.longitude);
    const lat2 = Number(second.latitude);
    const lng2 = Number(second.longitude);

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMiles * c;
};

const getPickupCoordinates = (trip) => {
    const coordinates = trip?.pickup?.coordinates;
    if (hasValidCoordinatePair(coordinates)) {
        return {
            latitude: Number(coordinates.latitude),
            longitude: Number(coordinates.longitude),
        };
    }
    return null;
};

const toTimestampOrInfinity = (value) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const getTripSearchLifetimeLimitMs = () => DISPATCH_REQUEST_SEARCH_MAX_HOURS * 60 * 60 * 1000;

const resolveTripCreatedAtMs = (trip = {}) => {
  const candidates = [
    trip?.createdAt,
    trip?.created_at,
    trip?.originalData?.createdAt,
    trip?.originalData?.created_at,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(candidate || '').getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
};

export const getAsapDispatchWaveIndex = (trip = {}, nowDate = new Date()) => {
  const createdAtMs = resolveTripCreatedAtMs(trip);
  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  const elapsedMs = Math.max(0, nowDate.getTime() - createdAtMs);
  const index = Math.floor(elapsedMs / (ASAP_DISPATCH_BATCH_INTERVAL_SECONDS * 1000));
  return Math.min(Math.max(index, 0), ASAP_DISPATCH_BATCH_RADII_MILES.length - 1);
};

export const getAsapDispatchRadiusMiles = (trip = {}, nowDate = new Date()) => {
  const waveIndex = getAsapDispatchWaveIndex(trip, nowDate);
  return ASAP_DISPATCH_BATCH_RADII_MILES[waveIndex] || MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP];
};

const getRequestDistanceLimitMiles = ({
  trip,
  nowDate,
}) => {
  return getAsapDispatchRadiusMiles(trip, nowDate);
};

export const isTripOutsideSearchLifetime = (trip = {}, nowDate = new Date()) => {
  const createdAtMs = resolveTripCreatedAtMs(trip);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  return (nowDate.getTime() - createdAtMs) > getTripSearchLifetimeLimitMs();
};

export const isTripOutsideScheduledWindow = (requirements, nowDate = new Date()) => {
    if (requirements?.scheduleType !== REQUEST_POOLS.SCHEDULED) {
        return false;
    }

    const scheduledAtMs = toTimestampOrInfinity(requirements?.scheduledTime);
    if (!Number.isFinite(scheduledAtMs)) {
        return false;
    }

    const nowMs = nowDate.getTime();
    const minAllowedMs = nowMs - SCHEDULED_PAST_GRACE_MINUTES * 60 * 1000;
    const maxAllowedMs = nowMs + SCHEDULED_LOOKAHEAD_HOURS * 60 * 60 * 1000;
    return scheduledAtMs < minAllowedMs || scheduledAtMs > maxAllowedMs;
};

export const isTripOutsideDistanceWindow = ({
  trip,
  driverLocation,
  nowDate = new Date(),
}) => {
    if (!hasValidCoordinatePair(driverLocation)) {
        return false;
    }

    const pickupCoordinates = getPickupCoordinates(trip);
    const distanceMiles = distanceMilesBetweenPoints(driverLocation, pickupCoordinates);
    if (!Number.isFinite(distanceMiles)) {
        return false;
    }

  const maxDistanceMiles = getRequestDistanceLimitMiles({
    trip,
    nowDate,
  });
  return distanceMiles > maxDistanceMiles;
};

const getPositiveMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
};

export const resolveTripEstimatedDurationMinutes = (trip = {}, requirements = null) => {
  const normalizedRequirements = requirements || resolveDispatchRequirements(trip);
  const pickupDetails = trip?.pickup?.details || trip?.pickup_location?.details || {};
  const dropoffDetails = trip?.dropoff?.details || trip?.dropoff_location?.details || {};
  const items = Array.isArray(trip?.items)
    ? trip.items
    : trip?.item && typeof trip.item === 'object'
      ? [trip.item]
      : [];
  const distanceMiles = Math.max(
    0,
    Number(
      normalizedRequirements?.estimatedDistanceMiles ??
      trip?.pricing?.distance ??
      trip?.distance ??
      trip?.distance_miles ??
      0
    ) || 0
  );

  const explicitDurationMinutes =
    getPositiveMinutes(normalizedRequirements?.estimatedDurationMinutes) ||
    getPositiveMinutes(
      trip?.durationMinutes ??
      trip?.duration_minutes ??
      trip?.duration ??
      pickupDetails?.estimatedDurationMinutes
    );

  if (explicitDurationMinutes) {
    return Math.min(Math.max(explicitDurationMinutes, 30), 240);
  }

  const helpRequested = Boolean(
    pickupDetails?.driverHelpsLoading ||
    pickupDetails?.driverHelp ||
    dropoffDetails?.driverHelpsUnloading ||
    dropoffDetails?.driverHelp
  );
  const itemCount = Math.max(items.length, 1);
  const estimatedMinutes = Math.round(
    25 + (distanceMiles * 4) + (Math.min(itemCount, 8) * 3) + (helpRequested ? 20 : 0)
  );

  return Math.min(Math.max(estimatedMinutes, 30), 240);
};

export const resolveTripScheduleWindow = (trip = {}, requirements = null) => {
  const scheduledAtMs = new Date(trip?.scheduledTime || trip?.scheduled_time || '').getTime();
  if (!Number.isFinite(scheduledAtMs)) {
    return null;
  }

  const normalizedRequirements = requirements || resolveDispatchRequirements(trip);
  const distanceMiles = Math.max(
    0,
    Number(
      normalizedRequirements?.estimatedDistanceMiles ??
      trip?.pricing?.distance ??
      trip?.distance ??
      trip?.distance_miles ??
      0
    ) || 0
  );
  const leadMinutes = Math.min(Math.max(Math.round(distanceMiles * 2), 10), 90);
  const durationMinutes = resolveTripEstimatedDurationMinutes(trip, normalizedRequirements);
  const bufferMinutes = 10;

  return {
    startMs: scheduledAtMs - ((leadMinutes + bufferMinutes) * 60 * 1000),
    endMs: scheduledAtMs + ((durationMinutes + bufferMinutes) * 60 * 1000),
  };
};

export const hasScheduledTripConflict = ({
  candidateTrip,
  candidateRequirements = null,
  driverActiveTrips = [],
}) => {
  const candidateWindow = resolveTripScheduleWindow(candidateTrip, candidateRequirements);
  if (!candidateWindow) {
    return false;
  }

  return (Array.isArray(driverActiveTrips) ? driverActiveTrips : []).some((activeTrip) => {
    if (!activeTrip || String(activeTrip.id || '') === String(candidateTrip?.id || '')) {
      return false;
    }

    const activeRequirements = resolveDispatchRequirements(activeTrip);
    if (activeRequirements?.scheduleType !== REQUEST_POOLS.SCHEDULED) {
      return false;
    }

    const activeWindow = resolveTripScheduleWindow(activeTrip, activeRequirements);
    if (!activeWindow) {
      return false;
    }

    return candidateWindow.startMs < activeWindow.endMs && activeWindow.startMs < candidateWindow.endMs;
  });
};

export const sortTripsForPool = (trips, { requestPool = REQUEST_POOLS.ALL, driverLocation = null } = {}) => {
    const normalizedPool = normalizeRequestPool(requestPool);
    const sorted = [...trips];

    if (normalizedPool === REQUEST_POOLS.SCHEDULED) {
        sorted.sort((first, second) => {
            const firstTime = toTimestampOrInfinity(
                first?.dispatchRequirements?.scheduledTime || first?.scheduledTime
            );
            const secondTime = toTimestampOrInfinity(
                second?.dispatchRequirements?.scheduledTime || second?.scheduledTime
            );
            if (firstTime !== secondTime) {
                return firstTime - secondTime;
            }

            const firstDistance = distanceMilesBetweenPoints(
                driverLocation,
                getPickupCoordinates(first)
            );
            const secondDistance = distanceMilesBetweenPoints(
                driverLocation,
                getPickupCoordinates(second)
            );
            if (firstDistance !== secondDistance) {
                return firstDistance - secondDistance;
            }

            const firstCreatedAt = new Date(first?.createdAt || 0).getTime();
            const secondCreatedAt = new Date(second?.createdAt || 0).getTime();
            return secondCreatedAt - firstCreatedAt;
        });
        return sorted;
    }

    sorted.sort((first, second) => {
        const firstDistance = distanceMilesBetweenPoints(
            driverLocation,
            getPickupCoordinates(first)
        );
        const secondDistance = distanceMilesBetweenPoints(
            driverLocation,
            getPickupCoordinates(second)
        );
        const firstNormalizedDistance = Number.isFinite(firstDistance)
            ? firstDistance
            : Number.POSITIVE_INFINITY;
        const secondNormalizedDistance = Number.isFinite(secondDistance)
            ? secondDistance
            : Number.POSITIVE_INFINITY;

        if (firstNormalizedDistance !== secondNormalizedDistance) {
            return firstNormalizedDistance - secondNormalizedDistance;
        }

        const firstCreatedAt = new Date(first?.createdAt || 0).getTime();
        const secondCreatedAt = new Date(second?.createdAt || 0).getTime();
        return firstCreatedAt - secondCreatedAt;
    });

    return sorted;
};

export { findDriverScheduleConflictForTrip };
