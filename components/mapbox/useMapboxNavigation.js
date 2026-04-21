import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import MapboxNavigationService from '../../services/MapboxNavigationService';
import { logger } from '../../services/logger';

const useMapboxNavigation = ({
  origin,
  destination,
  navigationOptions,
  onRouteProgress,
  onArrival,
  onCancel,
  onReroute,
  onPrimaryAction,
  onSecondaryAction,
  onChatAction,
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const nativeNavigationAvailable = MapboxNavigationService.isAvailable();
  const callbacksRef = useRef({
    onRouteProgress,
    onArrival,
    onCancel,
    onReroute,
    onPrimaryAction,
    onSecondaryAction,
    onChatAction,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRouteProgress,
      onArrival,
      onCancel,
      onReroute,
      onPrimaryAction,
      onSecondaryAction,
      onChatAction,
    };
  }, [
    onRouteProgress,
    onArrival,
    onCancel,
    onReroute,
    onPrimaryAction,
    onSecondaryAction,
    onChatAction,
  ]);

  useEffect(() => {
    // Register native listeners once and delegate to latest callbacks via refs.
    const progressListener = MapboxNavigationService.addListener('onRouteProgress', (data) => {
      callbacksRef.current.onRouteProgress?.(data);
    });

    const arrivalListener = MapboxNavigationService.addListener('onArrival', (data) => {
      callbacksRef.current.onArrival?.(data);
      setIsNavigating(false);
    });

    const cancelListener = MapboxNavigationService.addListener('onCancel', (data) => {
      callbacksRef.current.onCancel?.(data);
      setIsNavigating(false);
    });

    const rerouteListener = MapboxNavigationService.addListener('onReroute', (data) => {
      callbacksRef.current.onReroute?.(data);
    });

    const primaryActionListener = MapboxNavigationService.addListener('onPrimaryAction', (data) => {
      callbacksRef.current.onPrimaryAction?.(data);
    });

    const secondaryActionListener = MapboxNavigationService.addListener('onSecondaryAction', (data) => {
      callbacksRef.current.onSecondaryAction?.(data);
    });

    const chatActionListener = MapboxNavigationService.addListener('onChatAction', (data) => {
      callbacksRef.current.onChatAction?.(data);
    });

    return () => {
      progressListener?.remove();
      arrivalListener?.remove();
      cancelListener?.remove();
      rerouteListener?.remove();
      primaryActionListener?.remove();
      secondaryActionListener?.remove();
      chatActionListener?.remove();
    };
  }, [nativeNavigationAvailable]);

  const startNavigation = async ({
    showAlert = true,
    options,
    origin: originOverride = null,
    destination: destinationOverride = null,
  } = {}) => {
    const supportsNativeNavigation = MapboxNavigationService.isAvailable();
    if (!supportsNativeNavigation) {
      logger.warn(
        'MapboxNavigationHook',
        'Native module availability check returned false; attempting start anyway'
      );
    }

    const resolvedOrigin = originOverride || origin;
    const resolvedDestination = destinationOverride || destination;

    if (!resolvedOrigin || !resolvedDestination) {
      logger.warn('MapboxNavigationHook', 'Cannot start navigation without origin and destination');
      if (showAlert) {
        Alert.alert('Navigation Error', 'Unable to start navigation without route coordinates.');
      }
      return false;
    }

    try {
      setIsNavigating(true);
      const resolvedOptions = options || navigationOptions || {};
      const executeStart = () => MapboxNavigationService.startNavigation(
        resolvedOrigin,
        resolvedDestination,
        resolvedOptions
      );

      let result = await executeStart();
      if (result?.started === false && result?.alreadyActive) {
        logger.warn(
          'MapboxNavigationHook',
          'Native navigation reported an active stale session, attempting recovery'
        );
        await MapboxNavigationService.stopNavigation();
        result = await executeStart();
      }
      const started = !(result && result.started === false);

      if (!started) {
        setIsNavigating(false);
        if (showAlert) {
          Alert.alert('Navigation', 'Navigation session could not be started.');
        }
      }

      return started;
    } catch (error) {
      setIsNavigating(false);
      if (showAlert) {
        Alert.alert('Navigation Error', error.message);
      }
      logger.error('MapboxNavigationHook', 'Native navigation start failed', error);
      return false;
    }
  };

  const stopNavigation = async (options = {}) => {
    const { showAlert = true } = options;

    try {
      await MapboxNavigationService.stopNavigation();
      setIsNavigating(false);
    } catch (error) {
      if (showAlert) {
        Alert.alert('Error', 'Failed to stop navigation');
      } else {
        logger.warn('MapboxNavigationHook', 'Failed to stop navigation silently', error);
      }
    }
  };

  const updateNavigationOptions = async (options = {}) => {
    try {
      return await MapboxNavigationService.updateNavigationOptions(options);
    } catch (error) {
      logger.warn('MapboxNavigationHook', 'Failed to update navigation options', error);
      return { updated: false, reason: 'update_failed' };
    }
  };

  const acknowledgeNavigationAction = async (actionToken) => {
    try {
      return await MapboxNavigationService.acknowledgeNavigationAction(actionToken);
    } catch (error) {
      logger.warn('MapboxNavigationHook', 'Failed to acknowledge navigation action', error);
      return { acknowledged: false, reason: 'ack_failed' };
    }
  };

  const completeNavigationAction = async (actionToken, success = true) => {
    try {
      return await MapboxNavigationService.completeNavigationAction(actionToken, success);
    } catch (error) {
      logger.warn('MapboxNavigationHook', 'Failed to complete navigation action', error);
      return { completed: false, reason: 'complete_failed' };
    }
  };

  return {
    startNavigation,
    stopNavigation,
    updateNavigationOptions,
    acknowledgeNavigationAction,
    completeNavigationAction,
    isNavigating,
    isSupported: nativeNavigationAvailable
  };
};

export default useMapboxNavigation;
