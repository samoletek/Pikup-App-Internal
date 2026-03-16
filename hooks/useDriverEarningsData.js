import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToDriverEarningsUpdates } from '../services/DriverService';
import { logger } from '../services/logger';
import {
  getMockWeeklyData,
  processTripsIntoChartData,
} from '../screens/driver/earnings/earningsUtils';

const DEFAULT_STATS = {
  currentWeekTrips: 0,
  totalEarnings: 0,
  availableBalance: 0,
  weeklyMilestone: 15,
};

export default function useDriverEarningsData({
  currentUserId,
  selectedPeriod,
  getDriverTrips,
  getDriverStats,
  getDriverProfile,
}) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState(DEFAULT_STATS);
  const [driverProfile, setDriverProfile] = useState(null);
  const loadDriverDataRef = useRef(null);

  const loadDriverData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const trips = (await getDriverTrips?.(currentUserId)) || [];
        const stats = (await getDriverStats?.(currentUserId)) || {};
        const profile = (await getDriverProfile?.(currentUserId)) || {};

        setDriverTrips(trips);
        setDriverProfile(profile);
        setDriverStats({
          currentWeekTrips: stats.currentWeekTrips || 0,
          totalEarnings: stats.totalEarnings || 0,
          availableBalance: stats.availableBalance || 0,
          weeklyMilestone: 15,
        });
        setWeeklyData(processTripsIntoChartData(trips, selectedPeriod));
      } catch (error) {
        logger.error('DriverEarningsData', 'Error loading driver earnings data', error);
        if (!silent) {
          setWeeklyData(getMockWeeklyData());
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [currentUserId, getDriverProfile, getDriverStats, getDriverTrips, selectedPeriod]
  );

  loadDriverDataRef.current = loadDriverData;

  useEffect(() => {
    if (!currentUserId) {
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
