import * as Location from 'expo-location';
import { getDistanceFromLatLonInKm } from './navigationMath.utils';
import {
  ensureForegroundLocationAvailability,
  getCurrentPositionWithFallback,
  LOCATION_AVAILABILITY_REASON,
} from '../../utils/locationPermissions';

const CURRENT_POSITION_OPTIONS = Object.freeze({
  accuracy: Location.Accuracy.High,
  timeout: 15000,
  maximumAge: 10000,
});

const LAST_KNOWN_OPTIONS = Object.freeze({
  maxAge: 60000,
});

export const NAVIGATION_WATCH_OPTIONS = Object.freeze({
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 700,
  distanceInterval: 3,
});

const normalizeCoordinates = (coords) => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
});

export async function ensureNavigationLocationAccess() {
  const availability = await ensureForegroundLocationAvailability({
    loggerScope: 'NavigationLocation',
    permissionDeniedTitle: 'Permission Required',
    permissionDeniedMessage: 'This app needs location permission to provide navigation.',
    servicesDisabledMessage: 'Please enable location services in your device settings.',
  });

  if (!availability.ok) {
    const errorMessage =
      availability.reason === LOCATION_AVAILABILITY_REASON.SERVICES_DISABLED
        ? 'Location services are disabled'
        : 'Location permission denied';
    return { granted: false, errorMessage };
  }

  return { granted: true, errorMessage: null };
}

export async function resolveInitialDriverPosition({ initialLocation = null } = {}) {
  if (initialLocation?.latitude && initialLocation?.longitude) {
    return { coords: initialLocation, heading: 0 };
  }

  const position = await getCurrentPositionWithFallback({
    currentPositionOptions: CURRENT_POSITION_OPTIONS,
    lastKnownOptions: LAST_KNOWN_OPTIONS,
  });

  if (position?.coords) {
    return {
      coords: normalizeCoordinates(position.coords),
      heading: position.coords.heading ?? null,
    };
  }

  throw new Error('No location available');
}

export async function startNavigationLocationWatch(onLocationUpdate, options = {}) {
  return Location.watchPositionAsync(
    {
      ...NAVIGATION_WATCH_OPTIONS,
      ...options,
    },
    onLocationUpdate
  );
}

export function setNavigationInitialCamera(mapRef, driverCoords, heading = 0) {
  if (!mapRef?.current?.setCamera || !driverCoords) {
    return;
  }

  mapRef.current.setCamera({
    centerCoordinate: [driverCoords.longitude, driverCoords.latitude],
    zoomLevel: 18.5,
    pitch: 60,
    bearing: heading || 0,
    animationDuration: 1000,
    padding: {
      top: 100,
      bottom: 250,
      left: 50,
      right: 50,
    },
  });
}

export function calculateDistanceToNextTurnMeters({
  routeSteps,
  currentStepIndex,
  location,
}) {
  if (!Array.isArray(routeSteps) || routeSteps.length <= currentStepIndex || !location) {
    return null;
  }

  const currentStep = routeSteps[currentStepIndex];
  if (!currentStep?.maneuver?.location) {
    return null;
  }

  const maneuverLocation = {
    latitude: currentStep.maneuver.location[1],
    longitude: currentStep.maneuver.location[0],
  };

  return (
    getDistanceFromLatLonInKm(
      location.latitude,
      location.longitude,
      maneuverLocation.latitude,
      maneuverLocation.longitude
    ) * 1000
  );
}
