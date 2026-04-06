import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Mapbox from '@rnmapbox/maps';
import { ensureMapboxConfigured } from '../../config/mapbox';
import { logger } from '../../services/logger';

ensureMapboxConfigured();

const DEFAULT_CENTER_COORDINATE = [-84.388, 33.749];
const DEFAULT_EDGE_PADDING = [100, 100, 100, 100];

const isValidCoordinate = (coordinate) =>
  Array.isArray(coordinate) &&
  coordinate.length >= 2 &&
  Number.isFinite(Number(coordinate[0])) &&
  Number.isFinite(Number(coordinate[1]));

const normalizeEdgePadding = (paddingConfig = DEFAULT_EDGE_PADDING) => {
  if (typeof paddingConfig === 'number') {
    return paddingConfig;
  }

  if (Array.isArray(paddingConfig)) {
    return paddingConfig;
  }

  if (paddingConfig && typeof paddingConfig === 'object') {
    return [
      Number(paddingConfig.top) || 0,
      Number(paddingConfig.right) || 0,
      Number(paddingConfig.bottom) || 0,
      Number(paddingConfig.left) || 0,
    ];
  }

  return DEFAULT_EDGE_PADDING;
};

const buildCoordinateBounds = (coordinates = []) => {
  const validCoordinates = coordinates
    .filter((coordinate) => Number.isFinite(Number(coordinate?.longitude)) && Number.isFinite(Number(coordinate?.latitude)))
    .map((coordinate) => [Number(coordinate.longitude), Number(coordinate.latitude)]);

  if (validCoordinates.length === 0) {
    return null;
  }

  const [firstLongitude, firstLatitude] = validCoordinates[0];
  let minLongitude = firstLongitude;
  let maxLongitude = firstLongitude;
  let minLatitude = firstLatitude;
  let maxLatitude = firstLatitude;

  validCoordinates.forEach(([longitude, latitude]) => {
    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  });

  return {
    northeast: [maxLongitude, maxLatitude],
    southwest: [minLongitude, minLatitude],
    singlePoint: validCoordinates.length === 1,
  };
};

const MapboxMap = forwardRef(({
  style,
  children,
  onPress,
  centerCoordinate,
  zoomLevel = 14,
  customMapStyle,
  // New navigation props for Apple Maps style
  pitch = 0,
  bearing = 0,
  animationDuration = 1000,
  padding = { top: 0, bottom: 0, left: 0, right: 0 },
  followUserLocation = false,
  followUserMode = 'normal', // 'normal', 'course', 'compass'
  ...props
}, ref) => {
  const cameraRef = useRef(null);
  const mapViewRef = useRef(null);

  // Expose camera control methods to parent components
  useImperativeHandle(ref, () => ({
    // Apple Maps style camera setter
    setCamera: (config) => {
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: isValidCoordinate(config?.centerCoordinate)
            ? config.centerCoordinate
            : (centerCoordinate || DEFAULT_CENTER_COORDINATE),
          zoomLevel: config.zoomLevel ?? zoomLevel,
          pitch: config.pitch !== undefined ? config.pitch : pitch,
          heading: config.bearing ?? bearing,
          animationDuration: config.animationDuration ?? animationDuration,
          padding: config.padding ?? padding,
        });
      }
    },
    // Legacy method for backward compatibility
    animateToRegion: (region, duration) => {
      if (cameraRef.current) {
        const coords = [region.longitude, region.latitude];
        // Convert latitudeDelta to zoom level (approximate)
        const calculatedZoom = Math.log2(360 / region.latitudeDelta);
        cameraRef.current.setCamera({
          centerCoordinate: coords,
          zoomLevel: calculatedZoom,
          animationDuration: duration || 1000,
        });
      }
    },
    // Fit to coordinates with padding
    fitToCoordinates: (coordinates, options = {}) => {
      if (cameraRef.current && coordinates.length > 0) {
        const bounds = buildCoordinateBounds(coordinates);
        if (!bounds) {
          return;
        }

        if (bounds.singlePoint) {
          cameraRef.current.setCamera({
            centerCoordinate: bounds.northeast,
            zoomLevel: options.zoomLevel ?? zoomLevel,
            animationDuration: options.animationDuration ?? animationDuration,
            padding: padding,
          });
          return;
        }

        cameraRef.current.fitBounds(
          bounds.northeast,
          bounds.southwest,
          normalizeEdgePadding(options.edgePadding),
          options.animationDuration ?? animationDuration
        );
      }
    }
  }));
  const handleMapError = (error) => {
    logger.error('MapboxMap', 'Mapbox Map Error', error);
  };

  return (
    <Mapbox.MapView
      ref={mapViewRef}
      style={style}
      onPress={onPress}
      styleURL={customMapStyle || Mapbox.StyleURL.Dark} // Dark theme like current app
      scaleBarEnabled={false} // Remove scale bar
      onMapLoadingError={handleMapError}
      logoPosition={{ bottom: 8, left: 8 }} // Symmetric bottom-left
      attributionPosition={{ bottom: 8, right: 0 }} // Closer to right edge
      {...props}
    >
      <Mapbox.Camera
        ref={cameraRef}
        centerCoordinate={centerCoordinate || DEFAULT_CENTER_COORDINATE}
        zoomLevel={zoomLevel}
        pitch={pitch}
        heading={bearing}
        animationDuration={animationDuration}
        padding={padding}
        followUserLocation={followUserLocation}
        followUserMode={followUserMode}
      />
      {children}
    </Mapbox.MapView>
  );
});

export default MapboxMap;
