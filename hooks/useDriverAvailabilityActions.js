import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { getDriverReadinessProfile } from '../services/DriverService';
import MapboxLocationService from '../services/MapboxLocationService';
import { logger } from '../services/logger';
import {
  REQUEST_POOLS,
  shouldBypassDriverReadiness,
} from '../screens/driver/DriverHomeScreen.utils';
import {
  DRIVER_AVAILABILITY_COMING_SOON_MESSAGE as DRIVER_GEO_RESTRICTED_MESSAGE,
  DRIVER_AVAILABILITY_COMING_SOON_TITLE as DRIVER_GEO_RESTRICTED_TITLE,
  SERVICE_AREA_UNRESOLVED_MESSAGE,
  SUPPORTED_ORDER_STATE_CODES,
} from '../constants/orderAvailability';
import { isSupportedOrderStateCode } from '../utils/locationState';
import {
  ensureForegroundLocationAvailability,
  getCurrentPositionWithFallback,
  showOpenLocationSettingsAlert,
} from '../utils/locationPermissions';

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
  isDriverGeoRestricted = false,
}) {
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const checkDriverReadiness = useCallback(async () => {
    const driverId = currentUserId;
    if (!driverId) return { ready: false, issues: ['Not authenticated'] };

    if (shouldBypassDriverReadiness(currentUserRef.current)) {
      return {
        ready: true,
        issues: [],
        profile: {
          readinessBypass: true,
          bypassUserId: driverId,
          bypassEmail: currentUserRef.current?.email || null,
        },
      };
    }

    return getDriverReadinessProfile(driverId);
  }, [currentUserId]);

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

      const availability = await ensureForegroundLocationAvailability({
        loggerScope: 'DriverAvailability',
        permissionDeniedMessage:
          'Please allow location access to go online and receive trip requests.',
        servicesDisabledMessage:
          'Please enable Location Services to go online and receive trip requests.',
      });
      if (!availability.ok) {
        setLoading(false);
        return;
      }

      const location = await getCurrentPositionWithFallback();

      if (!location?.coords?.latitude || !location?.coords?.longitude) {
        showOpenLocationSettingsAlert({
          title: 'Location Required',
          message:
            'We could not determine your current location. Please check location settings and try again.',
          loggerScope: 'DriverAvailability',
        });
        setLoading(false);
        return;
      }

      const driverPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      let driverStateCode = null;
      try {
        const geocodedLocation = await MapboxLocationService.reverseGeocode(
          driverPos.latitude,
          driverPos.longitude
        );
        driverStateCode = String(geocodedLocation?.stateCode || '')
          .trim()
          .toUpperCase();
      } catch (reverseGeocodeError) {
        logger.warn('DriverAvailability', 'Unable to resolve driver geo state before going online', reverseGeocodeError);
      }

      if (!driverStateCode) {
        Alert.alert(
          'Service Availability',
          SERVICE_AREA_UNRESOLVED_MESSAGE
        );
        return;
      }

      if (!isSupportedOrderStateCode(driverStateCode, SUPPORTED_ORDER_STATE_CODES)) {
        Alert.alert(DRIVER_GEO_RESTRICTED_TITLE, DRIVER_GEO_RESTRICTED_MESSAGE);
        return;
      }

      setDriverLocation({ ...driverPos, stateCode: driverStateCode });
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
      Alert.alert('Go Online Failed', 'Could not go online. Please try again.');
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

    if (isDriverGeoRestricted) {
      Alert.alert(DRIVER_GEO_RESTRICTED_TITLE, DRIVER_GEO_RESTRICTED_MESSAGE);
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
    isDriverGeoRestricted,
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
    if (!currentUserId) return;

    try {
      setLoading(true);
      await setDriverOffline(currentUserId);

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
    currentUserId,
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
