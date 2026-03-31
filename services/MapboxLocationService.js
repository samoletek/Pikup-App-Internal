import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appConfig } from '../config/appConfig';
import {
  getMapProviderAdapter,
  resetMapProviderAdapter,
  setMapProviderAdapter,
} from './adapters/mapProviderAdapter';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { SUPPORTED_ORDER_COUNTRY_QUERY } from '../constants/orderAvailability';

const MAPBOX_ACCESS_TOKEN = appConfig.mapbox.publicToken;
const LAST_LOCATION_KEY = '@pikup_last_location';
const REVERSE_GEOCODE_TYPES = 'address,poi,place,region,country';

class MapboxLocationService {
  constructor() {
    this.currentLocation = null;
    this.locationCallbacks = [];
    this.watchId = null;
    this.mapProvider = getMapProviderAdapter();
  }

  setMapProviderAdapter(adapter) {
    setMapProviderAdapter(adapter);
    this.mapProvider = getMapProviderAdapter();
  }

  resetMapProviderAdapter() {
    resetMapProviderAdapter();
    this.mapProvider = getMapProviderAdapter();
  }

  // Save location to storage
  async saveLastKnownLocation(location) {
    try {
      await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to save last location');
      logger.warn('MapboxLocationService', 'Failed to save last location', normalized, error);
    }
  }

  // Get location from storage
  async getLastKnownLocation() {
    try {
      const jsonValue = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to load last location');
      logger.warn('MapboxLocationService', 'Failed to load last location', normalized, error);
      return null;
    }
  }

  // CRITICAL: Replace Google Directions API (TOS violation)
  async getRoute(origin, destination, waypoints = []) {
    try {
      const data = await this.mapProvider.fetchDirections({
        accessToken: MAPBOX_ACCESS_TOKEN,
        origin,
        destination,
        waypoints,
      });

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        return {
          distance: {
            text: `${(route.distance / 1000).toFixed(1)} km`,
            value: route.distance
          },
          duration: {
            text: `${Math.round(route.duration / 60)} min`,
            value: route.duration
          },
          duration_in_traffic: {
            text: `${Math.round(route.duration / 60)} min`,
            value: route.duration
          },
          coordinates: route.geometry.coordinates.map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
          })),
          steps: route.legs[0].steps,
          geometry: route.geometry // For Navigation SDK
        };
      } else {
        throw new Error(`Mapbox Directions API error: ${data.message || 'No routes found'}`);
      }
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to get route');
      logger.error('MapboxLocationService', 'Error getting route', normalized, error);
      throw new Error(normalized.message);
    }
  }

  // CRITICAL: Replace Google Geocoding API (TOS violation)
  async geocodeAddress(address) {
    try {
      const data = await this.mapProvider.geocodeAddress({
        accessToken: MAPBOX_ACCESS_TOKEN,
        address,
        country: SUPPORTED_ORDER_COUNTRY_QUERY,
      });

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return {
          latitude: feature.center[1],
          longitude: feature.center[0],
          formatted_address: feature.place_name,
        };
      } else {
        throw new Error('Geocoding failed: No results found');
      }
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to geocode address');
      logger.error('MapboxLocationService', 'Geocoding error', normalized, error);
      throw new Error(normalized.message);
    }
  }

  // CRITICAL: Add reverse geocoding for coordinates to address
  async reverseGeocode(latitude, longitude) {
    try {
      const data = await this.mapProvider.reverseGeocode({
        accessToken: MAPBOX_ACCESS_TOKEN,
        latitude,
        longitude,
        types: REVERSE_GEOCODE_TYPES,
        country: SUPPORTED_ORDER_COUNTRY_QUERY,
      });

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const context = Array.isArray(feature.context) ? feature.context : [];
        const featureId = String(feature?.id || '');
        const stateEntry = featureId.startsWith('region')
          ? feature
          : context.find((entry) => String(entry?.id || '').startsWith('region'));
        const rawStateCode = String(stateEntry?.short_code || stateEntry?.text || '')
          .trim()
          .toUpperCase();
        const stateCode = rawStateCode.startsWith('US-') ? rawStateCode.slice(3) : rawStateCode;

        return {
          address: feature.place_name,
          formatted_address: feature.place_name,
          stateCode: stateCode || null,
        };
      } else {
        throw new Error('Reverse geocoding failed: No results found');
      }
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to reverse geocode coordinates');
      logger.error('MapboxLocationService', 'Reverse geocoding error', normalized, error);
      throw new Error(normalized.message);
    }
  }

  // Keep existing location methods (no changes needed)
  normalizeLocationPayload(location) {
    if (!location?.coords) return null;

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp || Date.now(),
    };
  }

  async getCurrentLocation(options = {}) {
    const {
      accuracy = Location.Accuracy.Balanced,
      timeoutMs = 8000,
      maximumAge = 120000,
      requiredAccuracy = 250,
      allowLastKnown = true,
      allowStoredFallback = true,
    } = options;

    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const permission = await Location.requestForegroundPermissionsAsync();
        status = permission.status;
      }

      if (status !== 'granted') {
        throw new Error('Location permission required');
      }

      const now = Date.now();
      const currentTimestamp = Number(this.currentLocation?.timestamp || 0);
      if (this.currentLocation && now - currentTimestamp <= maximumAge) {
        return this.currentLocation;
      }

      if (allowLastKnown) {
        const lastKnownPosition = await Location.getLastKnownPositionAsync({
          maxAge: maximumAge,
          requiredAccuracy,
        });

        const lastKnownLocation = this.normalizeLocationPayload(lastKnownPosition);
        if (lastKnownLocation) {
          this.currentLocation = lastKnownLocation;
          this.saveLastKnownLocation(lastKnownLocation);
          return lastKnownLocation;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy,
        timeout: timeoutMs,
        maximumAge,
      });

      const normalizedLocation = this.normalizeLocationPayload(location);
      if (!normalizedLocation) {
        throw new Error('Unable to resolve location coordinates');
      }

      this.currentLocation = normalizedLocation;

      // Save to storage
      this.saveLastKnownLocation(this.currentLocation);

      return this.currentLocation;
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to get current location');
      logger.error('MapboxLocationService', 'Error getting current location', normalized, error);
      if (allowStoredFallback) {
        const storedLocation = await this.getLastKnownLocation();
        if (storedLocation?.latitude && storedLocation?.longitude) {
          this.currentLocation = storedLocation;
          return storedLocation;
        }
      }
      throw new Error(normalized.message);
    }
  }

  async startLocationTracking(callback, options = {}) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: options.interval || 5000,
          distanceInterval: options.distanceFilter || 10,
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          };

          // Save to storage
          this.saveLastKnownLocation(this.currentLocation);

          this.locationCallbacks.forEach(cb => cb(this.currentLocation));
          if (callback) callback(this.currentLocation);
        }
      );
    } catch (error) {
      const normalized = normalizeError(error, 'Failed to start location tracking');
      logger.error('MapboxLocationService', 'Error starting location tracking', normalized, error);
      throw new Error(normalized.message);
    }
  }

  stopLocationTracking() {
    if (this.watchId) {
      try {
        this.watchId.remove(); // ✅ correct way
      } catch (e) {
        const normalized = normalizeError(e, 'Failed to remove location watcher');
        logger.warn('MapboxLocationService', 'Failed to remove location watcher', normalized, e);
      }
      this.watchId = null;
    }
    this.locationCallbacks = [];
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }
}

export default new MapboxLocationService();
