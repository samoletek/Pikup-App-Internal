import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToDriverEarningsUpdates } from '../services/DriverService';
import { logger } from '../services/logger';
import {
  mergeDriverOnboardingStatus,
  normalizeDriverPaymentState,
  shouldRefreshDriverPaymentStatus,
} from '../services/payment/paymentState';
import {
  processTripsIntoChartData,
} from '../screens/driver/earnings/earningsUtils';

const DEFAULT_STATS = {
  currentWeekTrips: 0,
  weeklyEarnings: 0,
  totalTrips: 0,
  totalEarnings: 0,
  availableBalance: 0,
  totalPayouts: 0,
  acceptanceRate: 0,
  weeklyMilestone: 15,
};

export default function useDriverEarningsData({
  currentUserId,
  selectedPeriod,
  getDriverTrips,
  getDriverStats,
  getDriverProfile,
  checkDriverOnboardingStatus,
}) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState(DEFAULT_STATS);
  const [driverProfile, setDriverProfile] = useState(() => normalizeDriverPaymentState({}));
  const loadDriverDataRef = useRef(null);

  const loadDriverData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const [tripsResult, statsResult, profileResult] = await Promise.all([
          getDriverTrips?.(currentUserId),
          getDriverStats?.(currentUserId),
          getDriverProfile?.(currentUserId),
        ]);
        const trips = Array.isArray(tripsResult) ? tripsResult : [];
        const stats = statsResult || {};
        let resolvedProfile = normalizeDriverPaymentState(profileResult || {});

        if (
          typeof checkDriverOnboardingStatus === 'function' &&
          shouldRefreshDriverPaymentStatus(resolvedProfile)
        ) {
          const onboardingResult = await checkDriverOnboardingStatus(
            resolvedProfile.connectAccountId
          );

          if (onboardingResult?.success) {
            resolvedProfile = mergeDriverOnboardingStatus(resolvedProfile, onboardingResult);
          }
        }

        setDriverTrips(trips);
        setDriverProfile(resolvedProfile);
        setDriverStats({
          currentWeekTrips: Number(stats.currentWeekTrips || 0),
          weeklyEarnings: Number(stats.weeklyEarnings || 0),
          totalTrips: Number(stats.totalTrips || 0),
          totalEarnings: Number(stats.totalEarnings || 0),
          availableBalance: Number(stats.availableBalance || 0),
          totalPayouts: Number(stats.totalPayouts || 0),
          acceptanceRate: Number(stats.acceptanceRate || 0),
          weeklyMilestone: 15,
        });
        setWeeklyData(processTripsIntoChartData(trips, selectedPeriod));
      } catch (error) {
        logger.error('DriverEarningsData', 'Error loading driver earnings data', error);
        if (!silent) {
          setDriverTrips([]);
          setDriverProfile(normalizeDriverPaymentState({}));
          setDriverStats(DEFAULT_STATS);
          setWeeklyData([]);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      checkDriverOnboardingStatus,
      currentUserId,
      getDriverProfile,
      getDriverStats,
      getDriverTrips,
      selectedPeriod,
    ]
  );

  loadDriverDataRef.current = loadDriverData;

  useEffect(() => {
    if (!currentUserId) {
      setWeeklyData([]);
      setDriverTrips([]);
      setDriverProfile(normalizeDriverPaymentState({}));
      setDriverStats(DEFAULT_STATS);
      setLoading(false);
      return;
    }

    void loadDriverData(false);
  }, [currentUserId, loadDriverData]);

  useEffect(() => {
    if (driverTrips.length === 0) {
      return;
    }

    setWeeklyData(processTripsIntoChartData(driverTrips, selectedPeriod));
  }, [driverTrips, selectedPeriod]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let refreshTimer = null;
    const scheduleRefresh = (delayMs = 200) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        loadDriverDataRef.current?.(true);
      }, delayMs);
    };

    const unsubscribe = subscribeToDriverEarningsUpdates(currentUserId, () => scheduleRefresh(300));

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      unsubscribe();
    };
  }, [currentUserId]);

  return {
    weeklyData,
    driverTrips,
    loading,
    driverStats,
    driverProfile,
    loadDriverData,
  };
}
