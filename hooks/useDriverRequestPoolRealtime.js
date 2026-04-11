import { useEffect } from 'react';
import { normalizeTripStatus, TRIP_STATUS } from '../constants/tripStatus';
import { subscribeToDriverRequestPoolUpdates } from '../services/driverRequestPoolRealtimeService';
import { logger } from '../services/logger';

const normalizeRequestId = (value) => String(value || '').trim();

export default function useDriverRequestPoolRealtime({
  currentUserId,
  isOnline,
  hasActiveTrip,
  incomingRequestIdRef,
  setAvailableRequests,
  setSelectedRequest,
  setShowIncomingModal,
  setIsMinimized,
  setIncomingRequest,
}) {
  useEffect(() => {
    if (!currentUserId || !isOnline || hasActiveTrip) {
      return undefined;
    }

    const removeRequestFromPool = (tripIdValue) => {
      const tripId = normalizeRequestId(tripIdValue);
      if (!tripId) return;

      setAvailableRequests((prev) =>
        prev.filter((request) => normalizeRequestId(request?.id) !== tripId)
      );
      setSelectedRequest((prev) => (
        normalizeRequestId(prev?.id) === tripId ? null : prev
      ));

      if (normalizeRequestId(incomingRequestIdRef.current) === tripId) {
        setShowIncomingModal(false);
        setIsMinimized(false);
        setIncomingRequest(null);
      }
    };

    const unsubscribe = subscribeToDriverRequestPoolUpdates({
      currentUserId,
      onTripUnavailable: ({ type, payload }) => {
        if (type === 'trip_update') {
          const row = payload?.new;
          const tripId = row?.id;
          if (!tripId) return;

          const normalizedStatus = normalizeTripStatus(row.status);
          const assignedDriverId = row.driver_id || row.assigned_driver_id || null;
          const takenByAnotherDriver = Boolean(
            assignedDriverId && assignedDriverId !== currentUserId
          );
          const noLongerPending = normalizedStatus !== TRIP_STATUS.PENDING;
          const becameUnavailableForDriver = takenByAnotherDriver || noLongerPending;
          if (!becameUnavailableForDriver) return;

          removeRequestFromPool(tripId);
          return;
        }

        if (type === 'trip_delete') {
          const tripId = payload?.old?.id;
          removeRequestFromPool(tripId);
          return;
        }

        if (type === 'offer_update') {
          const row = payload?.new;
          const tripId = row?.trip_id;
          const offerStatus = String(row?.status || '').trim().toLowerCase();
          if (!tripId) return;
          const isOfferFinalizedForDriver = (
            offerStatus === 'accepted' ||
            offerStatus === 'declined'
          );
          if (isOfferFinalizedForDriver) {
            removeRequestFromPool(tripId);
          }
        }
      },
    });

    logger.info('DriverRequestPoolRealtime', 'Subscribed to request pool updates');

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [
    currentUserId,
    hasActiveTrip,
    incomingRequestIdRef,
    isOnline,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setSelectedRequest,
    setShowIncomingModal,
  ]);
}
