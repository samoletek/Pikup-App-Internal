import { useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useTripActions } from '../contexts/AuthContext';
import { logger } from '../services/logger';

/**
 * Custom hook to monitor order status changes, specifically for cancellation detection
 * @param {string} requestId - The ID of the request to monitor
 * @param {Object} navigation - Navigation object for screen transitions
 * @param {Object} options - Configuration options
 * @param {number} options.pollingInterval - How often to check status (ms, default: 5000)
 * @param {boolean} options.enabled - Whether monitoring is enabled (default: true)
 * @param {string} options.currentScreen - Current screen name for logging
 * @param {function} options.onCancel - Optional callback when cancellation is detected
 * @param {function} options.onError - Optional callback for handling errors
 */
const useOrderStatusMonitor = (requestId, navigation, options = {}) => {
  const {
    pollingInterval = 5000,
    enabled = true,
    currentScreen = 'Unknown',
    onCancel,
    onError
  } = options;

  const { getRequestById } = useTripActions();
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const lastStatusRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Maximum retry attempts for failed API calls
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  /**
   * Check request status with retry logic
   */
  const checkRequestStatus = useCallback(async (requestId, retries = MAX_RETRIES) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const request = await getRequestById(requestId);
        retryCountRef.current = 0; // Reset retry count on success
        return request;
      } catch (error) {
        logger.warn(
          'OrderStatusMonitor',
          `[${currentScreen}] Status check attempt ${attempt + 1} failed`,
          error?.message
        );
        
        if (attempt === retries - 1) {
          // Final attempt failed
          throw new Error(`Failed to check order status after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
      }
    }
  }, [getRequestById, currentScreen]);

  /**
   * Handle order cancellation
   */
  const handleCancellation = useCallback((request) => {
    logger.info('OrderStatusMonitor', `[${currentScreen}] Order ${requestId} was cancelled`);
    
    // Stop monitoring
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Call custom onCancel callback if provided
    const cancelHandler = onCancelRef.current;
    if (cancelHandler) {
      cancelHandler(request);
      return;
    }
    
    // Default cancellation handling
    Alert.alert(
      'Order Cancelled',
      'The customer has cancelled this order.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to driver home and clear the navigation stack
            navigation.reset({
              index: 0,
              routes: [{ name: 'DriverHomeScreen' }],
            });
          }
        }
      ],
      { cancelable: false }
    );
  }, [currentScreen, requestId, navigation]);

  /**
   * Handle monitoring errors
   */
  const handleError = useCallback((error) => {
    logger.error('OrderStatusMonitor', `[${currentScreen}] Order status monitoring error`, error);
    
    retryCountRef.current += 1;
    
    // If we've exceeded retry attempts, stop monitoring
    if (retryCountRef.current >= MAX_RETRIES) {
      logger.error(
        'OrderStatusMonitor',
        `[${currentScreen}] Stopping monitoring after ${MAX_RETRIES} consecutive failures`
      );
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Call custom error handler if provided
      const errorHandler = onErrorRef.current;
      if (errorHandler) {
        errorHandler(error);
      }
    }
  }, [currentScreen]);

  /**
   * Main monitoring function
   */
  const monitorOrderStatus = useCallback(async () => {
    if (!isMountedRef.current || !requestId) {
      return;
    }

    try {
      const request = await checkRequestStatus(requestId);
      
      if (!isMountedRef.current) {
        return; // Component unmounted during async operation
      }

      // Log status changes for debugging
      if (request.status !== lastStatusRef.current) {
        logger.info(
          'OrderStatusMonitor',
          `[${currentScreen}] Order ${requestId} status changed`,
          { from: lastStatusRef.current, to: request.status }
        );
        lastStatusRef.current = request.status;
      }

      // Check for cancellation
      if (request.status === 'cancelled') {
        handleCancellation(request);
      }

    } catch (error) {
      if (!isMountedRef.current) {
        return; // Component unmounted during async operation
      }
      
      handleError(error);
    }
  }, [requestId, checkRequestStatus, handleCancellation, handleError, currentScreen]);

  /**
   * Start monitoring
   */
  const startMonitoring = useCallback(() => {
    if (!requestId || !enabled || intervalRef.current) {
      return;
    }

    logger.info('OrderStatusMonitor', `[${currentScreen}] Starting monitoring for request ${requestId}`);
    
    // Initial check
    monitorOrderStatus();
    
    // Set up polling
    intervalRef.current = setInterval(monitorOrderStatus, pollingInterval);
  }, [requestId, enabled, currentScreen, monitorOrderStatus, pollingInterval]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      logger.info('OrderStatusMonitor', `[${currentScreen}] Stopping monitoring for request ${requestId}`);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [currentScreen, requestId]);

  // Main effect to handle monitoring lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    
    if (requestId && enabled) {
      startMonitoring();
    }
    
    return () => {
      isMountedRef.current = false;
      stopMonitoring();
    };
  }, [enabled, requestId, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Return control functions for advanced usage
  return {
    startMonitoring,
    stopMonitoring,
    isMonitoring: !!intervalRef.current
  };
};

export default useOrderStatusMonitor;
