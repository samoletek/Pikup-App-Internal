import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { logger } from '../services/logger';
import {
  ensureForegroundLocationAvailability,
  openLocationSettings as openDeviceLocationSettings,
  resolvePreciseLocationStatus,
  showOpenLocationSettingsAlert,
} from '../utils/locationPermissions';

const createInitialStatus = () => ({
  loading: true,
  permissionStatus: 'undetermined',
  locationServicesEnabled: false,
  locationTrackingEnabled: false,
  preciseLocationEnabled: false,
  preciseLocationKnown: false,
  iosAccuracy: 'unknown',
  androidAccuracy: 'none',
});

export default function useLocationSettingsControls({ loggerScope = 'LocationSettings' } = {}) {
  const [status, setStatus] = useState(createInitialStatus);

  const openLocationSettings = useCallback(() => {
    void openDeviceLocationSettings(loggerScope);
  }, [loggerScope]);

  const promptOpenSettings = useCallback((title, message) => {
    showOpenLocationSettingsAlert({
      title,
      message,
      loggerScope,
      cancelLabel: 'Skip',
    });
  }, [loggerScope]);

  const refreshLocationStatus = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const locationServicesEnabled = await Location.hasServicesEnabledAsync();

      const permissionGranted = permission.status === 'granted';
      const locationTrackingEnabled = permissionGranted && locationServicesEnabled;
      const preciseLocation = resolvePreciseLocationStatus(permission);
      const preciseLocationEnabled = locationTrackingEnabled && preciseLocation.enabled;
      const preciseLocationKnown = locationTrackingEnabled && preciseLocation.known;

      setStatus({
        loading: false,
        permissionStatus: permission.status,
        locationServicesEnabled,
        locationTrackingEnabled,
        preciseLocationEnabled,
        preciseLocationKnown,
        iosAccuracy: preciseLocation.iosAccuracy,
        androidAccuracy: preciseLocation.androidAccuracy,
      });
    } catch (error) {
      logger.warn(loggerScope, 'Failed to refresh location settings status', error);
      setStatus((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  }, [loggerScope]);

  useEffect(() => {
    void refreshLocationStatus();
  }, [refreshLocationStatus]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshLocationStatus();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [refreshLocationStatus]);

  const handleLocationTrackingToggle = useCallback(async (nextValue) => {
    if (!nextValue) {
      promptOpenSettings(
        'Disable Location Tracking',
        'To turn off location tracking, use your device settings for PikUp.'
      );
      return;
    }

    try {
      const availability = await ensureForegroundLocationAvailability({
        loggerScope,
        permissionDeniedMessage:
          'Location access is required to check service availability and use trips.',
        servicesDisabledMessage: 'Please enable Location Services in device settings.',
        cancelLabel: 'Skip',
      });

      if (!availability.ok) {
        await refreshLocationStatus();
        return;
      }
    } catch (error) {
      logger.warn(loggerScope, 'Failed while toggling location tracking', error);
    } finally {
      await refreshLocationStatus();
    }
  }, [loggerScope, promptOpenSettings, refreshLocationStatus]);

  const handlePreciseLocationToggle = useCallback(async (nextValue) => {
    if (!status.locationTrackingEnabled && nextValue) {
      await handleLocationTrackingToggle(true);
      return;
    }

    if (Platform.OS === 'android') {
      promptOpenSettings(
        nextValue ? 'Enable Precise Location' : 'Disable Precise Location',
        nextValue
          ? 'Enable precise location (Fine) in Android settings for best trip matching.'
          : 'You can disable precise location in Android settings for PikUp.'
      );
      return;
    }

    promptOpenSettings(
      nextValue ? 'Enable Precise Location' : 'Disable Precise Location',
      'Manage Precise Location in iOS Settings > PikUp > Location.'
    );
  }, [handleLocationTrackingToggle, promptOpenSettings, status.locationTrackingEnabled]);

  const locationTrackingDescription = useMemo(() => {
    if (status.permissionStatus !== 'granted') {
      return 'Required for trip matching and service-area checks.';
    }
    if (!status.locationServicesEnabled) {
      return 'Permission granted, but Location Services are currently off.';
    }
    return 'Location tracking is enabled.';
  }, [status.locationServicesEnabled, status.permissionStatus]);

  const preciseLocationDescription = useMemo(() => {
    if (!status.locationTrackingEnabled) {
      return 'Enable location tracking first.';
    }

    if (Platform.OS === 'android') {
      if (status.androidAccuracy === 'fine') {
        return 'Precise location is enabled.';
      }
      return 'Enable precise location in Android settings for better accuracy.';
    }

    if (status.iosAccuracy === 'full') {
      return 'Precise location is enabled.';
    }

    if (status.iosAccuracy === 'reduced') {
      return 'Precise location is off. Open settings to enable it.';
    }

    return 'Precise location status could not be read. Open settings to verify.';
  }, [status.androidAccuracy, status.iosAccuracy, status.locationTrackingEnabled]);

  return {
    locationStatus: status,
    locationTrackingDescription,
    preciseLocationDescription,
    handleLocationTrackingToggle,
    handlePreciseLocationToggle,
    openLocationSettings,
    refreshLocationStatus,
  };
}
