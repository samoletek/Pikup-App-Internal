import { useCallback, useEffect, useRef, useState } from 'react';
import { TRIP_STATUS, normalizeTripStatus } from '../constants/tripStatus';
import {
  ACTIVE_DELIVERY_POLL_INTERVAL_MS,
  IDLE_DELIVERY_POLL_INTERVAL_MS,
  pickCustomerTrips,
} from '../screens/customer/CustomerHomeScreen.utils';
import { logger } from '../services/logger';

export default function useCustomerDeliveryTracking({
  currentUserId,
  getUserPickupRequests,
}) {
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [recentCancellation, setRecentCancellation] = useState(null);
  const [recentCompletion, setRecentCompletion] = useState(null);
  const activeDeliveryRef = useRef(activeDelivery);

  useEffect(() => {
    activeDeliveryRef.current = activeDelivery;
  }, [activeDelivery]);

  const clearRecentCancellation = useCallback(() => {
    setRecentCancellation(null);
  }, []);

  const clearRecentCompletion = useCallback(() => {
    setRecentCompletion(null);
  }, []);

  const checkActiveDeliveries = useCallback(async () => {
    if (!currentUserId) {
      setActiveDelivery(null);
      setPendingBooking(null);
      setRecentCancellation(null);
      setRecentCompletion(null);
      activeDeliveryRef.current = null;
      return;
    }

    try {
      const requests = await getUserPickupRequests?.();
      const requestList = Array.isArray(requests) ? requests : [];
      const nextState = pickCustomerTrips({ requests: requestList, currentUserId });

      const previousActiveId = String(
        activeDeliveryRef.current?.id ||
        activeDeliveryRef.current?.requestId ||
        activeDeliveryRef.current?.request_id ||
        ''
      ).trim();

      const nextActiveId = String(
        nextState?.activeDelivery?.id ||
        nextState?.activeDelivery?.requestId ||
        nextState?.activeDelivery?.request_id ||
        ''
      ).trim();

      if (previousActiveId && previousActiveId !== nextActiveId) {
        const completedTrip = requestList.find((request) => {
          const requestId = String(
            request?.id || request?.requestId || request?.request_id || ''
          ).trim();

          return (
            requestId === previousActiveId &&
            normalizeTripStatus(request?.status) === TRIP_STATUS.COMPLETED
          );
        });

        if (completedTrip) {
          setRecentCompletion({
            id: previousActiveId,
            tripSnapshot: completedTrip,
          });
        }

        const cancelledTrip = requestList.find((request) => {
          const requestId = String(
            request?.id || request?.requestId || request?.request_id || ''
          ).trim();
          return (
            requestId === previousActiveId &&
            normalizeTripStatus(request?.status) === TRIP_STATUS.CANCELLED
          );
        });

        if (cancelledTrip) {
          setRecentCancellation({
            id: previousActiveId,
            reason: String(
              cancelledTrip?.cancellationReason || cancelledTrip?.cancellation_reason || ''
            )
              .trim()
              .toLowerCase() || null,
            cancelledBy: String(cancelledTrip?.cancelledBy || cancelledTrip?.cancelled_by || '')
              .trim() || null,
          });
        }
      }

      activeDeliveryRef.current = nextState.activeDelivery || null;
      setActiveDelivery(nextState.activeDelivery);
      setPendingBooking(nextState.pendingBooking);
    } catch (error) {
      logger.error('CustomerDeliveryTracking', 'Error checking active deliveries', error);
      setActiveDelivery(null);
      setPendingBooking(null);
      activeDeliveryRef.current = null;
    }
  }, [currentUserId, getUserPickupRequests]);

  useEffect(() => {
    void checkActiveDeliveries();

    const intervalMs = activeDelivery?.id
      ? ACTIVE_DELIVERY_POLL_INTERVAL_MS
      : IDLE_DELIVERY_POLL_INTERVAL_MS;
    const intervalCheck = setInterval(() => {
      void checkActiveDeliveries();
    }, intervalMs);

    return () => {
      clearInterval(intervalCheck);
    };
  }, [activeDelivery?.id, checkActiveDeliveries]);

  return {
    activeDelivery,
    setActiveDelivery,
    pendingBooking,
    setPendingBooking,
    recentCancellation,
    clearRecentCancellation,
    recentCompletion,
    clearRecentCompletion,
    checkActiveDeliveries,
  };
}
