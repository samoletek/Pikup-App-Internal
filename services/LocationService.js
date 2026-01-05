// services/LocationService.js
import * as Location from 'expo-location';
import Geolocation from 'react-native-geolocation-service';

const GOOGLE_DIRECTIONS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentLocation = null;
    this.locationCallbacks = [];
  }

  // Request location permissions
  async requestPermissions() {
    try {
      // For Expo Location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // For background tracking (when app is in background)
      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      console.log('Background permission:', backgroundStatus.status);

      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // Get current location once
  async getCurrentLocation() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission required');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
        maximumAge: 60000, // Accept cached location up to 1 minute old
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

  // Start watching location changes (for real-time tracking)
  async startLocationTracking(callback, options = {}) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission required');
      }

      // Stop any existing tracking
      this.stopLocationTracking();

      const defaultOptions = {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
        ...options
      };

      this.watchId = await Location.watchPositionAsync(
        defaultOptions,
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            speed: location.coords.speed,
            heading: location.coords.heading,
            timestamp: location.timestamp,
          };

          // Call all registered callbacks
          this.locationCallbacks.forEach(cb => cb(this.currentLocation));
          
          // Call the specific callback
          if (callback) {
            callback(this.currentLocation);
          }
        }
      );

      console.log('Location tracking started');
      return this.watchId;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  // Stop location tracking
  stopLocationTracking() {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
      console.log('Location tracking stopped');
    }
  }

  // Add callback for location updates
  addLocationCallback(callback) {
    this.locationCallbacks.push(callback);
  }

  // Remove callback
  removeLocationCallback(callback) {
    this.locationCallbacks = this.locationCallbacks.filter(cb => cb !== callback);
  }

  // Get route between two points
  async getRoute(origin, destination, waypoints = []) {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      
      let waypointsStr = '';
      if (waypoints.length > 0) {
        waypointsStr = waypoints
          .map(point => `${point.latitude},${point.longitude}`)
          .join('|');
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}${waypointsStr ? `&waypoints=${waypointsStr}` : ''}&key=${GOOGLE_DIRECTIONS_API_KEY}&mode=driving&traffic_model=best_guess&departure_time=now`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        return {
          distance: leg.distance,
          duration: leg.duration,
          duration_in_traffic: leg.duration_in_traffic || leg.duration,
          polyline: route.overview_polyline.points,
          coordinates: this.decodePolyline(route.overview_polyline.points),
          steps: leg.steps,
          start_address: leg.start_address,
          end_address: leg.end_address,
        };
      } else {
        throw new Error(`Directions API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  // Calculate distance between two points (in meters)

  // Decode Google's polyline format
  decodePolyline(encoded) {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  // Geocode address to coordinates
  async geocodeAddress(address) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_DIRECTIONS_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: data.results[0].formatted_address,
        };
      } else {
        throw new Error(`Geocoding failed: ${data.status}`);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(latitude, longitude) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_DIRECTIONS_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        return {
          formatted_address: data.results[0].formatted_address,
          components: data.results[0].address_components,
        };
      } else {
        throw new Error(`Reverse geocoding failed: ${data.status}`);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  // Calculate distance between two points using Haversine formula (returns miles)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
  }

  // Helper function to convert degrees to radians
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Check if point is within radius of another point
  isWithinRadius(center, point, radiusInMeters) {
    const distanceInMiles = this.calculateDistance(
      center.latitude, center.longitude, 
      point.latitude, point.longitude
    );
    const radiusInMiles = radiusInMeters * 0.000621371; // Convert meters to miles
    return distanceInMiles <= radiusInMiles;
  }

  // Get current location region for map display
  async getCurrentRegion(latitudeDelta = 0.01, longitudeDelta = 0.01) {
    try {
      const location = await this.getCurrentLocation();
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta,
        longitudeDelta,
      };
    } catch (error) {
      console.error('Error getting current region:', error);
      // Return default region (Atlanta area as fallback)
      return {
        latitude: 33.7490,
        longitude: -84.3880,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
  }
}

// Export singleton instance
export default new LocationService();