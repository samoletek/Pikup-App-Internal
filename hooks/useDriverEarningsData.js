import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { subscribeToDriverEarningsUpdates } from '../services/DriverService';
import { logger } from '../services/logger';
import {
  mergeDriverOnboardingStatus,
  normalizeDriverPaymentState,
  shouldRefreshDriverPaymentStatus,
} from '../services/payment/paymentState';
import { processTripsIntoChartData } from '../screens/driver/earnings/earningsUtils';

const DEFAULT_STATS = {
  currentWeekTrips: 0,
  weeklyEarnings: 0,
  totalTrips: 0,
  totalEarnings: 0,
  earnedBalance: 0,
  availableBalance: 0,
  pendingBalance: 0,
  pendingUntil: null,
  totalPayouts: 0,
  acceptanceRate: 0,
  weeklyMilestone: 15,
};

const HOLD_REFRESH_GRACE_MS = 10 * 1000;
const MAX_HOLD_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000;

export default function useDriverEarningsData({
  currentUserId,
  selectedPeriod,
  getDriverTrips,
  getDriverStats,
  getDriverProfile,
  checkDriverOnboardingStatus,
  getDriverPayoutAvailability,
}) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState(DEFAULT_STATS);
  const [driverProfile, setDriverProfile] = useState(() => normalizeDriverPaymentState({}));
  const loadDriverDataRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const holdRefreshAttemptRef = useRef(null);

  const loadDriverData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const [tripsResult, statsResult, profileResult, availabilityResult] = await Promise.all([
          getDriverTrips?.(currentUserId),
          getDriverStats?.(currentUserId),
          getDriverProfile?.(currentUserId),
          getDriverPayoutAvailability?.(currentUserId),
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
          earnedBalance: Number(stats.availableBalance || 0),
          availableBalance: availabilityResult?.success
            ? Number(availabilityResult.availableNowAmount || 0)
            : Number(stats.availableBalance || 0),
          pendingBalance: availabilityResult?.success
            ? Number(availabilityResult.pendingAmount || 0)
            : 0,
          pendingUntil: availabilityResult?.pendingUntil || null,
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
      getDriverPayoutAvailability,
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
    if (!currentUserId) {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const hasReturnedToForeground =
        (previousState === 'inactive' || previousState === 'background') && nextState === 'active';

      if (hasReturnedToForeground) {
        loadDriverDataRef.current?.(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentUserId]);

  useEffect(() => {
    const pendingUntil = driverStats.pendingUntil;
    const pendingBalance = Number(driverStats.pendingBalance || 0);

    if (!currentUserId || !pendingUntil || pendingBalance <= 0) {
      holdRefreshAttemptRef.current = null;
      return undefined;
    }

    const pendingUntilMs = new Date(pendingUntil).getTime();
    if (Number.isNaN(pendingUntilMs)) {
      return undefined;
    }

    const delayMs = pendingUntilMs - Date.now() + HOLD_REFRESH_GRACE_MS;
    const refreshKey = `${pendingUntil}:${pendingBalance}`;

    if (delayMs <= 0 && holdRefreshAttemptRef.current === refreshKey) {
      return undefined;
    }

    const boundedDelayMs = delayMs <= 0 ? 1000 : Math.min(delayMs, MAX_HOLD_REFRESH_DELAY_MS);

    const timer = setTimeout(() => {
      holdRefreshAttemptRef.current = refreshKey;
      loadDriverDataRef.current?.(true);
    }, boundedDelayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [currentUserId, driverStats.pendingBalance, driverStats.pendingUntil]);

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
