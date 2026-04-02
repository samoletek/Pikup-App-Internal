import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import MapboxNavigationService from '../../services/MapboxNavigationService';
import { logger } from '../../services/logger';

const useMapboxNavigation = ({
  origin,
  destination,
  onRouteProgress,
  onArrival,
  onCancel
}) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const nativeNavigationAvailable = Platform.OS === 'ios' && MapboxNavigationService.isAvailable();

  useEffect(() => {
    if (!nativeNavigationAvailable) return;

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

    return () => {
      progressListener?.remove();
      arrivalListener?.remove();
      cancelListener?.remove();
    };
  }, [nativeNavigationAvailable, onRouteProgress, onArrival, onCancel]);

  const startNavigation = async () => {
    if (!nativeNavigationAvailable) {
      if (Platform.OS !== 'ios') {
        Alert.alert('Navigation', 'Turn-by-turn navigation is currently iOS only. Android support coming soon.');
      }
      return;
    }

    if (!origin || !destination) {
      logger.warn('MapboxNavigationHook', 'Cannot start navigation without origin and destination');
      return;
    }

    try {
      setIsNavigating(true);
      await MapboxNavigationService.startNavigation(origin, destination);
    } catch (error) {
      setIsNavigating(false);
      Alert.alert('Navigation Error', error.message);
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
