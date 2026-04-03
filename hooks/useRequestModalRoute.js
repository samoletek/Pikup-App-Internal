import { useCallback, useEffect, useRef, useState } from 'react';
import { appConfig } from '../config/appConfig';
import { buildFallbackRouteFeature } from '../components/requestModal/requestModalUtils';

export default function useRequestModalRoute({
  visible,
  showMap,
  requests = [],
  selectedIndex,
  mapRef,
}) {
  const routeRequestIdRef = useRef(null);
  const routeCacheRef = useRef(new Map());
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedRouteMarkers, setSelectedRouteMarkers] = useState(null);

  useEffect(() => {
    if (!visible || !showMap || requests.length === 0) {
      setSelectedRoute(null);
      setSelectedRouteMarkers(null);
      routeRequestIdRef.current = null;
      return;
    }

    const currentRequest = requests[selectedIndex];
    const pickup = currentRequest?.pickup?.coordinates;
    const dropoff = currentRequest?.dropoff?.coordinates;

    if (!pickup || !dropoff) {
      setSelectedRoute(null);
      setSelectedRouteMarkers(null);
      routeRequestIdRef.current = null;
      return;
    }

    const pickupPoint = [pickup.longitude, pickup.latitude];
    const dropoffPoint = [dropoff.longitude, dropoff.latitude];
    const fallbackRouteFeature = buildFallbackRouteFeature(pickupPoint, dropoffPoint);
    const requestId = String(currentRequest?.id || '');

    routeRequestIdRef.current = requestId;
    setSelectedRouteMarkers({ pickup: pickupPoint, dropoff: dropoffPoint });
    const cachedRoute = routeCacheRef.current.get(requestId);
    setSelectedRoute(cachedRoute || fallbackRouteFeature);

    const token = appConfig.mapbox.publicToken;
    if (!token) {
      return;
    }

    let cancelled = false;
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.longitude},${pickup.latitude};${dropoff.longitude},${dropoff.latitude}?geometries=geojson&overview=full&access_token=${token}`;

    const fetchRoute = async () => {
      try {
        const response = await fetch(directionsUrl);
        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry;
        if (!geometry || cancelled || routeRequestIdRef.current !== requestId) {
          return;
        }

        const resolvedRoute = {
          type: 'Feature',
          properties: {},
          geometry,
        };
        routeCacheRef.current.set(requestId, resolvedRoute);
        setSelectedRoute(resolvedRoute);
      } catch (_error) {
        // Keep fallback route when directions lookup fails.
      }
    };

    void fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [mapRef, requests, selectedIndex, showMap, visible]);

  const resetRoute = useCallback(() => {
    setSelectedRoute(null);
    setSelectedRouteMarkers(null);
    routeRequestIdRef.current = null;
  }, []);

  return {
    selectedRoute,
    selectedRouteMarkers,
    resetRoute,
  };
}
