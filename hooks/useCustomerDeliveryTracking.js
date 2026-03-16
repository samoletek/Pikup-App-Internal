import { useCallback, useEffect, useState } from 'react';
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

  const checkActiveDeliveries = useCallback(async () => {
    if (!currentUserId) {
      setActiveDelivery(null);
      setPendingBooking(null);
      return;
    }

    try {
      const requests = await getUserPickupRequests?.();
      const nextState = pickCustomerTrips({ requests, currentUserId });
      setActiveDelivery(nextState.activeDelivery);
      setPendingBooking(nextState.pendingBooking);
    } catch (error) {
      logger.error('CustomerDeliveryTracking', 'Error checking active deliveries', error);
      setActiveDelivery(null);
      setPendingBooking(null);
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
    checkActiveDeliveries,
  };
}
