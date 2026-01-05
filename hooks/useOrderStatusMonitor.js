import { useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

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

  const { getRequestById } = useAuth();
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const lastStatusRef = useRef(null);

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
        console.warn(`[${currentScreen}] Status check attempt ${attempt + 1} failed:`, error.message);
        
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
    console.log(`[${currentScreen}] Order ${requestId} was cancelled`);
    
    // Stop monitoring
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Call custom onCancel callback if provided
    if (onCancel) {
      onCancel(request);
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
  }, [currentScreen, requestId, onCancel, navigation]);

  /**
   * Handle monitoring errors
   */
  const handleError = useCallback((error) => {
    console.error(`[${currentScreen}] Order status monitoring error:`, error);
    
    retryCountRef.current += 1;
    
    // If we've exceeded retry attempts, stop monitoring
    if (retryCountRef.current >= MAX_RETRIES) {
      console.error(`[${currentScreen}] Stopping monitoring after ${MAX_RETRIES} consecutive failures`);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Call custom error handler if provided
      if (onError) {
        onError(error);
      }
    }
  }, [currentScreen, onError]);

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
        console.log(`[${currentScreen}] Order ${requestId} status changed: ${lastStatusRef.current} → ${request.status}`);
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

    console.log(`[${currentScreen}] Starting order status monitoring for request ${requestId}`);
    
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
      console.log(`[${currentScreen}] Stopping order status monitoring for request ${requestId}`);
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
  }, [requestId, enabled]);

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