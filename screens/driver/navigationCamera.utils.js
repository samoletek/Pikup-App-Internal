const DEFAULT_CAMERA_PADDING = Object.freeze({
  top: 100,
  bottom: 250,
  left: 50,
  right: 50,
});

const resolveNavigationZoom = ({ speedMetersPerSecond, distanceToNextTurn }) => {
  const speedKmh = (speedMetersPerSecond || 0) * 3.6;
  let targetZoom = 18.5;

  if (distanceToNextTurn && distanceToNextTurn < 100) {
    targetZoom = 19.5;
  } else if (speedKmh > 80) {
    targetZoom = 16.5;
  } else if (speedKmh > 50) {
    targetZoom = 17.5;
  } else if (speedKmh < 20) {
    targetZoom = 19;
  }

  return targetZoom;
};

export const buildNavigationCameraConfig = ({
  location,
  speedMetersPerSecond,
  distanceToNextTurn,
  heading = 0,
  padding = DEFAULT_CAMERA_PADDING,
}) => {
  if (!location?.longitude || !location?.latitude) {
    return null;
  }

  return {
    centerCoordinate: [location.longitude, location.latitude],
    zoomLevel: resolveNavigationZoom({ speedMetersPerSecond, distanceToNextTurn }),
    pitch: 60,
    bearing: heading || 0,
    animationDuration: 900,
    padding: {
      top: padding?.top ?? DEFAULT_CAMERA_PADDING.top,
      bottom: padding?.bottom ?? DEFAULT_CAMERA_PADDING.bottom,
      left: padding?.left ?? DEFAULT_CAMERA_PADDING.left,
      right: padding?.right ?? DEFAULT_CAMERA_PADDING.right,
    },
  };
};
