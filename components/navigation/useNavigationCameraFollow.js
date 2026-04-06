import { useCallback, useMemo, useState } from 'react';

const isValidCoordinate = (coordinate) => (
  Array.isArray(coordinate) &&
  coordinate.length >= 2 &&
  Number.isFinite(Number(coordinate[0])) &&
  Number.isFinite(Number(coordinate[1]))
);

const buildCameraConfigFromMapState = (mapState, fallbackCameraConfig) => {
  const center = mapState?.properties?.center;
  if (!isValidCoordinate(center)) {
    return null;
  }

  const zoomLevel = Number(mapState?.properties?.zoom);
  const pitch = Number(mapState?.properties?.pitch);
  const bearing = Number(mapState?.properties?.heading);

  return {
    centerCoordinate: center,
    zoomLevel: Number.isFinite(zoomLevel) ? zoomLevel : (fallbackCameraConfig?.zoomLevel ?? 18.5),
    pitch: Number.isFinite(pitch) ? pitch : (fallbackCameraConfig?.pitch ?? 0),
    bearing: Number.isFinite(bearing) ? bearing : (fallbackCameraConfig?.bearing ?? 0),
    padding: fallbackCameraConfig?.padding,
    animationDuration: 0,
  };
};

export default function useNavigationCameraFollow({
  cameraConfig,
  mapRef,
}) {
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);
  const [manualCameraConfig, setManualCameraConfig] = useState(null);

  const handleCameraChanged = useCallback((mapState) => {
    const isGestureActive = Boolean(mapState?.gestures?.isGestureActive);
    if (!isGestureActive && isAutoFollowEnabled) {
      return;
    }

    const nextManualCameraConfig = buildCameraConfigFromMapState(mapState, cameraConfig);
    if (!nextManualCameraConfig) {
      return;
    }

    setManualCameraConfig(nextManualCameraConfig);
    if (isGestureActive && isAutoFollowEnabled) {
      setIsAutoFollowEnabled(false);
    }
  }, [cameraConfig, isAutoFollowEnabled]);

  const recenterOnVehicle = useCallback(() => {
    setIsAutoFollowEnabled(true);
    setManualCameraConfig(null);

    if (cameraConfig && typeof mapRef?.current?.setCamera === 'function') {
      mapRef.current.setCamera(cameraConfig);
    }
  }, [cameraConfig, mapRef]);

  const activeCameraConfig = useMemo(() => {
    if (!isAutoFollowEnabled && manualCameraConfig) {
      return manualCameraConfig;
    }

    return cameraConfig;
  }, [cameraConfig, isAutoFollowEnabled, manualCameraConfig]);

  return {
    activeCameraConfig,
    handleCameraChanged,
    isAutoFollowEnabled,
    recenterOnVehicle,
  };
}
