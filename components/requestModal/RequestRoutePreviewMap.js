import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import MapboxMap from '../mapbox/MapboxMap';
import { colors } from '../../styles/theme';
import { appConfig } from '../../config/appConfig';
import { buildFallbackRouteFeature } from './requestModalUtils';

const routeCache = new Map();

const toCoordinatePair = (value) => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return [longitude, latitude];
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return toCoordinatePair(JSON.parse(trimmed));
      } catch (_error) {
        return null;
      }
    }

    if (trimmed.includes(',')) {
      const [firstPart, secondPart] = trimmed.split(',').map((part) => part.trim());
      const latitude = Number(firstPart);
      const longitude = Number(secondPart);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return [longitude, latitude];
      }
    }

    return null;
  }

  if (value?.coordinates) {
    const nestedCoordinates = toCoordinatePair(value.coordinates);
    if (nestedCoordinates) {
      return nestedCoordinates;
    }
  }

  if (value?.geometry?.coordinates) {
    const geometryCoordinates = toCoordinatePair(value.geometry.coordinates);
    if (geometryCoordinates) {
      return geometryCoordinates;
    }
  }

  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng ?? value?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [longitude, latitude];
};

const buildMapId = (requestId) => String(requestId || 'request-route-preview').replace(/[^a-zA-Z0-9_-]/g, '_');

export default function RequestRoutePreviewMap({ request, styles }) {
  const pickupPoint = useMemo(
    () =>
      toCoordinatePair(
        request?.pickup?.coordinates ||
          request?.pickupCoordinates ||
          request?.pickup_location
      ),
    [request]
  );
  const dropoffPoint = useMemo(
    () =>
      toCoordinatePair(
        request?.dropoff?.coordinates ||
          request?.dropoffCoordinates ||
          request?.dropoff_location
      ),
    [request]
  );
  const canRenderRoute = Boolean(pickupPoint && dropoffPoint);
  const fallbackRoute = useMemo(
    () => (canRenderRoute ? buildFallbackRouteFeature(pickupPoint, dropoffPoint) : null),
    [canRenderRoute, dropoffPoint, pickupPoint]
  );
  const cacheKey = String(
    request?.id ||
      (canRenderRoute ? `${pickupPoint.join(',')}:${dropoffPoint.join(',')}` : 'request-route-preview')
  );
  const [routeFeature, setRouteFeature] = useState(() => routeCache.get(cacheKey) || fallbackRoute);
  const mapId = buildMapId(cacheKey);
  const centerCoordinate = canRenderRoute
    ? [
        (pickupPoint[0] + dropoffPoint[0]) / 2,
        (pickupPoint[1] + dropoffPoint[1]) / 2,
      ]
    : [-84.388, 33.749];

  useEffect(() => {
    if (!canRenderRoute) {
      setRouteFeature(null);
      return;
    }
    setRouteFeature(routeCache.get(cacheKey) || fallbackRoute);
  }, [cacheKey, canRenderRoute, fallbackRoute]);

  useEffect(() => {
    if (!canRenderRoute) {
      return undefined;
    }
    if (routeCache.has(cacheKey)) {
      return undefined;
    }

    const token = appConfig.mapbox.publicToken;
    if (!token) {
      return undefined;
    }

    let isCancelled = false;
    const directionsUrl =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${pickupPoint[0]},${pickupPoint[1]};${dropoffPoint[0]},${dropoffPoint[1]}` +
      `?geometries=geojson&overview=simplified&access_token=${token}`;

    const fetchRoute = async () => {
      try {
        const response = await fetch(directionsUrl);
        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry;
        if (!geometry || isCancelled) {
          return;
        }

        const resolvedRoute = {
          type: 'Feature',
          properties: {},
          geometry,
        };

        routeCache.set(cacheKey, resolvedRoute);
        setRouteFeature(resolvedRoute);
      } catch (_error) {
        // Keep fallback line route in preview when lookup fails.
      }
    };

    void fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, canRenderRoute, dropoffPoint, pickupPoint]);

  if (!canRenderRoute || !routeFeature) {
    return null;
  }

  return (
    <View style={styles.routePreviewContainer}>
      <MapboxMap
        style={styles.routePreviewMap}
        centerCoordinate={centerCoordinate}
        zoomLevel={10.5}
        animationDuration={0}
        customMapStyle={Mapbox.StyleURL.Dark}
        scrollEnabled={false}
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        attributionEnabled={false}
        logoEnabled
      >
        <Mapbox.ShapeSource id={`${mapId}_source`} shape={routeFeature}>
          <Mapbox.LineLayer
            id={`${mapId}_line`}
            style={{
              lineColor: colors.primary,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.MarkerView
          id={`${mapId}_pickup`}
          coordinate={pickupPoint}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <View style={[styles.routePreviewMarker, styles.routePreviewMarkerPickup]} />
        </Mapbox.MarkerView>

        <Mapbox.MarkerView
          id={`${mapId}_dropoff`}
          coordinate={dropoffPoint}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <View style={[styles.routePreviewMarker, styles.routePreviewMarkerDropoff]} />
        </Mapbox.MarkerView>
      </MapboxMap>
    </View>
  );
}
