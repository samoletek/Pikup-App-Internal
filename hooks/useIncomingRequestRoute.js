import { useCallback, useEffect, useState } from 'react';
import { fetchIncomingRouteData } from '../screens/driver/DriverHomeScreen.utils';
import { logger } from '../services/logger';

export default function useIncomingRequestRoute({
  incomingRequest,
  showIncomingModal,
  isMinimized,
  mapboxToken,
}) {
  const [incomingRoute, setIncomingRoute] = useState(null);
  const [incomingMarkers, setIncomingMarkers] = useState(null);

  const clearIncomingRoute = useCallback(() => {
    setIncomingRoute(null);
    setIncomingMarkers(null);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const shouldLoadRoute = Boolean((showIncomingModal || isMinimized) && incomingRequest);
    if (!shouldLoadRoute) {
      clearIncomingRoute();
      return undefined;
    }

    const loadRoute = async () => {
      try {
        const routeData = await fetchIncomingRouteData({
          request: incomingRequest,
          mapboxToken,
        });

        if (isCancelled) {
          return;
        }

        if (!routeData) {
          clearIncomingRoute();
          return;
        }

        setIncomingRoute(routeData.route);
        setIncomingMarkers(routeData.markers);
      } catch (error) {
        if (!isCancelled) {
          logger.error('IncomingRequestRoute', 'Error fetching route', error);
          clearIncomingRoute();
        }
      }
    };

    void loadRoute();

    return () => {
      isCancelled = true;
    };
  }, [clearIncomingRoute, incomingRequest, isMinimized, mapboxToken, showIncomingModal]);

  return {
    incomingRoute,
    incomingMarkers,
    clearIncomingRoute,
  };
}
