import { appConfig } from '../config/appConfig';
import {
  fallbackHeartbeat,
  fallbackSetDriverOffline,
  fallbackSetDriverOnline,
} from './driverDbFallbackUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';

const PAYMENT_SERVICE_URL = appConfig.paymentService.baseUrl;
const NETWORK_TIMEOUT_MS = 8000;

const authFetchWithTimeout = async (authFetch, url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await authFetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const setDriverOnline = async (driverId, location, authFetch) => {
  try {
    logger.info('DriverPresenceService', 'Setting driver online', { driverId, location });

    let response = null;
    try {
      response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/online`, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
          latitude: location.latitude,
          longitude: location.longitude,
          mode: location.mode || 'SOLO',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set driver online: ${response.statusText}`);
      }
    } catch (networkError) {
      const normalized = normalizeError(networkError, 'Online API unavailable/timeout');
      logger.warn('DriverPresenceService', 'Online API unavailable/timeout, falling back to Supabase', normalized, networkError);
      await fallbackSetDriverOnline(driverId, location);
      return `local_session_${Date.now()}`;
    }

    const result = await response.json().catch(() => ({}));
    logger.info('DriverPresenceService', 'Driver set online successfully', { sessionId: result.sessionId });
    return result.sessionId || `remote_session_${Date.now()}`;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to set driver online');
    logger.error('DriverPresenceService', 'Error setting driver online', normalized, error);
    throw new Error(normalized.message);
  }
};

export const setDriverOffline = async (driverId, authFetch) => {
  try {
    logger.info('DriverPresenceService', 'Setting driver offline', { driverId });

    let response = null;
    try {
      response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/offline`, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set driver offline: ${response.statusText}`);
      }
    } catch (networkError) {
      const normalized = normalizeError(networkError, 'Offline API unavailable/timeout');
      logger.warn('DriverPresenceService', 'Offline API unavailable/timeout, falling back to Supabase', normalized, networkError);
      await fallbackSetDriverOffline(driverId);
      return true;
    }

    const result = await response.json().catch(() => ({}));
    logger.info('DriverPresenceService', 'Driver set offline successfully', {
      onlineMinutes: result.onlineMinutes,
    });
    return true;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to set driver offline');
    logger.error('DriverPresenceService', 'Error setting driver offline', normalized, error);
    throw new Error(normalized.message);
  }
};

export const updateDriverHeartbeat = async (driverId, location, authFetch) => {
  try {
    let response = null;
    try {
      response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          driverId,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update heartbeat: ${response.statusText}`);
      }
    } catch (_networkError) {
      await fallbackHeartbeat(driverId, location);
      return true;
    }

    return true;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to update driver heartbeat');
    logger.error('DriverPresenceService', 'Error updating driver heartbeat', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getOnlineDrivers = async (customerLocation, radiusMiles = 10, authFetch) => {
  try {
    const response = await authFetch(
      `${PAYMENT_SERVICE_URL}/drivers/online?lat=${customerLocation.latitude}&lng=${customerLocation.longitude}&radiusMiles=${radiusMiles}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Failed to get online drivers: ${response.statusText}`);
    }

    const result = await response.json();
    logger.info('DriverPresenceService', 'Loaded online drivers', {
      count: result.count,
      radiusMiles,
    });
    return result.drivers || [];
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to get online drivers');
    logger.error('DriverPresenceService', 'Error getting online drivers', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getDriverSessionStats = async (driverId, date = null, authFetch) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const response = await authFetchWithTimeout(
      authFetch,
      `${PAYMENT_SERVICE_URL}/drivers/${driverId}/session-stats?date=${targetDate}`,
      { method: 'GET' },
      NETWORK_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Failed to get session stats: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      totalOnlineMinutes: result.totalOnlineMinutes || 0,
      tripsCompleted: result.tripsCompleted || 0,
      totalEarnings: result.totalEarnings || 0,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to get driver session stats');
    logger.warn(
      'DriverPresenceService',
      'Session stats unavailable, using zero fallback',
      normalized,
      error
    );
    return { totalOnlineMinutes: 0, tripsCompleted: 0, totalEarnings: 0 };
  }
};
