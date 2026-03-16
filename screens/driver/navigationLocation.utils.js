import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { getDistanceFromLatLonInKm } from './navigationMath.utils';

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
  timeInterval: 1000,
  distanceInterval: 5,
});

const normalizeCoordinates = (coords) => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
});

export async function ensureNavigationLocationAccess() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'This app needs location permission to provide navigation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return { granted: false, errorMessage: 'Location permission denied' };
  }

  const isLocationEnabled = await Location.hasServicesEnabledAsync();
  if (!isLocationEnabled) {
    Alert.alert(
      'Location Services Disabled',
      'Please enable location services in your device settings.',
      [{ text: 'OK' }]
    );
    return { granted: false, errorMessage: 'Location services are disabled' };
  }

  return { granted: true, errorMessage: null };
}

export async function resolveInitialDriverPosition({ initialLocation = null } = {}) {
  if (initialLocation?.latitude && initialLocation?.longitude) {
    return { coords: initialLocation, heading: 0 };
  }

  try {
    const currentPosition = await Location.getCurrentPositionAsync(CURRENT_POSITION_OPTIONS);
    return {
      coords: normalizeCoordinates(currentPosition.coords),
      heading: currentPosition.coords.heading ?? null,
    };
  } catch (_locationError) {
    const lastKnownPosition = await Location.getLastKnownPositionAsync(LAST_KNOWN_OPTIONS);
    if (lastKnownPosition?.coords) {
      return {
        coords: normalizeCoordinates(lastKnownPosition.coords),
        heading: lastKnownPosition.coords.heading ?? null,
      };
    }
    throw new Error('No location available');
  }
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
