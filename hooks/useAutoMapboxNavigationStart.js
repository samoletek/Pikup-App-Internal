import { useCallback, useEffect, useRef } from 'react';
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
  maxRetries = 3,
  retryDelayMs = 900,
}) {
  const retryTimeoutRef = useRef(null);
  const attemptRef = useRef(0);

  const scheduleNextAttempt = useCallback((delayMs = retryDelayMs) => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    retryTimeoutRef.current = setTimeout(() => {
      setNavigationAttempted(false);
      retryTimeoutRef.current = null;
    }, delayMs);
  }, [retryDelayMs, setNavigationAttempted]);

  useEffect(() => () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      attemptRef.current = 0;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    if (isNavigating || navigationAttempted) {
      return;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setNavigationAttempted(true);

    startNavigation({ showAlert: false })
      .then((started) => {
        if (!started) {
          if (attempt < maxRetries) {
            logger.warn(logScope, `${fallbackLogMessage}, retrying`, {
              reason: 'native_navigation_not_started',
              attempt,
              maxRetries,
              isSupported,
            });
            scheduleNextAttempt();
            return;
          }

          logger.warn(logScope, fallbackLogMessage, {
            reason: 'native_navigation_not_started',
            attempt,
            maxRetries,
            isSupported,
          });
          attemptRef.current = 0;
          scheduleNextAttempt(retryDelayMs * 2);
          return;
        }

        attemptRef.current = 0;
      })
      .catch((error) => {
        if (attempt < maxRetries) {
          logger.warn(logScope, `${fallbackLogMessage}, retrying`, {
            attempt,
            maxRetries,
            isSupported,
            error,
          });
          scheduleNextAttempt();
          return;
        }

        logger.warn(logScope, fallbackLogMessage, {
          error,
          isSupported,
          attempt,
          maxRetries,
        });
        attemptRef.current = 0;
        scheduleNextAttempt(retryDelayMs * 2);
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
    maxRetries,
    retryDelayMs,
    scheduleNextAttempt,
  ]);
}
