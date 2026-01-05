import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Mapbox from '@rnmapbox/maps';

// Configure Mapbox with your token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN);

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
          centerCoordinate: config.centerCoordinate,
          zoomLevel: config.zoomLevel || zoomLevel,
          pitch: config.pitch !== undefined ? config.pitch : pitch,
          heading: config.bearing || bearing, // Mapbox uses 'heading' internally
          animationDuration: config.animationDuration || animationDuration,
          padding: config.padding || padding,
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
        const bounds = coordinates.map(coord => [coord.longitude, coord.latitude]);
        cameraRef.current.fitBounds(
          bounds[0], // ne
          bounds[bounds.length - 1], // sw
          options.edgePadding || [100, 100, 100, 100],
          options.animationDuration || 1000
        );
      }
    }
  }));
  
  return (
    <Mapbox.MapView
      ref={mapViewRef}
      style={style}
      onPress={onPress}
      styleURL={customMapStyle || Mapbox.StyleURL.Dark} // Dark theme like current app
      scaleBarEnabled={false} // Remove scale bar
      {...props}
    >
      <Mapbox.Camera
        ref={cameraRef}
        centerCoordinate={centerCoordinate || [-84.388, 33.749]} // Atlanta default
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