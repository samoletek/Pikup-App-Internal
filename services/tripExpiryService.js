import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import {
  getMissingColumnFromError,
  isMissingColumnError,
  isMissingRpcFunctionError,
} from './tripErrorUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  expireOverdueDriverScheduledCheckins,
  fetchExpiredPendingTrips,
  fetchTripExpiryById,
  invokeTripRpc,
  resetPendingUnassignedTripById,
  updateTripById,
} from './repositories/tripRepository';

let hasTripExpiresAtColumn = true;
let hasScheduledCheckinColumns = true;

const parseExpiredScheduledCheckinsCount = (value) => {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0) {
    return Math.floor(direct);
  }

  if (Array.isArray(value) && value.length === 1) {
    const fallback = Number(value[0]);
    if (Number.isFinite(fallback) && fallback >= 0) {
      return Math.floor(fallback);
    }
  }

  return 0;
};

export const checkExpiredTripRequests = async ({ onResetExpiredRequest }) => {
  const shouldCheckPendingOfferExpiry = hasTripExpiresAtColumn;
  let pendingOfferResetCount = 0;

  if (shouldCheckPendingOfferExpiry) {
    const now = new Date().toISOString();
    const { data: expiredRequests, error } = await fetchExpiredPendingTrips(
      toDbTripStatus(TRIP_STATUS.PENDING),
      now
    );

    if (error) {
      if (isMissingColumnError(error, 'expires_at')) {
        hasTripExpiresAtColumn = false;
        logger.warn('TripExpiry', 'Skipping expired request checks: trips.expires_at column is missing.');
      } else {
        throw error;
      }
    } else if (Array.isArray(expiredRequests) && expiredRequests.length > 0) {
      for (const request of expiredRequests) {
        const didReset = await onResetExpiredRequest(request.id);
        if (didReset) {
          pendingOfferResetCount += 1;
        }
      }
    }
  }

  let scheduledCheckinExpiredCount = 0;
  if (hasScheduledCheckinColumns) {
    try {
      const { data, error } = await invokeTripRpc('expire_overdue_scheduled_checkins', {});

      if (error) {
        if (isMissingRpcFunctionError(error, 'expire_overdue_scheduled_checkins')) {
          logger.warn(
            'TripExpiry',
            'expire_overdue_scheduled_checkins RPC is missing. Falling back to direct trips update.'
          );
          const nowIso = new Date().toISOString();
          const { data: expiredRows, error: expireFallbackError } =
            await expireOverdueDriverScheduledCheckins({ nowIso });

          if (expireFallbackError) {
            if (
              isMissingColumnError(expireFallbackError, 'driver_checkin_deadline_at') ||
              isMissingColumnError(expireFallbackError, 'driver_checkin_status')
            ) {
              hasScheduledCheckinColumns = false;
              logger.warn(
                'TripExpiry',
                'Skipping scheduled check-in expiry checks: required trips columns are missing.'
              );
            } else {
              throw expireFallbackError;
            }
          } else {
            scheduledCheckinExpiredCount = Array.isArray(expiredRows) ? expiredRows.length : 0;
          }
        } else if (
          isMissingColumnError(error, 'driver_checkin_deadline_at') ||
          isMissingColumnError(error, 'driver_checkin_status')
        ) {
          hasScheduledCheckinColumns = false;
          logger.warn(
            'TripExpiry',
            'Skipping scheduled check-in expiry checks: required trips columns are missing.'
          );
        } else {
          throw error;
        }
      } else {
        scheduledCheckinExpiredCount = parseExpiredScheduledCheckinsCount(data);
      }
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to expire overdue scheduled check-ins');
      if (
        isMissingColumnError(error, 'driver_checkin_deadline_at') ||
        isMissingColumnError(error, 'driver_checkin_status')
      ) {
        hasScheduledCheckinColumns = false;
        logger.warn(
          'TripExpiry',
          'Skipping scheduled check-in expiry checks: required trips columns are missing.',
          normalized
        );
      } else {
        logger.error(
          'TripExpiry',
          'Failed to expire overdue scheduled check-ins',
          normalized,
          error
        );
        throw error;
      }
    }
  }

  return pendingOfferResetCount + scheduledCheckinExpiredCount;
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
