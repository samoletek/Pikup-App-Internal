import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import {
  getMissingColumnFromError,
  isMissingColumnError,
} from './tripErrorUtils';
import { logger } from './logger';
import {
  fetchExpiredPendingTrips,
  fetchTripExpiryById,
  resetPendingUnassignedTripById,
  updateTripById,
} from './repositories/tripRepository';

let hasTripExpiresAtColumn = true;

export const checkExpiredTripRequests = async ({ onResetExpiredRequest }) => {
  if (!hasTripExpiresAtColumn) {
    return 0;
  }

  const now = new Date().toISOString();
  const { data: expiredRequests, error } = await fetchExpiredPendingTrips(
    toDbTripStatus(TRIP_STATUS.PENDING),
    now
  );

  if (error) {
    if (isMissingColumnError(error, 'expires_at')) {
      hasTripExpiresAtColumn = false;
      logger.warn('TripExpiry', 'Skipping expired request checks: trips.expires_at column is missing.');
      return 0;
    }
    throw error;
  }

  if (!Array.isArray(expiredRequests) || expiredRequests.length === 0) {
    return 0;
  }

  let resetCount = 0;
  for (const request of expiredRequests) {
    const didReset = await onResetExpiredRequest(request.id);
    if (didReset) {
      resetCount += 1;
    }
  }

  return resetCount;
};

export const resetExpiredTripRequest = async (requestId) => {
  const nextExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const baseUpdates = {
    status: toDbTripStatus(TRIP_STATUS.PENDING),
    updated_at: new Date().toISOString(),
    viewing_driver_id: null,
  };

  let updates = { ...baseUpdates, expires_at: nextExpiry };
  let wasUpdated = false;

  while (Object.keys(updates).length > 0) {
    const { data, error } = await resetPendingUnassignedTripById(
      requestId,
      toDbTripStatus(TRIP_STATUS.PENDING),
      updates
    );

    if (!error) {
      wasUpdated = Array.isArray(data) && data.length > 0;
      break;
    }

    const missingColumn = getMissingColumnFromError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
      logger.warn(
        'TripExpiry',
        `Trips table is missing "${missingColumn}" during expiry reset. Retrying without it.`
      );
      delete updates[missingColumn];
      continue;
    }

    throw error;
  }

  if (wasUpdated) {
    logger.info('TripExpiry', 'Reset expired request', { requestId });
    return true;
  }

  logger.info('TripExpiry', 'Skipped expired reset (already accepted or unavailable)', { requestId });
  return false;
};

export const extendTripRequestTimer = async (requestId, additionalMinutes = 2) => {
  if (!hasTripExpiresAtColumn) {
    return null;
  }

  const { data: request, error: fetchError } = await fetchTripExpiryById(requestId);

  if (fetchError) {
    if (isMissingColumnError(fetchError, 'expires_at')) {
      hasTripExpiresAtColumn = false;
      logger.warn('TripExpiry', 'Skipping request timer extension: trips.expires_at column is missing.');
      return null;
    }
    throw fetchError;
  }

  const currentExpiry = new Date(request.expires_at || new Date());
  const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

  const { error } = await updateTripById(requestId, { expires_at: newExpiry.toISOString() });

  if (error) {
    if (isMissingColumnError(error, 'expires_at')) {
      hasTripExpiresAtColumn = false;
      logger.warn('TripExpiry', 'Skipping request timer extension: trips.expires_at column is missing.');
      return null;
    }
    throw error;
  }

  return newExpiry.toISOString();
};
