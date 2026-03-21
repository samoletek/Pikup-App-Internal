import { mapTripFromDb } from './tripMapper';
import { isMissingRpcFunctionError } from './tripErrorUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  confirmScheduledCheckinForDriver,
  declineScheduledCheckinForDriver,
  invokeTripRpc,
} from './repositories/tripRepository';

const resolveCurrentUserDriverId = (currentUser: Record<string, unknown> | null | undefined) => {
  const driverId = (currentUser as any)?.uid || (currentUser as any)?.id || null;
  return driverId ? String(driverId) : null;
};

const mapRpcTripResponse = (data: unknown) => {
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  if (data && typeof data === 'object') {
    return data;
  }
  return null;
};

export const confirmScheduledTripCheckin = async (
  requestId: string,
  currentUser: Record<string, unknown> | null | undefined
) => {
  if (!requestId) {
    throw new Error('Request ID is required');
  }

  const driverId = resolveCurrentUserDriverId(currentUser);
  if (!driverId) {
    throw new Error('User not authenticated');
  }

  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await invokeTripRpc('confirm_scheduled_trip_checkin', {
      p_trip_id: requestId,
      p_driver_id: driverId,
      p_idempotency_key: `scheduled-checkin-confirm:${requestId}:${driverId}`,
    });

    if (error) {
      if (!isMissingRpcFunctionError(error, 'confirm_scheduled_trip_checkin')) {
        throw error;
      }

      logger.warn(
        'TripScheduledCheckin',
        'confirm_scheduled_trip_checkin RPC is missing. Falling back to direct trips update.'
      );

      const { data: fallbackRows, error: fallbackError } = await confirmScheduledCheckinForDriver({
        requestId,
        driverId,
        confirmedAt: nowIso,
        updatedAt: nowIso,
      });

      if (fallbackError) {
        throw fallbackError;
      }

      const fallbackTrip = Array.isArray(fallbackRows) ? fallbackRows[0] || null : null;
      if (!fallbackTrip) {
        throw new Error('Scheduled request check-in confirmation was not persisted');
      }

      return mapTripFromDb(fallbackTrip);
    }

    const updatedTrip = mapRpcTripResponse(data);
    if (!updatedTrip) {
      throw new Error('Scheduled request check-in confirmation was not persisted');
    }

    return mapTripFromDb(updatedTrip);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to confirm scheduled request check-in');
    logger.error('TripScheduledCheckin', 'Error confirming scheduled request check-in', normalized, error);
    throw new Error(normalized.message);
  }
};

export const declineScheduledTripCheckin = async (
  requestId: string,
  currentUser: Record<string, unknown> | null | undefined
) => {
  if (!requestId) {
    throw new Error('Request ID is required');
  }

  const driverId = resolveCurrentUserDriverId(currentUser);
  if (!driverId) {
    throw new Error('User not authenticated');
  }

  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await invokeTripRpc('decline_scheduled_trip_checkin', {
      p_trip_id: requestId,
      p_driver_id: driverId,
      p_reason: 'scheduled_checkin_declined',
    });

    if (error) {
      if (!isMissingRpcFunctionError(error, 'decline_scheduled_trip_checkin')) {
        throw error;
      }

      logger.warn(
        'TripScheduledCheckin',
        'decline_scheduled_trip_checkin RPC is missing. Falling back to direct trips update.'
      );

      const { data: fallbackRows, error: fallbackError } = await declineScheduledCheckinForDriver({
        requestId,
        driverId,
        declinedAt: nowIso,
        updatedAt: nowIso,
      });

      if (fallbackError) {
        throw fallbackError;
      }

      const fallbackTrip = Array.isArray(fallbackRows) ? fallbackRows[0] || null : null;
      if (!fallbackTrip) {
        throw new Error('Scheduled request check-in decline was not persisted');
      }

      return mapTripFromDb(fallbackTrip);
    }

    const updatedTrip = mapRpcTripResponse(data);
    if (!updatedTrip) {
      throw new Error('Scheduled request check-in decline was not persisted');
    }

    return mapTripFromDb(updatedTrip);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to decline scheduled request check-in');
    logger.error('TripScheduledCheckin', 'Error declining scheduled request check-in', normalized, error);
    throw new Error(normalized.message);
  }
};
