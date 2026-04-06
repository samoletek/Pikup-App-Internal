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
  animationDuration = 900,
}) => {
  const longitude = Number(location?.longitude);
  const latitude = Number(location?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return {
    centerCoordinate: [longitude, latitude],
    zoomLevel: resolveNavigationZoom({ speedMetersPerSecond, distanceToNextTurn }),
    pitch: 60,
    bearing: heading || 0,
    animationDuration,
    padding: {
      top: padding?.top ?? DEFAULT_CAMERA_PADDING.top,
      bottom: padding?.bottom ?? DEFAULT_CAMERA_PADDING.bottom,
      left: padding?.left ?? DEFAULT_CAMERA_PADDING.left,
      right: padding?.right ?? DEFAULT_CAMERA_PADDING.right,
    },
  };
};
