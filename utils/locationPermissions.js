import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { logger } from '../services/logger';

const DEFAULT_CANCEL_LABEL = 'Cancel';
const DEFAULT_OPEN_SETTINGS_LABEL = 'Open Settings';

export const LOCATION_AVAILABILITY_REASON = Object.freeze({
  OK: 'ok',
  PERMISSION_DENIED: 'permission_denied',
  SERVICES_DISABLED: 'services_disabled',
  ERROR: 'error',
});

const normalizeAccuracy = (value, fallback = 'unknown') => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
};

export const resolvePreciseLocationStatus = (permission) => {
  if (permission?.status !== 'granted') {
    return {
      enabled: false,
      known: true,
      iosAccuracy: 'none',
      androidAccuracy: 'none',
    };
  }

  if (Platform.OS === 'android') {
    const androidAccuracy = normalizeAccuracy(permission?.android?.accuracy, 'none');
    return {
      enabled: androidAccuracy === 'fine',
      known: androidAccuracy !== 'none',
      iosAccuracy: 'none',
      androidAccuracy,
    };
  }

  const iosAccuracy = normalizeAccuracy(permission?.ios?.accuracy, 'unknown');
  if (iosAccuracy === 'full') {
    return {
      enabled: true,
      known: true,
      iosAccuracy,
      androidAccuracy: 'none',
    };
  }

  if (iosAccuracy === 'reduced') {
    return {
      enabled: false,
      known: true,
      iosAccuracy,
      androidAccuracy: 'none',
    };
  }

  return {
    enabled: false,
    known: false,
    iosAccuracy,
    androidAccuracy: 'none',
  };
};

export const openLocationSettings = async (loggerScope = 'LocationPermissions') => {
  try {
    await Linking.openSettings();
  } catch (error) {
    logger.warn(loggerScope, 'Failed to open app settings', error);
  }
};

export const showOpenLocationSettingsAlert = ({
  title,
  message,
  loggerScope = 'LocationPermissions',
  cancelLabel = DEFAULT_CANCEL_LABEL,
  openSettingsLabel = DEFAULT_OPEN_SETTINGS_LABEL,
} = {}) => {
  if (!title || !message) {
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: openSettingsLabel, onPress: () => void openLocationSettings(loggerScope) },
  ]);
};

export const ensureForegroundLocationAvailability = async ({
  loggerScope = 'LocationPermissions',
  requestPermission = true,
  permissionDeniedTitle = 'Location Permission Required',
  permissionDeniedMessage = 'Please allow location access to continue.',
  servicesDisabledTitle = 'Location Services Disabled',
  servicesDisabledMessage = 'Please enable Location Services in your device settings.',
  errorTitle = 'Location Required',
  errorMessage = 'We could not verify your current location. Please check Location settings and try again.',
  cancelLabel = DEFAULT_CANCEL_LABEL,
  openSettingsLabel = DEFAULT_OPEN_SETTINGS_LABEL,
  onPermissionDenied,
  onServicesDisabled,
  onError,
  showAlerts = true,
} = {}) => {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && requestPermission) {
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== 'granted') {
      if (typeof onPermissionDenied === 'function') {
        onPermissionDenied(permission);
      }
      if (showAlerts) {
        showOpenLocationSettingsAlert({
          title: permissionDeniedTitle,
          message: permissionDeniedMessage,
          loggerScope,
          cancelLabel,
          openSettingsLabel,
        });
      }
      return {
        ok: false,
        reason: LOCATION_AVAILABILITY_REASON.PERMISSION_DENIED,
        permission,
        locationServicesEnabled: false,
      };
    }

    const locationServicesEnabled = await Location.hasServicesEnabledAsync();
    if (!locationServicesEnabled) {
      if (typeof onServicesDisabled === 'function') {
        onServicesDisabled();
      }
      if (showAlerts) {
        showOpenLocationSettingsAlert({
          title: servicesDisabledTitle,
          message: servicesDisabledMessage,
          loggerScope,
          cancelLabel,
          openSettingsLabel,
        });
      }
      return {
        ok: false,
        reason: LOCATION_AVAILABILITY_REASON.SERVICES_DISABLED,
        permission,
        locationServicesEnabled,
      };
    }

    return {
      ok: true,
      reason: LOCATION_AVAILABILITY_REASON.OK,
      permission,
      locationServicesEnabled,
    };
  } catch (error) {
    logger.warn(loggerScope, 'Failed to verify foreground location availability', error);
    if (typeof onError === 'function') {
      onError(error);
    }
    if (showAlerts) {
      showOpenLocationSettingsAlert({
        title: errorTitle,
        message: errorMessage,
        loggerScope,
        cancelLabel,
        openSettingsLabel,
      });
    }
    return {
      ok: false,
      reason: LOCATION_AVAILABILITY_REASON.ERROR,
      permission: null,
      locationServicesEnabled: false,
      error,
    };
  }
};

export const getCurrentPositionWithFallback = async ({
  currentPositionOptions = {
    accuracy: Location.Accuracy.Balanced,
    timeout: 10000,
  },
  lastKnownOptions = {},
} = {}) => {
  try {
    return await Location.getCurrentPositionAsync(currentPositionOptions);
  } catch {
    return Location.getLastKnownPositionAsync(lastKnownOptions);
  }
};
