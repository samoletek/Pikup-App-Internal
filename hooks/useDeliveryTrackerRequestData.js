import { useCallback, useEffect, useRef, useState } from 'react';
import { TRIP_STATUS } from '../constants/tripStatus';
import { logger } from '../services/logger';

export default function useDeliveryTrackerRequestData({
  requestId,
  getRequestById,
  onDeliveryComplete,
}) {
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);

  const fetchRequestData = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await getRequestById(requestId);
      setRequestData(data);
      setError(null);
    } catch (err) {
      logger.error('DeliveryTrackerRequestData', 'Error fetching request data', err);
      setError('Unable to load delivery status');
    } finally {
      setLoading(false);
    }
  }, [getRequestById, requestId]);

  useEffect(() => {
    if (requestId) {
      fetchRequestData();

      const interval = setInterval(() => {
        fetchRequestData(false);
      }, 15000);

      refreshIntervalRef.current = interval;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchRequestData, requestId]);

  useEffect(() => {
    if (requestData && requestData.status === TRIP_STATUS.COMPLETED && onDeliveryComplete) {
      onDeliveryComplete(requestData);

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [requestData, onDeliveryComplete]);

  return {
    requestData,
    loading,
    error,
    fetchRequestData,
  };
}
