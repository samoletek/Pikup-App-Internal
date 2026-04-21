import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { movedEnough } from '../screens/driver/DriverHomeScreen.utils';
import { logger } from '../services/logger';
import MapboxLocationService from '../services/MapboxLocationService';
import {
  ensureForegroundLocationAvailability,
  getCurrentPositionWithFallback,
  showOpenLocationSettingsAlert,
} from '../utils/locationPermissions';

const HEARTBEAT_INTERVAL_MS = 20000;
const STATE_RESOLUTION_MIN_MOVE_METERS = 1000;
const STATE_RESOLUTION_MIN_INTERVAL_MS = 120000;

export default function useDriverHomeLocationTracking({
  currentUser,
  isOnline,
  activeJobId,
  updateDriverHeartbeat,
  updateDriverLocation,
}) {
  const [region, setRegion] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverLocationStateCode, setDriverLocationStateCode] = useState(null);
  const [hasResolvedDriverLocationState, setHasResolvedDriverLocationState] = useState(false);
  const locationSubscription = useRef(null);
  const lastHeartbeatAt = useRef(0);
  const latestDriverLocationRef = useRef(null);
  const lastStateResolutionLocationRef = useRef(null);
  const lastStateResolutionAtRef = useRef(0);
  const stateResolutionInFlightRef = useRef(false);

  useEffect(() => {
    latestDriverLocationRef.current = driverLocation;
  }, [driverLocation]);

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const shouldResolveDriverState = useCallback((nextLocation, force = false) => {
    if (!nextLocation) {
      return false;
    }
    if (force || !lastStateResolutionLocationRef.current) {
      return true;
    }

    const enoughTimeElapsed =
      Date.now() - lastStateResolutionAtRef.current >= STATE_RESOLUTION_MIN_INTERVAL_MS;
    const movedFarEnough = movedEnough(
      lastStateResolutionLocationRef.current,
      nextLocation,
      STATE_RESOLUTION_MIN_MOVE_METERS
    );
    return enoughTimeElapsed || movedFarEnough;
  }, []);

  const resolveDriverStateCode = useCallback(async (nextLocation, force = false) => {
    if (!shouldResolveDriverState(nextLocation, force) || stateResolutionInFlightRef.current) {
      return;
    }

    stateResolutionInFlightRef.current = true;
    lastStateResolutionLocationRef.current = nextLocation;
    lastStateResolutionAtRef.current = Date.now();

    try {
      const geocodedLocation = await MapboxLocationService.reverseGeocode(
        Number(nextLocation.latitude),
        Number(nextLocation.longitude)
      );
      const normalizedStateCode = String(geocodedLocation?.stateCode || '')
        .trim()
        .toUpperCase();

      setDriverLocationStateCode(normalizedStateCode || null);
      setDriverLocation((prevLocation) => {
        if (!prevLocation) {
          return prevLocation;
        }
        return {
          ...prevLocation,
          stateCode: normalizedStateCode || null,
        };
      });
      setHasResolvedDriverLocationState(true);
    } catch (error) {
      logger.warn('DriverHomeLocationTracking', 'Unable to resolve driver state from coordinates', error);
      setHasResolvedDriverLocationState(true);
    } finally {
      stateResolutionInFlightRef.current = false;
    }
  }, [shouldResolveDriverState]);

  const applyResolvedLocation = useCallback((latitude, longitude) => {
    const nextLocation = {
      latitude,
      longitude,
      stateCode: null,
    };

    setRegion({
      ...nextLocation,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setDriverLocation(nextLocation);
    latestDriverLocationRef.current = nextLocation;
    void resolveDriverStateCode(nextLocation, true);
  }, [resolveDriverStateCode]);

  const initializeLocation = useCallback(async () => {
    const availability = await ensureForegroundLocationAvailability({
      loggerScope: 'DriverHomeLocationTracking',
      permissionDeniedMessage:
        'Please allow location access so we can verify service availability and keep navigation accurate.',
      servicesDisabledMessage:
        'Please enable Location Services so we can verify service availability and keep navigation accurate.',
    });
    if (!availability.ok) {
      return;
    }

    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      logger.warn('DriverHomeLocationTracking', 'Background location permission not granted. Real-time tracking may be limited.');
    }

    const loc = await getCurrentPositionWithFallback();
    const liveLatitude = Number(loc?.coords?.latitude ?? loc?.latitude);
    const liveLongitude = Number(loc?.coords?.longitude ?? loc?.longitude);

    if (Number.isFinite(liveLatitude) && Number.isFinite(liveLongitude)) {
      applyResolvedLocation(liveLatitude, liveLongitude);
      return;
    }

    const lastKnownLocation = await MapboxLocationService.getLastKnownLocation();
    const fallbackLatitude = Number(lastKnownLocation?.latitude);
    const fallbackLongitude = Number(lastKnownLocation?.longitude);

    if (Number.isFinite(fallbackLatitude) && Number.isFinite(fallbackLongitude)) {
      logger.warn(
        'DriverHomeLocationTracking',
        'Using last known location fallback while current location is unavailable'
      );
      applyResolvedLocation(fallbackLatitude, fallbackLongitude);
      return;
    }

    showOpenLocationSettingsAlert({
      title: 'Location Required',
      message:
        'We could not determine your location. Please check Location settings and try again.',
      loggerScope: 'DriverHomeLocationTracking',
    });
  }, [applyResolvedLocation]);

  const startLocationTracking = useCallback(async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 10,
      },
      (loc) => {
        const newLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        const previousLocation = latestDriverLocationRef.current;
        setDriverLocation((prevLocation) => {
          const nextLocation = {
            ...newLocation,
            stateCode: prevLocation?.stateCode || null,
          };
          latestDriverLocationRef.current = nextLocation;
          return nextLocation;
        });
        setRegion((prevRegion) => ({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: prevRegion?.latitudeDelta || 0.01,
          longitudeDelta: prevRegion?.longitudeDelta || 0.01,
        }));

        const currentUserId = currentUser?.uid || currentUser?.id;
        if (isOnline && currentUserId) {
          const now = Date.now();
          if (now - lastHeartbeatAt.current >= HEARTBEAT_INTERVAL_MS && movedEnough(previousLocation, newLocation)) {
            lastHeartbeatAt.current = now;
            updateDriverHeartbeat(currentUserId, newLocation).catch((error) => {
              logger.error('DriverHomeLocationTracking', 'Error updating heartbeat', error);
            });
          }
        }

        if (activeJobId) {
          updateDriverLocation(activeJobId, newLocation);
        }

        void resolveDriverStateCode(newLocation);
      }
    );
  }, [
    activeJobId,
    currentUser?.id,
    currentUser?.uid,
    isOnline,
    resolveDriverStateCode,
    updateDriverHeartbeat,
    updateDriverLocation,
  ]);

  useEffect(() => {
    initializeLocation();
    return stopLocationTracking;
  }, [initializeLocation, stopLocationTracking]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      if (!latestDriverLocationRef.current) {
        void initializeLocation();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [initializeLocation]);

  useEffect(() => {
    if (!locationSubscription.current) {
      void startLocationTracking();
    }
  }, [startLocationTracking]);

  return {
    driverLocation,
    driverLocationStateCode,
    hasResolvedDriverLocationState,
    region,
    setDriverLocation,
  };
}
