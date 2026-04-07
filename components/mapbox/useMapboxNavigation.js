import { useEffect, useState } from 'react';
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
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const nativeNavigationAvailable = MapboxNavigationService.isAvailable();

  useEffect(() => {
    // Set up event listeners
    const progressListener = MapboxNavigationService.addListener('onRouteProgress', (data) => {
      if (onRouteProgress) onRouteProgress(data);
    });

    const arrivalListener = MapboxNavigationService.addListener('onArrival', (data) => {
      if (onArrival) onArrival(data);
      setIsNavigating(false);
    });

    const cancelListener = MapboxNavigationService.addListener('onCancel', (data) => {
      if (onCancel) onCancel(data);
      setIsNavigating(false);
    });

    const rerouteListener = MapboxNavigationService.addListener('onReroute', (data) => {
      if (onReroute) onReroute(data);
    });

    const primaryActionListener = MapboxNavigationService.addListener('onPrimaryAction', (data) => {
      if (onPrimaryAction) onPrimaryAction(data);
    });

    const secondaryActionListener = MapboxNavigationService.addListener('onSecondaryAction', (data) => {
      if (onSecondaryAction) onSecondaryAction(data);
    });

    return () => {
      progressListener?.remove();
      arrivalListener?.remove();
      cancelListener?.remove();
      rerouteListener?.remove();
      primaryActionListener?.remove();
      secondaryActionListener?.remove();
    };
  }, [
    nativeNavigationAvailable,
    onRouteProgress,
    onArrival,
    onCancel,
    onReroute,
    onPrimaryAction,
    onSecondaryAction,
  ]);

  const startNavigation = async ({ showAlert = true, options } = {}) => {
    const supportsNativeNavigation = MapboxNavigationService.isAvailable();
    if (!supportsNativeNavigation) {
      logger.warn(
        'MapboxNavigationHook',
        'Native module availability check returned false; attempting start anyway'
      );
    }

    if (!origin || !destination) {
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
        origin,
        destination,
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

  return {
    startNavigation,
    stopNavigation,
    isNavigating,
    isSupported: nativeNavigationAvailable
  };
};

export default useMapboxNavigation;
