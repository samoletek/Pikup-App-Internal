import { useCallback, useEffect, useRef, useState } from 'react';
import { REQUEST_POOLS } from '../screens/driver/DriverHomeScreen.utils';
import { getTripScheduledAtMs } from '../constants/tripStatus';
import { logger } from '../services/logger';

const AUTO_REFRESH_INTERVAL_MS = 10000;

const dedupeRequestsById = (requests = []) => {
  const seenIds = new Set();
  const deduped = [];

  (Array.isArray(requests) ? requests : []).forEach((request) => {
    const requestId = String(request?.id || '').trim();

    if (!requestId) {
      deduped.push(request);
      return;
    }

    if (seenIds.has(requestId)) {
      return;
    }

    seenIds.add(requestId);
    deduped.push(request);
  });

  return deduped;
};

const isScheduledRequest = (request) => Number.isFinite(getTripScheduledAtMs(request));

const filterRequestsByPool = (requests = [], requestPool) => {
  if (requestPool === REQUEST_POOLS.ASAP) {
    return requests.filter((request) => !isScheduledRequest(request));
  }

  if (requestPool === REQUEST_POOLS.SCHEDULED) {
    return requests.filter((request) => isScheduledRequest(request));
  }

  return requests;
};

export default function useDriverRequestsFeed({
  activeRequestPool,
  checkExpiredRequests,
  clearIncomingRoute,
  driverLocation,
  getAvailableRequests,
  hasActiveTrip,
  incomingRequestIdRef,
  isOnline,
  setIncomingRequest,
  setIsMinimized,
  setShowAllRequests,
  setShowIncomingModal,
}) {
  const [availableRequests, setAvailableRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const backgroundRefreshInterval = useRef(null);
  const driverLocationRef = useRef(driverLocation);
  const previousRequestPoolRef = useRef(activeRequestPool);

  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  const clearAutoRefresh = useCallback(() => {
    if (backgroundRefreshInterval.current) {
      clearInterval(backgroundRefreshInterval.current);
      backgroundRefreshInterval.current = null;
    }
  }, []);

  const loadRequests = useCallback(
    async (showLoading = true, requestPoolOverride = null) => {
      if (hasActiveTrip) {
        setAvailableRequests([]);
        setShowAllRequests(false);
        return;
      }

      const effectiveRequestPool = requestPoolOverride || activeRequestPool;

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        logger.info('DriverRequestsFeed', 'Loading available pickup requests');

        const requests = await getAvailableRequests({
          requestPool: effectiveRequestPool,
          driverLocation: driverLocationRef.current,
        });
        const normalizedRequests = Array.isArray(requests) ? requests : [];
        const dedupedRequests = dedupeRequestsById(normalizedRequests);
        const poolScopedRequests = filterRequestsByPool(dedupedRequests, effectiveRequestPool);

        setAvailableRequests(poolScopedRequests);

        if (dedupedRequests.length !== normalizedRequests.length) {
          logger.warn('DriverRequestsFeed', 'Removed duplicate requests from feed payload', {
            originalCount: normalizedRequests.length,
            dedupedCount: dedupedRequests.length,
            duplicateCount: normalizedRequests.length - dedupedRequests.length,
          });
        }

        if (poolScopedRequests.length !== dedupedRequests.length) {
          logger.warn('DriverRequestsFeed', 'Dropped cross-pool requests from feed payload', {
            requestPool: effectiveRequestPool,
            dedupedCount: dedupedRequests.length,
            filteredCount: poolScopedRequests.length,
            droppedCount: dedupedRequests.length - poolScopedRequests.length,
          });
        }

        const visibleRequestIds = new Set(
          poolScopedRequests.map((item) => String(item?.id || '')).filter(Boolean)
        );
        const currentIncomingId = String(incomingRequestIdRef.current || '').trim();

        if (currentIncomingId && !visibleRequestIds.has(currentIncomingId)) {
          setShowIncomingModal(false);
          setIsMinimized(false);
          setIncomingRequest(null);
          clearIncomingRoute();
        }

        if (effectiveRequestPool === REQUEST_POOLS.SCHEDULED) {
          setShowIncomingModal(false);
          setIsMinimized(false);
          setIncomingRequest(null);
        } else {
          setShowAllRequests(false);
        }
        logger.info('DriverRequestsFeed', 'Loaded requests from backend', {
          count: poolScopedRequests.length,
          requestPool: effectiveRequestPool,
        });
      } catch (loadError) {
        logger.error('DriverRequestsFeed', 'Error loading requests', loadError);
        setError('Could not load available requests');
        setAvailableRequests([]);
        if (effectiveRequestPool !== REQUEST_POOLS.SCHEDULED) {
          setShowAllRequests(false);
        }
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [
      activeRequestPool,
      clearIncomingRoute,
      getAvailableRequests,
      hasActiveTrip,
      incomingRequestIdRef,
      setIncomingRequest,
      setIsMinimized,
      setShowAllRequests,
      setShowIncomingModal,
    ]
  );

  useEffect(() => {
    const previousPool = previousRequestPoolRef.current;
    previousRequestPoolRef.current = activeRequestPool;

    if (previousPool === activeRequestPool) {
      return;
    }

    setAvailableRequests([]);
    setShowIncomingModal(false);
    setIsMinimized(false);
    setIncomingRequest(null);
    clearIncomingRoute();

    logger.info('DriverRequestsFeed', 'Request pool switched. Cleared stale requests.', {
      previousPool,
      activeRequestPool,
    });
  }, [
    activeRequestPool,
    clearIncomingRoute,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
  ]);

  useEffect(() => {
    if (isOnline) {
      return;
    }

    setAvailableRequests([]);
    setShowIncomingModal(false);
    setIsMinimized(false);
    setIncomingRequest(null);
    clearIncomingRoute();
  }, [
    clearIncomingRoute,
    isOnline,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
  ]);

  const startAutoRefresh = useCallback(() => {
    logger.info('DriverRequestsFeed', 'Starting auto-refresh');

    backgroundRefreshInterval.current = setInterval(async () => {
      if (!isOnline || hasActiveTrip) {
        return;
      }

      logger.debug('DriverRequestsFeed', 'Background refresh of requests');

      try {
        const expiredCount = await checkExpiredRequests();
        if (expiredCount > 0) {
          logger.info('DriverRequestsFeed', 'Reset expired requests', { expiredCount });
        }
      } catch (expiredError) {
        logger.error('DriverRequestsFeed', 'Error checking expired requests', expiredError);
      }

      void loadRequests(false);
    }, AUTO_REFRESH_INTERVAL_MS);
  }, [checkExpiredRequests, hasActiveTrip, isOnline, loadRequests]);

  useEffect(() => {
    if (isOnline && !hasActiveTrip) {
      clearAutoRefresh();
      startAutoRefresh();
      void loadRequests(false, activeRequestPool);
      return;
    }

    clearAutoRefresh();
  }, [
    activeRequestPool,
    clearAutoRefresh,
    hasActiveTrip,
    isOnline,
    loadRequests,
    startAutoRefresh,
  ]);

  useEffect(() => () => {
    clearAutoRefresh();
  }, [clearAutoRefresh]);

  return {
    availableRequests,
    setAvailableRequests,
    loading,
    setLoading,
    error,
    loadRequests,
    clearAutoRefresh,
  };
}
