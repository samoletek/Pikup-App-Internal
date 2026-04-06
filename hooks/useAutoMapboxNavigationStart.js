import { useEffect } from 'react';
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
      !isSupported ||
      isNavigating ||
      navigationAttempted
    ) {
      return;
    }

    setNavigationAttempted(true);

    startNavigation({ showAlert: false })
      .then((started) => {
        if (!started) {
          logger.warn(logScope, fallbackLogMessage, { reason: 'native_navigation_not_started' });
        }
      })
      .catch((error) => {
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
