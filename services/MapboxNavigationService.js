import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { normalizeError } from './errorService';
import { logger } from './logger';
import { appConfig } from '../config/appConfig';

// Try different possible module names
const MapboxNavigation = NativeModules.MapboxNavigation || 
                         NativeModules.MapboxNavigationModule || 
                         NativeModules.MapboxNavigationBridge || 
                         null;
const isNavigationModuleAvailable = !!MapboxNavigation && typeof MapboxNavigation.startNavigation === 'function';

// Debug logging (dev only)
if (__DEV__) {
  logger.debug('MapboxNavigationService', '=== MAPBOX SERVICE DEBUG ===');
  logger.debug('MapboxNavigationService', 'Platform.OS', Platform.OS);
  logger.debug(
    'MapboxNavigationService',
    'Mapbox native module available',
    isNavigationModuleAvailable
  );
  logger.debug('MapboxNavigationService', '============================');
}

class MapboxNavigationService {
  constructor() {
    this.eventEmitter = isNavigationModuleAvailable
      ? new NativeEventEmitter(MapboxNavigation) 
      : null;
    this.listeners = [];
  }

  isAvailable() {
    return isNavigationModuleAvailable;
  }

  startNavigation(origin, destination, options = {}) {
    return new Promise((resolve, reject) => {
      logger.info('MapboxNavigationService', '=== START NAVIGATION ATTEMPT ===');
      logger.info('MapboxNavigationService', 'Origin', origin);
      logger.info('MapboxNavigationService', 'Destination', destination);
      logger.info('MapboxNavigationService', 'Options', options);
      logger.info('MapboxNavigationService', 'MapboxNavigation available', this.isAvailable());
      
      if (!this.isAvailable()) {
        const error = 'Mapbox Navigation not available on this platform';
        logger.error('MapboxNavigationService', error);
        reject(new Error(error));
        return;
      }

      const supportsOptionsEntry =
        typeof MapboxNavigation.startNavigationWithOptions === 'function';
      const optionsWithToken = {
        ...(options || {}),
        mapboxAccessToken: appConfig.mapbox.publicToken,
      };
      logger.info(
        'MapboxNavigationService',
        'Calling MapboxNavigation start method',
        { supportsOptionsEntry }
      );

      const startNavigationPromise = supportsOptionsEntry
        ? MapboxNavigation.startNavigationWithOptions(origin, destination, optionsWithToken)
        : MapboxNavigation.startNavigation(origin, destination);

      startNavigationPromise
        .then((result) => {
          logger.info('MapboxNavigationService', 'Navigation started successfully', result);
          resolve(result);
        })
        .catch((error) => {
          const normalized = normalizeError(error, 'Navigation failed');
          logger.error('MapboxNavigationService', 'Navigation failed', normalized);
          reject(new Error(normalized.message || 'Navigation failed'));
        });
    });
  }

  stopNavigation() {
    return new Promise((resolve, reject) => {
      if (!this.isAvailable()) {
        reject(new Error('Mapbox Navigation not available'));
        return;
      }

      MapboxNavigation.stopNavigation()
        .then(resolve)
        .catch((error) => {
          const normalized = normalizeError(error, 'Failed to stop navigation');
          reject(new Error(normalized.message || 'Failed to stop navigation'));
        });
    });
  }

  addListener(eventName, callback) {
    if (!this.eventEmitter) return null;
    
    const listener = this.eventEmitter.addListener(eventName, callback);
    this.listeners.push(listener);
    return listener;
  }

  removeAllListeners() {
    this.listeners.forEach(listener => listener?.remove());
    this.listeners = [];
  }
}

export default new MapboxNavigationService();
