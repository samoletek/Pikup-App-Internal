import { useCallback, useEffect, useRef, useState } from 'react';
import { buildNavigationCameraConfig } from './navigationCamera.utils';
import { getDistanceFromLatLonInKm, interpolateHeading } from './navigationMath.utils';

const DEFAULT_TRANSITION_DURATION_MS = 900;
const FRAME_INTERVAL_MS = 16;
const MIN_TRANSITION_DURATION_MS = 220;
const MAX_TRANSITION_DURATION_MS = 960;
const TRANSITION_FILL_RATIO = 0.92;
const RESET_SAMPLE_GAP_MS = 2400;
const RESET_DISTANCE_METERS = 45;

const isValidLocation = (location) => (
  Number.isFinite(Number(location?.latitude)) &&
  Number.isFinite(Number(location?.longitude))
);

const getLocationDeltaMeters = (fromLocation, toLocation) => {
  if (!isValidLocation(fromLocation) || !isValidLocation(toLocation)) {
    return 0;
  }

  return getDistanceFromLatLonInKm(
    Number(fromLocation.latitude),
    Number(fromLocation.longitude),
    Number(toLocation.latitude),
    Number(toLocation.longitude)
  ) * 1000;
};

const interpolateLocation = (fromLocation, toLocation, progress) => ({
  latitude: (
    Number(fromLocation.latitude) +
    ((Number(toLocation.latitude) - Number(fromLocation.latitude)) * progress)
  ),
  longitude: (
    Number(fromLocation.longitude) +
    ((Number(toLocation.longitude) - Number(fromLocation.longitude)) * progress)
  ),
});

export default function useNavigationPresentationSmoothing({ enabled = true } = {}) {
  const [displayLocation, setDisplayLocation] = useState(null);
  const [displayHeading, setDisplayHeading] = useState(0);
  const [displayCameraConfig, setDisplayCameraConfig] = useState(null);

  const displayLocationRef = useRef(null);
  const displayHeadingRef = useRef(0);
  const animationIntervalRef = useRef(null);
  const lastSampleAtRef = useRef(null);

  const stopPresentationAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
  }, []);

  const updateDisplayState = useCallback(({
    location,
    heading = 0,
    speedMetersPerSecond = 0,
    distanceToNextTurn = null,
  }) => {
    if (!isValidLocation(location)) {
      return;
    }

    displayLocationRef.current = location;
    displayHeadingRef.current = Number.isFinite(Number(heading)) ? Number(heading) : 0;
    setDisplayLocation(location);
    setDisplayHeading(displayHeadingRef.current);
    setDisplayCameraConfig(
      buildNavigationCameraConfig({
        location,
        speedMetersPerSecond,
        distanceToNextTurn,
        heading: displayHeadingRef.current,
        animationDuration: enabled ? 120 : 900,
      })
    );
  }, [enabled]);

  const syncPresentation = useCallback((payload) => {
    stopPresentationAnimation();
    lastSampleAtRef.current = Date.now();
    updateDisplayState(payload);
  }, [stopPresentationAnimation, updateDisplayState]);

  const animatePresentation = useCallback(({
    location,
    heading = 0,
    speedMetersPerSecond = 0,
    distanceToNextTurn = null,
    durationMs = DEFAULT_TRANSITION_DURATION_MS,
  }) => {
    if (!isValidLocation(location)) {
      return;
    }

    if (!enabled || !isValidLocation(displayLocationRef.current)) {
      syncPresentation({
        location,
        heading,
        speedMetersPerSecond,
        distanceToNextTurn,
      });
      return;
    }

    stopPresentationAnimation();

    const fromLocation = displayLocationRef.current;
    const toLocation = location;
    const fromHeading = displayHeadingRef.current;
    const toHeading = Number.isFinite(Number(heading)) ? Number(heading) : fromHeading;
    const animationStartedAt = Date.now();
    const sampleGapMs =
      lastSampleAtRef.current === null
        ? DEFAULT_TRANSITION_DURATION_MS
        : Math.max(0, animationStartedAt - lastSampleAtRef.current);
    lastSampleAtRef.current = animationStartedAt;
    const locationDeltaMeters = getLocationDeltaMeters(fromLocation, toLocation);
    const shouldSnapToLocation =
      sampleGapMs >= RESET_SAMPLE_GAP_MS ||
      locationDeltaMeters >= RESET_DISTANCE_METERS;

    if (shouldSnapToLocation) {
      syncPresentation({
        location,
        heading,
        speedMetersPerSecond,
        distanceToNextTurn,
      });
      return;
    }

    const adaptiveDurationMs = sampleGapMs > 0
      ? sampleGapMs * TRANSITION_FILL_RATIO
      : durationMs;
    const transitionDuration = Math.max(
      MIN_TRANSITION_DURATION_MS,
      Math.min(
        MAX_TRANSITION_DURATION_MS,
        Number(adaptiveDurationMs) || DEFAULT_TRANSITION_DURATION_MS
      )
    );

    animationIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - animationStartedAt;
      const progress = Math.min(1, elapsedMs / transitionDuration);
      const interpolatedLocation = interpolateLocation(fromLocation, toLocation, progress);
      const interpolatedHeading = interpolateHeading(fromHeading, toHeading, progress);

      updateDisplayState({
        location: interpolatedLocation,
        heading: interpolatedHeading,
        speedMetersPerSecond,
        distanceToNextTurn,
      });

      if (progress >= 1) {
        stopPresentationAnimation();
      }
    }, FRAME_INTERVAL_MS);
  }, [enabled, stopPresentationAnimation, syncPresentation, updateDisplayState]);

  const resetPresentation = useCallback(() => {
    stopPresentationAnimation();
    displayLocationRef.current = null;
    displayHeadingRef.current = 0;
    lastSampleAtRef.current = null;
    setDisplayLocation(null);
    setDisplayHeading(0);
    setDisplayCameraConfig(null);
  }, [stopPresentationAnimation]);

  useEffect(() => {
    return () => {
      stopPresentationAnimation();
    };
  }, [stopPresentationAnimation]);

  return {
    animatePresentation,
    displayCameraConfig,
    displayHeading,
    displayLocation,
    resetPresentation,
    stopPresentationAnimation,
    syncPresentation,
  };
}
