import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ACTIVE_TRIP_STATUSES,
  isFutureScheduledTrip,
  normalizeTripStatus,
} from '../constants/tripStatus';
import { getPersistedDriverOnlineStatus } from '../services/driverStateService';
import { logger } from '../services/logger';

const ACTIVE_TRIP_RESTORE_INTERVAL_MS = 60 * 1000;

export default function useDriverActiveTripRestore({
  currentUserId,
  userType,
  getUserPickupRequests,
  clearIncomingRoute,
  setAcceptedRequestId,
  setActiveJob,
  setIncomingRequest,
  setShowIncomingModal,
  setIsMinimized,
  setAvailableRequests,
  setIsOnline,
}) {
  const [isRestoringActiveTrip, setIsRestoringActiveTrip] = useState(true);
  const restoreInFlightRef = useRef(false);

  const restoreActiveTrip = useCallback(async ({ initialLoad = false } = {}) => {
    if (!currentUserId || userType !== 'driver' || typeof getUserPickupRequests !== 'function') {
      if (initialLoad) {
        setIsRestoringActiveTrip(false);
      }
      return null;
    }

    if (restoreInFlightRef.current) {
      return null;
    }

    restoreInFlightRef.current = true;
    if (initialLoad) {
      setIsRestoringActiveTrip(true);
    }

    try {
      const requests = await getUserPickupRequests();
      const persistedOnlineStatus = await getPersistedDriverOnlineStatus(currentUserId);

      if (!Array.isArray(requests)) {
        setAcceptedRequestId(null);
        setActiveJob(null);
        if (typeof persistedOnlineStatus === 'boolean') {
          setIsOnline(persistedOnlineStatus);
        }
        return null;
      }

      const activeTrip = requests
        .filter((trip) => {
          if (!trip?.id) {
            return false;
          }

          const normalizedStatus = normalizeTripStatus(trip.status);
          if (!ACTIVE_TRIP_STATUSES.includes(normalizedStatus)) {
            return false;
          }

          if (isFutureScheduledTrip(trip)) {
            return false;
          }

          const assignedDriverId =
            trip.driverId || trip.driver_id || trip.assignedDriverId || trip.assigned_driver_id;
          return assignedDriverId === currentUserId;
        })
        .sort((a, b) => {
          const aTime = new Date(a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || 0).getTime();
          const bTime = new Date(b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || 0).getTime();
          return bTime - aTime;
        })[0] || null;

      if (!activeTrip) {
        setAcceptedRequestId(null);
        setActiveJob(null);
        if (typeof persistedOnlineStatus === 'boolean') {
          setIsOnline(persistedOnlineStatus);
        }
        return null;
      }

      setAcceptedRequestId(activeTrip.id);
      setActiveJob(activeTrip);
      setIncomingRequest(null);
      setShowIncomingModal(false);
      setIsMinimized(false);
      clearIncomingRoute();
      setAvailableRequests((prevRequests) =>
        prevRequests.filter((request) => request.id !== activeTrip.id)
      );
      setIsOnline(true);

      return activeTrip;
    } catch (restoreError) {
      logger.error('DriverActiveTripRestore', 'Error restoring active trip', restoreError);
      return null;
    } finally {
      restoreInFlightRef.current = false;
      if (initialLoad) {
        setIsRestoringActiveTrip(false);
      }
    }
  }, [
    clearIncomingRoute,
    currentUserId,
    getUserPickupRequests,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setIsOnline,
    setShowIncomingModal,
    userType,
  ]);

  useEffect(() => {
    if (!currentUserId || userType !== 'driver') {
      setAcceptedRequestId(null);
      setActiveJob(null);
      setIsOnline(false);
      setIsRestoringActiveTrip(false);
      return;
    }

    restoreActiveTrip({ initialLoad: true });
  }, [
    currentUserId,
    restoreActiveTrip,
    setAcceptedRequestId,
    setActiveJob,
    setIsOnline,
    userType,
  ]);

  useFocusEffect(
    useCallback(() => {
      restoreActiveTrip({ initialLoad: false });
    }, [restoreActiveTrip])
  );

  useEffect(() => {
    if (!currentUserId || userType !== 'driver') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void restoreActiveTrip({ initialLoad: false });
    }, ACTIVE_TRIP_RESTORE_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUserId, restoreActiveTrip, userType]);

  return {
    isRestoringActiveTrip,
    restoreActiveTrip,
  };
}
