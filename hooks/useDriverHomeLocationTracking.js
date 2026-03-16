import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { movedEnough } from '../screens/driver/DriverHomeScreen.utils';
import { logger } from '../services/logger';

const HEARTBEAT_INTERVAL_MS = 20000;

export default function useDriverHomeLocationTracking({
  currentUser,
  isOnline,
  hasActiveTrip,
  activeJobId,
  updateDriverHeartbeat,
  updateDriverLocation,
}) {
  const [region, setRegion] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const locationSubscription = useRef(null);
  const lastHeartbeatAt = useRef(0);
  const latestDriverLocationRef = useRef(null);

  useEffect(() => {
    latestDriverLocationRef.current = driverLocation;
  }, [driverLocation]);

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const initializeLocation = useCallback(async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      logger.warn('DriverHomeLocationTracking', 'Background location permission not granted. Real-time tracking may be limited.');
    }

    const loc = await Location.getCurrentPositionAsync({});
    const nextLocation = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };

    setRegion({
      ...nextLocation,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setDriverLocation(nextLocation);
    latestDriverLocationRef.current = nextLocation;
  }, []);

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
        latestDriverLocationRef.current = newLocation;
        setDriverLocation(newLocation);

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
      }
    );
  }, [
    activeJobId,
    currentUser?.id,
    currentUser?.uid,
    isOnline,
    updateDriverHeartbeat,
    updateDriverLocation,
  ]);

  useEffect(() => {
    initializeLocation();
    return stopLocationTracking;
  }, [initializeLocation, stopLocationTracking]);

  useEffect(() => {
    if (isOnline && !hasActiveTrip) {
      if (!locationSubscription.current) {
        void startLocationTracking();
      }
      return;
    }

    stopLocationTracking();
  }, [hasActiveTrip, isOnline, startLocationTracking, stopLocationTracking]);

  return {
    driverLocation,
    region,
    setDriverLocation,
  };
}
