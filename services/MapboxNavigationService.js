import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

// Try different possible module names
const MapboxNavigation = NativeModules.MapboxNavigation || 
                         NativeModules.MapboxNavigationModule || 
                         NativeModules.MapboxNavigationBridge || 
                         null;
const isNavigationModuleAvailable = !!MapboxNavigation && typeof MapboxNavigation.startNavigation === 'function';

// Debug logging (dev only)
if (__DEV__) {
  console.log('=== MAPBOX SERVICE DEBUG ===');
  console.log('Platform.OS:', Platform.OS);
  console.log('Mapbox native module available:', isNavigationModuleAvailable);
  console.log('============================');
}

class MapboxNavigationService {
  constructor() {
    this.eventEmitter = Platform.OS === 'ios' && isNavigationModuleAvailable
      ? new NativeEventEmitter(MapboxNavigation) 
      : null;
    this.listeners = [];
  }

  isAvailable() {
    return Platform.OS === 'ios' && isNavigationModuleAvailable;
  }

  startNavigation(origin, destination) {
    return new Promise((resolve, reject) => {
      console.log('=== START NAVIGATION ATTEMPT ===');
      console.log('Origin:', origin);
      console.log('Destination:', destination);
      console.log('MapboxNavigation available:', this.isAvailable());
      
      if (!this.isAvailable()) {
        const error = 'Mapbox Navigation not available on this platform';
        console.log('ERROR:', error);
        reject(new Error(error));
        return;
      }

      console.log('Calling MapboxNavigation.startNavigation...');
      MapboxNavigation.startNavigation(origin, destination)
        .then((result) => {
          console.log('Navigation started successfully:', result);
          resolve(result);
        })
        .catch((error) => {
          console.log('Navigation failed:', error);
          reject(error);
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
        .catch(reject);
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
