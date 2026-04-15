import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { normalizeError } from './errorService';
import { logger } from './logger';
import { appConfig } from '../config/appConfig';

const MAPBOX_NATIVE_NAME_PATTERNS = [
  /mapboxnavigation/i,
  /mapbox.*navigation/i,
];

const listBridgeModuleNames = () => {
  try {
    const remoteModuleConfig = global?.__fbBatchedBridgeConfig?.remoteModuleConfig;
    if (!Array.isArray(remoteModuleConfig)) {
      return [];
    }

    return remoteModuleConfig
      .map((entry) => {
        if (Array.isArray(entry)) {
          return typeof entry[0] === 'string' ? entry[0] : null;
        }

        if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
          return entry.name;
        }

        return null;
      })
      .filter((name) => typeof name === 'string' && name.length > 0);
  } catch (_) {
    return [];
  }
};

const resolveFromGlobalNativeProxy = (moduleName) => {
  try {
    const proxy = global?.nativeModuleProxy;
    if (!proxy) {
      return null;
    }

    if (typeof proxy === 'function') {
      return proxy(moduleName) || null;
    }

    return proxy[moduleName] || null;
  } catch (_) {
    return null;
  }
};

const resolveFromTurboProxy = (moduleName) => {
  try {
    const turboProxy = global?.__turboModuleProxy;
    if (typeof turboProxy !== 'function') {
      return null;
    }
    return turboProxy(moduleName) || null;
  } catch (_) {
    return null;
  }
};

const resolveFromKnownNames = (moduleNames) => {
  if (!Array.isArray(moduleNames) || moduleNames.length === 0) {
    return null;
  }

  for (const moduleName of moduleNames) {
    const fromNativeModules = NativeModules?.[moduleName];
    if (fromNativeModules) {
      return fromNativeModules;
    }

    const fromNativeProxy = resolveFromGlobalNativeProxy(moduleName);
    if (fromNativeProxy) {
      return fromNativeProxy;
    }

    const fromTurboProxy = resolveFromTurboProxy(moduleName);
    if (fromTurboProxy) {
      return fromTurboProxy;
    }
  }

  return null;
};

const resolveNativeModule = () => (
  resolveFromKnownNames([
    'MapboxNavigation',
    'MapboxNavigationModule',
    'MapboxNavigationBridge',
  ]) ||
  resolveFromKnownNames(
    listBridgeModuleNames().filter((name) =>
      MAPBOX_NATIVE_NAME_PATTERNS.some((pattern) => pattern.test(name))
    )
  ) ||
  null
);

const isCallableNativeMethod = (module, methodName) => {
  if (!module || !methodName) {
    return false;
  }

  const candidate = module[methodName];
  return (
    typeof candidate === 'function' ||
    !!(candidate && typeof candidate.call === 'function')
  );
};

const invokeNativeMethod = (module, methodName, args = []) => {
  if (!module || !methodName) {
    return null;
  }

  const candidate = module[methodName];
  if (typeof candidate === 'function') {
    return candidate.apply(module, args);
  }

  if (candidate && typeof candidate.call === 'function') {
    return candidate.call(module, ...args);
  }

  return null;
};

const hasNativeStartMethod = (module) =>
  isCallableNativeMethod(module, 'startNavigation') ||
  isCallableNativeMethod(module, 'startNavigationWithOptions');

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeCoordinatePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const latitude = toFiniteNumber(payload.latitude ?? payload.lat);
  const longitude = toFiniteNumber(payload.longitude ?? payload.lng ?? payload.lon);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

class MapboxNavigationService {
  constructor() {
    this.eventEmitter = null;
    this.nativeModule = null;
    this.listeners = [];
    this.hasLoggedMissingModuleDebug = false;
  }

  getNativeModule() {
    const module = resolveNativeModule();
    this.nativeModule = module;
    return module;
  }

  ensureEventEmitter() {
    const module = this.getNativeModule();
    if (!hasNativeStartMethod(module)) {
      this.eventEmitter = null;
      return null;
    }

    if (!this.eventEmitter) {
      this.eventEmitter = new NativeEventEmitter(module);
    }

    return this.eventEmitter;
  }

  isAvailable() {
    const module = this.getNativeModule();
    return hasNativeStartMethod(module);
  }

  startNavigation(origin, destination, options = {}) {
    return new Promise((resolve, reject) => {
      const nativeModule = this.getNativeModule();
      const normalizedOrigin = normalizeCoordinatePayload(origin);
      const normalizedDestination = normalizeCoordinatePayload(destination);

      logger.info('MapboxNavigationService', '=== START NAVIGATION ATTEMPT ===');
      logger.info('MapboxNavigationService', 'Origin', normalizedOrigin || origin);
      logger.info('MapboxNavigationService', 'Destination', normalizedDestination || destination);
      logger.info('MapboxNavigationService', 'Options', options);
      logger.info('MapboxNavigationService', 'MapboxNavigation available', this.isAvailable());
      
      if (!hasNativeStartMethod(nativeModule)) {
        const error = 'Mapbox Navigation not available on this platform';
        if (!this.hasLoggedMissingModuleDebug) {
          this.hasLoggedMissingModuleDebug = true;
          const mapboxFromNativeModules = NativeModules.MapboxNavigation;
          const mapboxFromNativeProxy = resolveFromGlobalNativeProxy('MapboxNavigation');
          const mapboxFromTurboProxy = resolveFromTurboProxy('MapboxNavigation');
          const bridgeModuleNames = listBridgeModuleNames();
          const mapboxBridgeCandidates = bridgeModuleNames.filter((moduleName) =>
            MAPBOX_NATIVE_NAME_PATTERNS.some((pattern) => pattern.test(moduleName))
          );
          logger.warn('MapboxNavigationService', 'Mapbox native module debug snapshot', {
            hasNativeModulesObject: !!NativeModules,
            nativeModulesOwnKeysCount: Object.getOwnPropertyNames(NativeModules || {}).length,
            nativeModulesHasMapboxNavigation: !!mapboxFromNativeModules,
            nativeModulesHasMapboxNavigationModule: !!NativeModules.MapboxNavigationModule,
            nativeModulesHasMapboxNavigationBridge: !!NativeModules.MapboxNavigationBridge,
            globalNativeProxyType: typeof global?.nativeModuleProxy,
            globalNativeProxyHasMapboxNavigation: !!mapboxFromNativeProxy,
            turboProxyType: typeof global?.__turboModuleProxy,
            turboProxyHasMapboxNavigation: !!mapboxFromTurboProxy,
            bridgeModuleNamesCount: bridgeModuleNames.length,
            mapboxBridgeCandidates,
          });
        }
        logger.error('MapboxNavigationService', error, {
          platform: Platform.OS,
          nativeModuleKeys: Object.getOwnPropertyNames(NativeModules || {}),
        });
        reject(new Error(error));
        return;
      }

      if (!normalizedOrigin || !normalizedDestination) {
        const error = 'Navigation coordinates are invalid';
        logger.error('MapboxNavigationService', error, { origin, destination });
        reject(new Error(error));
        return;
      }

      const supportsOptionsEntry = isCallableNativeMethod(
        nativeModule,
        'startNavigationWithOptions'
      );
      const configuredAccessToken = String(appConfig?.mapbox?.publicToken || '').trim();
      const optionsWithToken = configuredAccessToken
        ? {
          ...(options || {}),
          mapboxAccessToken: configuredAccessToken,
        }
        : { ...(options || {}) };
      logger.info(
        'MapboxNavigationService',
        'Calling MapboxNavigation start method',
        { supportsOptionsEntry }
      );

      const invocationResult = supportsOptionsEntry
        ? invokeNativeMethod(
          nativeModule,
          'startNavigationWithOptions',
          [normalizedOrigin, normalizedDestination, optionsWithToken]
        )
        : invokeNativeMethod(
          nativeModule,
          'startNavigation',
          [normalizedOrigin, normalizedDestination]
        );

      const startNavigationPromise = invocationResult == null
        ? Promise.resolve({ started: false, reason: 'native_start_method_missing' })
        : Promise.resolve(invocationResult);

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
      const nativeModule = this.getNativeModule();
      if (!isCallableNativeMethod(nativeModule, 'stopNavigation')) {
        reject(new Error('Mapbox Navigation not available'));
        return;
      }

      const invocationResult = invokeNativeMethod(nativeModule, 'stopNavigation');
      if (invocationResult == null) {
        reject(new Error('Mapbox Navigation not available'));
        return;
      }

      Promise.resolve(invocationResult)
        .then(resolve)
        .catch((error) => {
          const normalized = normalizeError(error, 'Failed to stop navigation');
          reject(new Error(normalized.message || 'Failed to stop navigation'));
        });
    });
  }

  updateNavigationOptions(options = {}) {
    return new Promise((resolve, reject) => {
      const nativeModule = this.getNativeModule();
      if (!isCallableNativeMethod(nativeModule, 'updateNavigationOptions')) {
        resolve({
          updated: false,
          active: !!nativeModule,
          reason: 'unsupported',
        });
        return;
      }

      const invocationResult = invokeNativeMethod(nativeModule, 'updateNavigationOptions', [options]);
      if (invocationResult == null) {
        resolve({
          updated: false,
          active: !!nativeModule,
          reason: 'native_update_method_missing',
        });
        return;
      }

      Promise.resolve(invocationResult)
        .then(resolve)
        .catch((error) => {
          const normalized = normalizeError(error, 'Failed to update navigation options');
          reject(new Error(normalized.message || 'Failed to update navigation options'));
        });
    });
  }

  acknowledgeNavigationAction(actionToken) {
    return new Promise((resolve, reject) => {
      const nativeModule = this.getNativeModule();
      if (!isCallableNativeMethod(nativeModule, 'acknowledgeNavigationAction')) {
        resolve({
          acknowledged: false,
          active: !!nativeModule,
          reason: 'unsupported',
        });
        return;
      }

      const normalizedToken = String(actionToken || '').trim();
      if (!normalizedToken) {
        resolve({
          acknowledged: false,
          active: !!nativeModule,
          reason: 'missing_token',
        });
        return;
      }

      const invocationResult = invokeNativeMethod(
        nativeModule,
        'acknowledgeNavigationAction',
        [normalizedToken]
      );
      if (invocationResult == null) {
        resolve({
          acknowledged: false,
          active: !!nativeModule,
          reason: 'native_ack_method_missing',
        });
        return;
      }

      Promise.resolve(invocationResult)
        .then(resolve)
        .catch((error) => {
          const normalized = normalizeError(error, 'Failed to acknowledge navigation action');
          reject(new Error(normalized.message || 'Failed to acknowledge navigation action'));
        });
    });
  }

  completeNavigationAction(actionToken, success = true) {
    return new Promise((resolve, reject) => {
      const nativeModule = this.getNativeModule();
      if (!isCallableNativeMethod(nativeModule, 'completeNavigationAction')) {
        resolve({
          completed: false,
          active: !!nativeModule,
          reason: 'unsupported',
        });
        return;
      }

      const normalizedToken = String(actionToken || '').trim();
      if (!normalizedToken) {
        resolve({
          completed: false,
          active: !!nativeModule,
          reason: 'missing_token',
        });
        return;
      }

      const invocationResult = invokeNativeMethod(
        nativeModule,
        'completeNavigationAction',
        [normalizedToken, Boolean(success)]
      );
      if (invocationResult == null) {
        resolve({
          completed: false,
          active: !!nativeModule,
          reason: 'native_complete_method_missing',
        });
        return;
      }

      Promise.resolve(invocationResult)
        .then(resolve)
        .catch((error) => {
          const normalized = normalizeError(error, 'Failed to complete navigation action');
          reject(new Error(normalized.message || 'Failed to complete navigation action'));
        });
    });
  }

  addListener(eventName, callback) {
    const emitter = this.ensureEventEmitter();
    if (!emitter) return null;
    
    const listener = emitter.addListener(eventName, callback);
    this.listeners.push(listener);
    return listener;
  }

  removeAllListeners() {
    this.listeners.forEach(listener => listener?.remove());
    this.listeners = [];
  }
}

export default new MapboxNavigationService();
