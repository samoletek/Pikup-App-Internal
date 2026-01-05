import * as Location from 'expo-location';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;

class MapboxLocationService {
  constructor() {
    this.currentLocation = null;
    this.locationCallbacks = [];
    this.watchId = null;
  }

  // CRITICAL: Replace Google Directions API (TOS violation)
  async getRoute(origin, destination, waypoints = []) {
    try {
      const originStr = `${origin.longitude},${origin.latitude}`;
      const destinationStr = `${destination.longitude},${destination.latitude}`;

      let waypointsStr = '';
      if (waypoints.length > 0) {
        waypointsStr = waypoints
          .map(point => `${point.longitude},${point.latitude}`)
          .join(';');
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originStr}${waypointsStr ? `;${waypointsStr}` : ''};${destinationStr}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&steps=true&voice_instructions=true&alternatives=true`;

      const response = await fetch(url);
      const data = await response.json();

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
      console.error('Error getting route:', error);
      throw error;
    }
  }

  // CRITICAL: Replace Google Geocoding API (TOS violation)
  async geocodeAddress(address) {
    try {
      // Bias search to Georgia (your service area)
      const bbox = '-85.605166,30.355757,-80.751429,35.000659'; // Georgia bounds
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&bbox=${bbox}&country=US`;

      const response = await fetch(url);
      const data = await response.json();

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
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  // CRITICAL: Add reverse geocoding for coordinates to address
  async reverseGeocode(latitude, longitude) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=address,poi&country=US`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        return {
          address: feature.place_name,
          formatted_address: feature.place_name,
        };
      } else {
        throw new Error('Reverse geocoding failed: No results found');
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  // Keep existing location methods (no changes needed)
  async getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission required');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
        maximumAge: 60000,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      return this.currentLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
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
          
          this.locationCallbacks.forEach(cb => cb(this.currentLocation));
          if (callback) callback(this.currentLocation);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  stopLocationTracking() {
    if (this.watchId) {
      try {
        this.watchId.remove(); // ✅ correct way
      } catch (e) {
        console.warn('Failed to remove location watcher', e);
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
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  }
}

export default new MapboxLocationService();