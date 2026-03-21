import { TRIP_STATUS, normalizeTripStatus } from '../constants/tripStatus';
import { failureResult, successResult } from './contracts/result';
import { normalizeError } from './errorService';
import { logger } from './logger';
import { mapTripFromDb } from './tripMapper';
import { fetchTripsByDriverId, invokeTripRpc } from './repositories/tripRepository';

const CHECKIN_PENDING_STATUS = 'pending';
const CHECKIN_CONFIRM_RPC = 'confirm_scheduled_trip_checkin';
const CHECKIN_DECLINE_RPC = 'decline_scheduled_trip_checkin';

const CHECKIN_TRIP_COLUMNS = [
  'id',
  'status',
  'driver_id',
  'customer_id',
  'scheduled_time',
  'price',
  'pickup_location',
  'dropoff_location',
  'driver_checkin_status',
  'driver_checkin_required_at',
  'driver_checkin_deadline_at',
  'driver_checkin_confirmed_at',
  'driver_checkin_declined_at',
  'created_at',
  'updated_at',
].join(',');

const resolveUserId = (currentUser: any): string => {
  const userId = String(currentUser?.uid || currentUser?.id || '').trim();
  return userId;
};

const resolveTripId = (tripId: unknown): string => {
  return String(tripId || '').trim();
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const resolveCheckinStatus = (trip: Record<string, any>): string => {
  const status = String(trip?.driver_checkin_status || trip?.driverCheckinStatus || '').trim().toLowerCase();
  return status || CHECKIN_PENDING_STATUS;
};

const resolveRequiredAt = (trip: Record<string, any>): Date | null => {
  return parseDate(trip?.driver_checkin_required_at || trip?.driverCheckinRequiredAt || null);
};

const resolveDeadlineAt = (trip: Record<string, any>): Date | null => {
  return parseDate(trip?.driver_checkin_deadline_at || trip?.driverCheckinDeadlineAt || null);
};

const isScheduledAcceptedTrip = (trip: Record<string, any>): boolean => {
  const status = normalizeTripStatus(trip?.status);
  const hasScheduledTime = Boolean(trip?.scheduled_time || trip?.scheduledTime);
  return status === TRIP_STATUS.ACCEPTED && hasScheduledTime;
};

const isCheckinDue = (trip: Record<string, any>, now: Date): boolean => {
  if (!isScheduledAcceptedTrip(trip)) {
    return false;
  }

  if (resolveCheckinStatus(trip) !== CHECKIN_PENDING_STATUS) {
    return false;
  }

  const requiredAt = resolveRequiredAt(trip);
  if (!requiredAt || requiredAt.getTime() > now.getTime()) {
    return false;
  }

  const deadlineAt = resolveDeadlineAt(trip);
  if (!deadlineAt) {
    return true;
  }

  return deadlineAt.getTime() > now.getTime();
};

const sortDueTripsByDeadline = (firstTrip: Record<string, any>, secondTrip: Record<string, any>) => {
  const firstDeadline = resolveDeadlineAt(firstTrip)?.getTime() ?? Number.POSITIVE_INFINITY;
  const secondDeadline = resolveDeadlineAt(secondTrip)?.getTime() ?? Number.POSITIVE_INFINITY;
  return firstDeadline - secondDeadline;
};

const resolveTripFromRpcData = (data: unknown) => {
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  if (data && typeof data === 'object') {
    return data;
  }

  return null;
};

export const getPendingDriverScheduledCheckins = async (currentUser: unknown) => {
  const driverId = resolveUserId(currentUser);
  if (!driverId) {
    return failureResult('User not authenticated', 'auth_required');
  }

  try {
    const { data, error } = await fetchTripsByDriverId({
      driverId,
      columns: CHECKIN_TRIP_COLUMNS,
      status: TRIP_STATUS.ACCEPTED,
    });

    if (error) {
      throw error;
    }

    const now = new Date();
    const mappedTrips = Array.isArray(data) ? data.map((trip) => mapTripFromDb(trip)) : [];
    const dueTrips = mappedTrips
      .filter((trip) => isCheckinDue(trip || {}, now))
      .sort(sortDueTripsByDeadline);

    return successResult({ trips: dueTrips });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load scheduled trip check-ins');
    logger.error('TripScheduledCheckinService', 'Error loading due check-ins', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const confirmScheduledTripCheckin = async (
  tripId: unknown,
  currentUser: unknown,
  options: { idempotencyKey?: string } = {},
) => {
  const driverId = resolveUserId(currentUser);
  if (!driverId) {
    return failureResult('User not authenticated', 'auth_required');
  }

  const normalizedTripId = resolveTripId(tripId);
  if (!normalizedTripId) {
    return failureResult('Trip ID is required', 'trip_id_required');
  }

  try {
    const idempotencyKey =
      String(options?.idempotencyKey || '').trim() ||
      `scheduled_checkin_confirm:${normalizedTripId}:${driverId}`;

    const { data, error } = await invokeTripRpc(CHECKIN_CONFIRM_RPC, {
      p_trip_id: normalizedTripId,
      p_driver_id: driverId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw error;
    }

    const trip = resolveTripFromRpcData(data);
    if (!trip) {
      return failureResult('Check-in is no longer available for this trip.', 'checkin_unavailable');
    }

    return successResult({
      trip: mapTripFromDb(trip as Record<string, unknown>),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to confirm scheduled trip check-in');
    logger.error('TripScheduledCheckinService', 'Error confirming check-in', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const declineScheduledTripCheckin = async (
  tripId: unknown,
  currentUser: unknown,
  options: { reason?: string } = {},
) => {
  const driverId = resolveUserId(currentUser);
  if (!driverId) {
    return failureResult('User not authenticated', 'auth_required');
  }

  const normalizedTripId = resolveTripId(tripId);
  if (!normalizedTripId) {
    return failureResult('Trip ID is required', 'trip_id_required');
  }

  try {
    const reason = String(options?.reason || '').trim() || 'scheduled_checkin_declined';
    const { data, error } = await invokeTripRpc(CHECKIN_DECLINE_RPC, {
      p_trip_id: normalizedTripId,
      p_driver_id: driverId,
      p_reason: reason,
    });

    if (error) {
      throw error;
    }

    const trip = resolveTripFromRpcData(data);
    if (!trip) {
      return failureResult('Trip is no longer available to decline.', 'checkin_unavailable');
    }

    return successResult({
      requeuedTrip: mapTripFromDb(trip as Record<string, unknown>),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to decline scheduled trip check-in');
    logger.error('TripScheduledCheckinService', 'Error declining check-in', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};
