import { logger } from './logger';
import { fetchDriverRowById } from './repositories/paymentRepository';
import { normalizeError } from './errorService';

export const getPersistedDriverOnlineStatus = async (driverId) => {
  if (!driverId) {
    return null;
  }

  try {
    const { data: driverState, error } = await fetchDriverRowById(driverId);

    if (error && error.code !== 'PGRST116') {
      logger.warn('DriverStateService', 'Unable to load driver online state from profile', error);
      return null;
    }

    if (!driverState) {
      return null;
    }

    const metadataOnlineRaw = driverState?.metadata?.isOnline;
    const hasColumnState = typeof driverState.is_online === 'boolean';
    const hasMetadataState = typeof metadataOnlineRaw === 'boolean';

    if (!hasColumnState && !hasMetadataState) {
      return null;
    }

    return hasColumnState ? Boolean(driverState.is_online) : Boolean(metadataOnlineRaw);
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to restore driver online state');
    logger.warn('DriverStateService', 'Unable to restore driver online state from profile', normalized, error);
    return null;
  }
};
