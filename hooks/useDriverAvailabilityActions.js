import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { getDriverReadinessProfile } from '../services/DriverService';
import { logger } from '../services/logger';
import {
  REQUEST_POOLS,
  shouldBypassDriverReadiness,
} from '../screens/driver/DriverHomeScreen.utils';

export default function useDriverAvailabilityActions({
  currentUser,
  currentUserId,
  navigation,
  isOnline,
  hasActiveTrip,
  activeJob,
  activeRequestPool,
  openActiveTrip,
  loadRequests,
  setLoading,
  setPhoneVerifyVisible,
  setDriverOnline,
  setDriverOffline,
  setDriverLocation,
  setActiveRequestPool,
  setShowRequestModal,
  setShowAllRequests,
  setSelectedRequest,
  setIsOnline,
  setShowIncomingModal,
  setIsMinimized,
  setIncomingRequest,
}) {
  const checkDriverReadiness = useCallback(async () => {
    const driverId = currentUser?.uid || currentUser?.id;
    if (!driverId) return { ready: false, issues: ['Not authenticated'] };

    if (shouldBypassDriverReadiness(currentUser)) {
      return {
        ready: true,
        issues: [],
        profile: {
          readinessBypass: true,
          bypassUserId: driverId,
          bypassEmail: currentUser?.email || null,
        },
      };
    }

    return getDriverReadinessProfile(driverId);
  }, [currentUser]);

  const confirmGoOnline = useCallback(async (mode, requestPool = REQUEST_POOLS.ASAP) => {
    if (isOnline || !currentUserId) return;

    try {
      setLoading(true);

      const { ready, issues } = await checkDriverReadiness();
      if (!ready) {
        setLoading(false);

        if (issues.includes('phone')) {
          Alert.alert(
            'Phone Verification Required',
            'You must verify your phone number before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Verify Now', onPress: () => setPhoneVerifyVisible(true) },
            ]
          );
          return;
        }

        if (issues.includes('vehicle')) {
          Alert.alert(
            'Vehicle Registration Required',
            'Please complete your vehicle registration in the onboarding section before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Profile', onPress: () => navigation.navigate('Account') },
            ]
          );
          return;
        }

        if (issues.includes('identity')) {
          Alert.alert(
            'Identity Verification Required',
            'Please complete identity verification before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Profile', onPress: () => navigation.navigate('Account') },
            ]
          );
          return;
        }

        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission is required to go online.');
        setLoading(false);
        return;
      }

      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });
      } catch {
        location = await Location.getLastKnownPositionAsync({});
      }

      if (!location) {
        alert('Unable to determine your location. Please make sure location services are enabled and try again.');
        setLoading(false);
        return;
      }

      const driverPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(driverPos);
      const sessionId = await setDriverOnline(currentUserId, driverPos, mode);

      setActiveRequestPool(requestPool);
      setShowRequestModal(false);
      setShowAllRequests(false);
      setSelectedRequest(null);
      setIsOnline(true);

      logger.info('DriverAvailability', 'Driver is now online', {
        sessionId,
        mode,
        requestPool,
      });
    } catch (error) {
      logger.error('DriverAvailability', 'Error going online', error);
      alert('Could not go online. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    checkDriverReadiness,
    currentUserId,
    isOnline,
    navigation,
    setActiveRequestPool,
    setDriverLocation,
    setDriverOnline,
    setIsOnline,
    setLoading,
    setPhoneVerifyVisible,
    setSelectedRequest,
    setShowAllRequests,
    setShowRequestModal,
  ]);

  const openGoOnlineModeSheet = useCallback((targetPool = REQUEST_POOLS.ASAP) => {
    if (hasActiveTrip && activeJob) {
      openActiveTrip(activeJob);
      return;
    }

    if (isOnline) {
      if (activeRequestPool !== targetPool) {
        setActiveRequestPool(targetPool);
        setShowRequestModal(false);
        setShowAllRequests(false);
        setSelectedRequest(null);
        loadRequests(false, targetPool);
      }
      return;
    }

    Alert.alert(
      'Select Driving Mode',
      targetPool === REQUEST_POOLS.SCHEDULED
        ? 'Choose mode for scheduled rides'
        : 'Choose how you want to drive',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Solo', onPress: () => confirmGoOnline('SOLO', targetPool) },
        { text: 'Team', onPress: () => confirmGoOnline('TEAM', targetPool) },
      ]
    );
  }, [
    activeJob,
    activeRequestPool,
    confirmGoOnline,
    hasActiveTrip,
    isOnline,
    loadRequests,
    openActiveTrip,
    setActiveRequestPool,
    setSelectedRequest,
    setShowAllRequests,
    setShowRequestModal,
  ]);

  const handleGoOnline = useCallback(() => {
    openGoOnlineModeSheet(REQUEST_POOLS.ASAP);
  }, [openGoOnlineModeSheet]);

  const handleGoOnlineScheduled = useCallback(() => {
    openGoOnlineModeSheet(REQUEST_POOLS.SCHEDULED);
  }, [openGoOnlineModeSheet]);

  const confirmGoOffline = useCallback(async () => {
    const userId = currentUser?.uid || currentUser?.id;
    if (!userId) return;

    try {
      setLoading(true);
      await setDriverOffline(userId);

      setIsOnline(false);
      setActiveRequestPool(REQUEST_POOLS.ASAP);
      setShowAllRequests(false);
      setShowIncomingModal(false);
      setIsMinimized(false);
      setIncomingRequest(null);

      logger.info('DriverAvailability', 'Driver is now offline');
    } catch (error) {
      logger.error('DriverAvailability', 'Error going offline', error);
      alert('Could not go offline. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    currentUser,
    setActiveRequestPool,
    setDriverOffline,
    setIncomingRequest,
    setIsMinimized,
    setIsOnline,
    setLoading,
    setShowAllRequests,
    setShowIncomingModal,
  ]);

  const handleGoOffline = useCallback(() => {
    if (!isOnline) return;
    if (hasActiveTrip) {
      Alert.alert(
        'Active order in progress',
        'Complete or cancel the current order before going offline.'
      );
      return;
    }

    Alert.alert(
      'Go Offline?',
      'You will stop receiving new pickup requests.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Offline', style: 'destructive', onPress: confirmGoOffline },
      ]
    );
  }, [confirmGoOffline, hasActiveTrip, isOnline]);

  return {
    handleGoOnline,
    handleGoOnlineScheduled,
    handleGoOffline,
  };
}
