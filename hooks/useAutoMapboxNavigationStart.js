import { useEffect } from 'react';
import { Platform } from 'react-native';
import { logger } from '../services/logger';

export default function useAutoMapboxNavigationStart({
  enabled = true,
  isSupported,
  isNavigating,
  navigationAttempted,
  setNavigationAttempted,
  startNavigation,
  logScope = 'Navigation',
  fallbackLogMessage = 'Mapbox navigation unavailable, using fallback map',
}) {
  useEffect(() => {
    if (
      !enabled ||
      Platform.OS !== 'ios' ||
      !isSupported ||
      isNavigating ||
      navigationAttempted
    ) {
      return;
    }

    setNavigationAttempted(true);

    startNavigation().catch((error) => {
      logger.warn(logScope, fallbackLogMessage, error);
    });
  }, [
    enabled,
    isNavigating,
    isSupported,
    navigationAttempted,
    setNavigationAttempted,
    startNavigation,
    logScope,
    fallbackLogMessage,
  ]);
}
