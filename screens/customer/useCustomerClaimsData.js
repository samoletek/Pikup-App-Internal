import { useCallback, useEffect, useState } from 'react';
import {
  fetchClaimsForUser,
  mapEligibleTripsForClaims,
} from '../../services/ClaimsService';
import { logger } from '../../services/logger';

const MIN_REFRESH_SPINNER_MS = 700;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useCustomerClaimsData({
  currentUserId,
  getUserPickupRequests,
}) {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ongoingClaims, setOngoingClaims] = useState([]);
  const [completedClaims, setCompletedClaims] = useState([]);
  const [pastTrips, setPastTrips] = useState([]);

  const loadClaimsData = useCallback(async ({ withInitialLoader = false } = {}) => {
    if (!currentUserId) {
      setOngoingClaims([]);
      setCompletedClaims([]);
      if (withInitialLoader) setInitialLoading(false);
      return;
    }

    try {
      if (withInitialLoader) setInitialLoading(true);
      const result = await fetchClaimsForUser(currentUserId);

      if (!result.success) {
        setOngoingClaims([]);
        setCompletedClaims([]);
        return;
      }

      setOngoingClaims(result.ongoingClaims);
      setCompletedClaims(result.completedClaims);
    } finally {
      if (withInitialLoader) setInitialLoading(false);
    }
  }, [currentUserId]);

  const loadPastTrips = useCallback(async () => {
    try {
      const requests = await getUserPickupRequests();
      const tripsWithInsurance = mapEligibleTripsForClaims(requests);
      setPastTrips(tripsWithInsurance);
    } catch (error) {
      logger.error('CustomerClaims', 'Failed to load past trips', error);
      setPastTrips([]);
    }
  }, [getUserPickupRequests]);

  useEffect(() => {
    void loadClaimsData({ withInitialLoader: true });
    void loadPastTrips();
  }, [loadClaimsData, loadPastTrips]);

  const handleRefreshClaims = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);
    const refreshStartedAt = Date.now();

    try {
      await Promise.all([loadClaimsData(), loadPastTrips()]);
    } finally {
      const elapsed = Date.now() - refreshStartedAt;
      if (elapsed < MIN_REFRESH_SPINNER_MS) {
        await wait(MIN_REFRESH_SPINNER_MS - elapsed);
      }
      setRefreshing(false);
    }
  }, [loadClaimsData, loadPastTrips, refreshing]);

  return {
    completedClaims,
    initialLoading,
    loadClaimsData,
    ongoingClaims,
    pastTrips,
    refreshing,
    handleRefreshClaims,
  };
}
