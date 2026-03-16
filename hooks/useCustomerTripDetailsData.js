import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRIP_STATUS, normalizeTripStatus } from '../constants/tripStatus';
import { logger } from '../services/logger';
import { subscribeToTripUpdates } from '../services/tripRealtimeService';
import {
  TRIP_DETAILS_AUTO_SYNC_INTERVAL_MS,
  resolvePhotoUrisAsync,
  toDisplayTrip,
} from '../screens/customer/CustomerTripDetailsScreen.utils';

export default function useCustomerTripDetailsData({
  getRequestById,
  initialSnapshot,
  isMockTrip,
  tripId,
  tripSummary,
}) {
  const [tripData, setTripData] = useState(initialSnapshot);
  const [loading, setLoading] = useState(!isMockTrip && Boolean(tripId));
  const [refreshing, setRefreshing] = useState(false);
  const [pickupPhotoUris, setPickupPhotoUris] = useState([]);
  const [dropoffPhotoUris, setDropoffPhotoUris] = useState([]);

  const displayTrip = useMemo(
    () => toDisplayTrip(tripData, tripSummary),
    [tripData, tripSummary]
  );

  const loadTrip = useCallback(
    async ({ refresh = false, silent = false } = {}) => {
      if (!tripId || isMockTrip) {
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
      }

      try {
        const latest = await getRequestById(tripId);
        if (latest) {
          setTripData((prev) => ({ ...(prev || {}), ...latest }));
        }
      } catch (error) {
        logger.error('CustomerTripDetailsData', 'Error loading trip details', error);
      } finally {
        if (refresh) {
          setRefreshing(false);
        } else if (!silent) {
          setLoading(false);
        }
      }
    },
    [tripId, isMockTrip, getRequestById]
  );

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!tripId || isMockTrip) {
      return undefined;
    }

    let refreshTimer = null;
    const scheduleRefresh = (delayMs = 120) => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void loadTrip({ silent: true });
      }, delayMs);
    };

    const unsubscribe = subscribeToTripUpdates({
      tripId,
      onTripUpdate: (nextTrip) => {
        setTripData((prev) => ({ ...(prev || {}), ...nextTrip }));
        scheduleRefresh();
      },
      onSubscriptionStatus: (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('CustomerTripDetailsData', `Trip details realtime ${status.toLowerCase()} for ${tripId}`);
        }
      },
    });

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      unsubscribe();
    };
  }, [tripId, isMockTrip, loadTrip]);

  useEffect(() => {
    if (!tripId || isMockTrip) {
      return undefined;
    }

    const normalizedStatus = normalizeTripStatus(displayTrip.status);
    if (normalizedStatus === TRIP_STATUS.COMPLETED || normalizedStatus === TRIP_STATUS.CANCELLED) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      void loadTrip({ silent: true });
    }, TRIP_DETAILS_AUTO_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [tripId, isMockTrip, displayTrip.status, loadTrip]);

  useEffect(() => {
    let isCancelled = false;

    const loadPickupPhotoUris = async () => {
      const resolved = await resolvePhotoUrisAsync(displayTrip.pickupPhotos);
      if (!isCancelled) {
        setPickupPhotoUris(resolved);
      }
    };

    void loadPickupPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [displayTrip.id, displayTrip.pickupPhotos]);

  useEffect(() => {
    let isCancelled = false;

    const loadDropoffPhotoUris = async () => {
      const resolved = await resolvePhotoUrisAsync(displayTrip.dropoffPhotos);
      if (!isCancelled) {
        setDropoffPhotoUris(resolved);
      }
    };

    void loadDropoffPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [displayTrip.id, displayTrip.dropoffPhotos]);

  return {
    tripData,
    loading,
    refreshing,
    displayTrip,
    pickupPhotoUris,
    dropoffPhotoUris,
    loadTrip,
  };
}
