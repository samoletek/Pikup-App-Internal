import { logger } from './logger';
import {
  fetchDriverRowById,
  updateDriverRowById,
} from './repositories/paymentRepository';
import { normalizeError } from './errorService';

const getMissingColumnFromError = (error) => {
  const message = String(error?.message || '');
  let match = message.match(/Could not find the '([^']+)' column/i);
  if (match?.[1]) return match[1];

  match = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
  if (match?.[1]) {
    return match[1].split('.').pop();
  }

  return null;
};

const applyDriverColumnUpdateWithFallback = async (driverId, columnUpdates = {}) => {
  const updates = { ...columnUpdates };

  while (Object.keys(updates).length > 0) {
    const { error } = await updateDriverRowById(driverId, updates);

    if (!error) {
      return true;
    }

    const missingColumn = getMissingColumnFromError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
      logger.warn('DriverDbFallbackUtils', `Drivers table is missing "${missingColumn}". Retrying without it.`);
      delete updates[missingColumn];
      continue;
    }

    throw error;
  }

  return false;
};

const updateDriverMetadata = async (driverId, patch = {}) => {
  const { data: profile } = await fetchDriverRowById(driverId);

  const currentMeta = profile?.metadata || {};
  const nextMeta = {
    ...currentMeta,
    ...patch,
  };

  const { error } = await updateDriverRowById(driverId, { metadata: nextMeta });

  if (error) throw error;
};

export const fallbackSetDriverOnline = async (driverId, location) => {
  try {
    const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
      is_online: true,
      current_mode: location.mode || 'SOLO',
      last_location: `POINT(${location.longitude} ${location.latitude})`,
      updated_at: new Date().toISOString(),
    });

    if (updatedByColumns) {
      return;
    }
  } catch (error) {
    const normalized = normalizeError(error, 'Driver online update failed; using metadata fallback');
    logger.warn('DriverDbFallbackUtils', 'Supabase direct online update failed, using metadata fallback', normalized, error);
  }

  await updateDriverMetadata(driverId, {
    isOnline: true,
    mode: location.mode || 'SOLO',
    lastLocation: location,
    lastSeen: new Date().toISOString(),
  });
};

export const fallbackSetDriverOffline = async (driverId) => {
  try {
    const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
      is_online: false,
      updated_at: new Date().toISOString(),
    });

    if (updatedByColumns) {
      return;
    }
  } catch (error) {
    const normalized = normalizeError(error, 'Driver offline update failed; using metadata fallback');
    logger.warn('DriverDbFallbackUtils', 'Supabase direct offline update failed, using metadata fallback', normalized, error);
  }

  await updateDriverMetadata(driverId, {
    isOnline: false,
    lastSeen: new Date().toISOString(),
  });
};

export const fallbackHeartbeat = async (driverId, location) => {
  try {
    const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
      last_location: `POINT(${location.longitude} ${location.latitude})`,
      updated_at: new Date().toISOString(),
    });

    if (updatedByColumns) {
      return;
    }
  } catch (error) {
    const normalized = normalizeError(error, 'Driver heartbeat update failed; using metadata fallback');
    logger.warn('DriverDbFallbackUtils', 'Supabase direct heartbeat update failed, using metadata fallback', normalized, error);
  }

  await updateDriverMetadata(driverId, {
    lastLocation: location,
    lastSeen: new Date().toISOString(),
  });
};
