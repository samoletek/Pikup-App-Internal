import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import {
  applyTripUpdateWithColumnFallback,
  fetchTripByIdWithRetry,
} from './tripPersistenceUtils';
import {
  hasReachedOrPassedStatus,
  isNetworkRequestFailure,
} from './tripErrorUtils';
import { completeInsuranceBookingForTrip } from './tripInsuranceUtils';
import { uploadRequestPhotosForTrip } from './tripPhotoLifecycleService';
import {
  checkExpiredTripRequests,
  extendTripRequestTimer,
  resetExpiredTripRequest,
} from './tripExpiryService';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { updateDriverEarnings } from './driverEarningsService';
import { updateDriverRowById } from './repositories/paymentRepository';
import {
  updateTripById,
} from './repositories/tripRepository';
import {
  buildSettledTripPricing,
  buildTripPricingCreditPatch,
  hasDriverEarningsCredit,
} from './payment/tripSettlement';
import { captureTripPayment } from './tripPaymentLifecycleService';

const STATUS_TIMESTAMP_FIELDS = Object.freeze({
  [TRIP_STATUS.IN_PROGRESS]: 'in_progress_at',
  [TRIP_STATUS.ARRIVED_AT_PICKUP]: 'arrived_at_pickup_at',
  [TRIP_STATUS.PICKED_UP]: 'picked_up_at',
  [TRIP_STATUS.EN_ROUTE_TO_DROPOFF]: 'en_route_to_dropoff_at',
  [TRIP_STATUS.ARRIVED_AT_DROPOFF]: 'arrived_at_dropoff_at',
  [TRIP_STATUS.COMPLETED]: 'completed_at',
  [TRIP_STATUS.CANCELLED]: 'cancelled_at',
});

const mapOptimisticTrip = ({ requestId, requestedUpdates, appliedUpdates }) => {
  return mapTripFromDb({
    id: requestId,
    ...requestedUpdates,
    ...appliedUpdates,
  });
};

const fetchMappedTripAfterStatusUpdate = async ({
  requestId,
  requestedUpdates,
  optimisticLabel,
  appliedUpdates,
}) => {
  const { data, error } = await fetchTripByIdWithRetry(requestId);
  if (error) {
    if (isNetworkRequestFailure(error)) {
      logger.warn(
        'TripLifecycle',
        `Returning optimistic ${optimisticLabel} after network failure while reloading trip`
      );
      return mapOptimisticTrip({
        requestId,
        requestedUpdates,
        appliedUpdates,
      });
    }
    throw error;
  }

  if (!data) {
    return mapOptimisticTrip({
      requestId,
      requestedUpdates,
      appliedUpdates,
    });
  }

  return mapTripFromDb(data);
};

export const updateRequestStatus = async (requestId, newStatus, additionalData = {}) => {
  try {
    const normalizedStatus = normalizeTripStatus(newStatus);
    const requestedUpdates = {
      ...additionalData,
      status: toDbTripStatus(normalizedStatus),
      updated_at: new Date().toISOString(),
    };

    const appliedUpdates = await applyTripUpdateWithColumnFallback(requestId, requestedUpdates);
    return await fetchMappedTripAfterStatusUpdate({
      requestId,
      requestedUpdates,
      appliedUpdates,
      optimisticLabel: 'request status',
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update request status');
    logger.error('TripLifecycle', 'Error updating request status', normalized, error);
    throw new Error(normalized.message);
  }
};

export const updateDriverStatus = async (requestId, status, location = null, additionalData = {}) => {
  const normalizedStatus = normalizeTripStatus(status);
  const statusTimestampField = STATUS_TIMESTAMP_FIELDS[normalizedStatus] || `${normalizedStatus}_at`;
  const requestedUpdates = {
    ...additionalData,
    status: toDbTripStatus(normalizedStatus),
    [statusTimestampField]: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (location) {
    requestedUpdates.driver_location = location;
  }

  try {
    const appliedUpdates = await applyTripUpdateWithColumnFallback(requestId, requestedUpdates);
    return await fetchMappedTripAfterStatusUpdate({
      requestId,
      requestedUpdates,
      appliedUpdates,
      optimisticLabel: 'driver status',
    });
  } catch (error) {
    const { data: latestTrip, error: latestError } = await fetchTripByIdWithRetry(requestId);
    if (!latestError && latestTrip && hasReachedOrPassedStatus(latestTrip.status, normalizedStatus)) {
      logger.warn(
        'TripLifecycle',
        `Ignoring stale driver status update ${normalizedStatus}; latest trip status is ${latestTrip.status} for request ${requestId}.`
      );
      return mapTripFromDb(latestTrip);
    }

    if (isNetworkRequestFailure(error)) {
      logger.warn(
        'TripLifecycle',
        `Transient network failure while updating driver status to ${normalizedStatus} for request ${requestId}.`
      );
    }

    const normalized = normalizeError(error, 'Failed to update driver status');
    logger.error('TripLifecycle', 'Error updating driver status', normalized, error);
    throw new Error(normalized.message);
  }
};

export const updateDriverLocation = async (requestId, location, currentUser) => {
  if (!currentUser || !requestId || !location) {
    return;
  }

  try {
    const { error } = await updateDriverRowById(currentUser.uid || currentUser.id, {
      metadata: {
        lastLocation: location,
        updatedAt: new Date().toISOString(),
      },
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update driver location');
    logger.warn('TripLifecycle', 'Error updating driver location', normalized, error);
  }
};

export const uploadRequestPhotos = async (requestId, photos, photoType = 'pickup') => {
  try {
    return await uploadRequestPhotosForTrip({
      requestId,
      photos,
      photoType,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to upload trip photos');
    logger.error('TripLifecycle', 'Error uploading photos', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getRequestById = async (requestId) => {
  try {
    const { data, error } = await fetchTripByIdWithRetry(requestId);

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error(`Request ${requestId} not found`);
    }

    return mapTripFromDb(data);
  } catch (error) {
    if (isNetworkRequestFailure(error)) {
      const normalized = normalizeError(error, 'Transient network failure while fetching request');
      logger.warn('TripLifecycle', 'Transient network failure while fetching request', normalized, error);
    } else {
      const normalized = normalizeError(error, 'Failed to fetch request');
      logger.error('TripLifecycle', 'Error fetching request', normalized, error);
    }

    throw new Error(normalizeError(error, 'Failed to fetch request').message);
  }
};

export const completeDelivery = async (requestId, completionData = {}) =>
  updateDriverStatus(requestId, TRIP_STATUS.COMPLETED, null, completionData);

const creditDriverBalanceForCompletedTrip = async (trip) => {
  const normalizedTrip = trip || {};
  const tripId = normalizedTrip.id;
  const driverId = normalizedTrip.driverId || normalizedTrip.driver_id || null;
  if (!tripId || !driverId || hasDriverEarningsCredit(normalizedTrip)) {
    return;
  }

  const settledPricing = buildSettledTripPricing(normalizedTrip);
  const creditedAt = new Date().toISOString();

  await updateDriverEarnings(driverId, {
    ...normalizedTrip,
    pricing: settledPricing,
    driverPayout: settledPricing.driverPayout,
    driverEarnings: settledPricing.driverPayout,
  });

  await updateTripById(tripId, {
    pickup_location: buildTripPricingCreditPatch(normalizedTrip, creditedAt),
    updated_at: creditedAt,
  });
};

export const finishDelivery = async (
  requestId,
  photos = [],
  driverLocation = null,
  customerRating = null,
  currentUser
) => {
  try {
    if (photos.length > 0) {
      await uploadRequestPhotos(requestId, photos, 'dropoff');
    }

    await completeDelivery(requestId, {
      completed_by: currentUser?.id,
    });

    const captureResult = await captureTripPayment({
      tripId: requestId,
      idempotencyKey: `trip_capture:${requestId}`,
    });

    if (!captureResult.success && captureResult.errorCode !== 'missing_authorization') {
      throw new Error(captureResult.error || 'Failed to capture trip payment');
    }

    const trip = await getRequestById(requestId);
    if (captureResult.success) {
      await creditDriverBalanceForCompletedTrip(trip);
    }

    try {
      await completeInsuranceBookingForTrip(trip);
    } catch (insuranceErr) {
      const normalized = normalizeError(insuranceErr, 'Failed to complete insurance booking');
      logger.warn('TripLifecycle', 'Failed to complete insurance booking', normalized, insuranceErr);
    }

    return true;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to finish delivery');
    logger.error('TripLifecycle', 'Error finishing delivery', normalized, error);
    throw new Error(normalized.message);
  }
};

export const startDriving = (requestId, driverLocation) =>
  updateDriverStatus(requestId, TRIP_STATUS.IN_PROGRESS, driverLocation);

export const arriveAtPickup = (requestId, driverLocation) =>
  updateDriverStatus(requestId, TRIP_STATUS.ARRIVED_AT_PICKUP, driverLocation);

export const confirmPickup = async (requestId, photos = [], driverLocation = null) => {
  if (photos.length > 0) {
    await uploadRequestPhotos(requestId, photos, 'pickup');
  }
  return updateDriverStatus(requestId, TRIP_STATUS.PICKED_UP, driverLocation);
};

export const startDelivery = (requestId, driverLocation) =>
  updateDriverStatus(requestId, TRIP_STATUS.EN_ROUTE_TO_DROPOFF, driverLocation);

export const arriveAtDropoff = (requestId, driverLocation) =>
  updateDriverStatus(requestId, TRIP_STATUS.ARRIVED_AT_DROPOFF, driverLocation);

export const checkExpiredRequests = async () => {
  try {
    return await checkExpiredTripRequests({
      onResetExpiredRequest: resetExpiredRequest,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to check expired requests');
    logger.error('TripLifecycle', 'Error checking expired requests', normalized, error);
    return 0;
  }
};

export const resetExpiredRequest = async (requestId) => {
  try {
    return await resetExpiredTripRequest(requestId);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to reset expired request');
    logger.error('TripLifecycle', 'Error resetting expired request', normalized, error);
    throw new Error(normalized.message);
  }
};

export const extendRequestTimer = async (requestId, additionalMinutes = 2) => {
  try {
    return await extendTripRequestTimer(requestId, additionalMinutes);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to extend request timer');
    logger.error('TripLifecycle', 'Error extending request timer', normalized, error);
    throw new Error(normalized.message);
  }
};

export const claimRequestForViewing = async (requestId, driverId) => {
  try {
    await updateTripById(requestId, {
      viewing_driver_id: driverId,
      viewed_at: new Date().toISOString(),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to claim request for viewing');
    logger.error('TripLifecycle', 'Error claiming request for viewing', normalized, error);
    throw new Error(normalized.message);
  }
};

export const releaseRequestViewing = async (requestId) => {
  try {
    await updateTripById(requestId, { viewing_driver_id: null });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to release request viewing');
    logger.error('TripLifecycle', 'Error releasing request viewing', normalized, error);
    throw new Error(normalized.message);
  }
};
