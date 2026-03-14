import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import MapboxLocationService from '../../services/MapboxLocationService';
import MapboxMap from '../../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { LinearGradient } from 'expo-linear-gradient';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import useMapboxNavigation from '../../components/mapbox/useMapboxNavigation';
import styles from './GpsNavigationScreen.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PICKUP_PHASE_STATUSES, DROPOFF_PHASE_STATUSES, TRIP_STATUS } from '../../constants/tripStatus';
import { colors, spacing } from '../../styles/theme';

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const resolveCustomerAvatarFromRequest = (requestLike) => {
  if (!requestLike || typeof requestLike !== 'object') {
    return null;
  }

  const customer =
    requestLike.customer ||
    requestLike.customerProfile ||
    requestLike.customer_profile ||
    {};
  const originalData =
    requestLike.originalData && typeof requestLike.originalData === 'object'
      ? requestLike.originalData
      : {};
  const originalCustomer =
    originalData.customer ||
    originalData.customerProfile ||
    originalData.customer_profile ||
    {};

  return firstNonEmptyString(
    customer.profileImageUrl,
    customer.profile_image_url,
    customer.avatarUrl,
    customer.avatar_url,
    requestLike.customerProfileImageUrl,
    requestLike.customer_profile_image_url,
    requestLike.customerAvatarUrl,
    requestLike.customer_avatar_url,
    originalCustomer.profileImageUrl,
    originalCustomer.profile_image_url,
    originalCustomer.avatarUrl,
    originalCustomer.avatar_url,
    originalData.customerProfileImageUrl,
    originalData.customer_profile_image_url,
    originalData.customerAvatarUrl,
    originalData.customer_avatar_url
  );
};

export default function GpsNavigationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { request, isCustomerView = false, stage = 'pickup' } = route.params || {};
  const { 
    startDriving, 
    arriveAtPickup, 
    getRequestById, 
    getConversations,
    updateDriverStatus,
    createConversation,
    getUserProfile,
    currentUser,
    userType,
    subscribeToConversations,
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;
  
  const [driverLocation, setDriverLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [remainingDistance, setRemainingDistance] = useState('Calculating...');
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0); // Direction in degrees
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState(null);
  
  // Turn-by-turn navigation states
  const [routeSteps, setRouteSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [distanceToTurn, setDistanceToTurn] = useState(null);
  const cardGradientColors = [colors.background.primary, colors.background.secondary];
  const activeRequestId =
    requestData?.id || request?.id || requestData?.requestId || request?.requestId || null;
  const conversationUserType =
    userType === 'customer' || isCustomerView ? 'customer' : 'driver';
  const activeRequestCustomerId = String(
    requestData?.customerId ||
    requestData?.customer_id ||
    request?.customerId ||
    request?.customer_id ||
    requestData?.originalData?.customerId ||
    requestData?.originalData?.customer_id ||
    ""
  );
  const activeRequestDriverId = String(
    requestData?.assignedDriverId ||
    requestData?.driverId ||
    requestData?.driver_id ||
    request?.assignedDriverId ||
    request?.driverId ||
    request?.driver_id ||
    ""
  );
  
  // Update navigation camera with Apple Maps style
  const updateNavigationCamera = (location, speed, distanceToNextTurn) => {
    if (!mapRef.current) return;
    
    // Calculate speed in km/h
    const speedKmh = (speed || 0) * 3.6;
    
    // Determine zoom based on context
    let targetZoom = 18.5; // Default city navigation
    
    if (distanceToNextTurn && distanceToNextTurn < 100) {
      targetZoom = 19.5; // Very close to turn
    } else if (speedKmh > 80) {
      targetZoom = 16.5; // Highway speed
    } else if (speedKmh > 50) {
      targetZoom = 17.5; // Fast city driving
    } else if (speedKmh < 20) {
      targetZoom = 19; // Slow/stopped
    }
    
    // Apply camera settings with Apple Maps style
    mapRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: targetZoom,
      pitch: 60, // 3D perspective
      bearing: currentHeading || 0, // Rotate map with driving direction
      animationDuration: 900,
      padding: {
        top: 100,     // Space for navigation banner
        bottom: 250,  // Space for info card, positions driver lower
        left: 50,
        right: 50
      }
    });
  };
  
  // Mapbox Navigation Integration
  const { startNavigation, stopNavigation, isNavigating, isSupported } = useMapboxNavigation({
    origin: driverLocation,
    destination: customerLocation,
    onRouteProgress: (progress) => {
      // Update ETA and distance from navigation progress
      if (progress.durationRemaining) {
        const minutes = Math.round(progress.durationRemaining / 60);
        setEstimatedTime(minutes < 1 ? '<1' : minutes.toString());
      }
      if (progress.distanceRemaining) {
        setRemainingDistance(formatDistance(progress.distanceRemaining));
      }
    },
    onArrival: () => {
      Alert.alert('Navigation', 'You have arrived at your destination!');
      stopNavigation();
      handleArrive();
    },
    onCancel: () => {
      // Navigation was cancelled by user
      console.log('Navigation cancelled by user');
    }
  });
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const customerAvatarCacheRef = useRef(new Map());
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(requestData?.id, navigation, {
    currentScreen: 'GpsNavigationScreen',
    enabled: !!requestData?.id && !isCustomerView,
    onCancel: () => {
      // Stop location tracking when order is cancelled
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      // Clear any intervals
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  });

  // Animate card entry
  useEffect(() => {
    if (!isLoading) {
      Animated.parallel([
        Animated.timing(cardAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [cardAnimation, fadeAnimation, isLoading]);

  useEffect(() => {
    if (isCustomerView) {
      // Customer is viewing driver location - don't track customer location
      initializeCustomerView();
    } else {
      // Driver navigation mode
      initializeDriverNavigation();
    }

    return () => {
      // Clean up location tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      
      // Clear refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      // Stop Mapbox navigation if active
      if (isNavigating) {
        stopNavigation();
      }
    };
    // Navigation mode bootstrap is intentionally one-time; retry action re-initializes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start Mapbox Navigation when coordinates are ready
  useEffect(() => {
    if (Platform.OS === 'ios' && 
        isSupported && 
        !isCustomerView && 
        driverLocation && 
        customerLocation && 
        !isNavigating && 
        !navigationAttempted) {
      
      setNavigationAttempted(true);
      
      startNavigation().catch((error) => {
        console.log('Mapbox navigation not available, using fallback map:', error);
        // Keep navigationAttempted true to prevent retries
      });
    }
  }, [
    driverLocation,
    customerLocation,
    isSupported,
    isCustomerView,
    isNavigating,
    navigationAttempted,
    startNavigation,
  ]);

  // Fetch latest request data
  useEffect(() => {
    if (request?.id) {
      fetchRequestData();
    }
    // Request refresh is keyed to request id; function identity is not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  useEffect(() => {
    const embeddedAvatar =
      resolveCustomerAvatarFromRequest(requestData) ||
      resolveCustomerAvatarFromRequest(request);

    if (embeddedAvatar) {
      setCustomerAvatarUrl(embeddedAvatar);
      if (activeRequestCustomerId) {
        customerAvatarCacheRef.current.set(activeRequestCustomerId, embeddedAvatar);
      }
      return;
    }

    if (isCustomerView || !activeRequestCustomerId || typeof getUserProfile !== 'function') {
      setCustomerAvatarUrl(null);
      return;
    }

    if (customerAvatarCacheRef.current.has(activeRequestCustomerId)) {
      setCustomerAvatarUrl(customerAvatarCacheRef.current.get(activeRequestCustomerId));
      return;
    }

    let isMounted = true;

    const loadCustomerAvatar = async () => {
      try {
        const profile = await getUserProfile(activeRequestCustomerId);
        if (!isMounted) {
          return;
        }

        const profileAvatar = firstNonEmptyString(
          profile?.profileImageUrl,
          profile?.profile_image_url,
          profile?.avatarUrl,
          profile?.avatar_url
        );

        customerAvatarCacheRef.current.set(activeRequestCustomerId, profileAvatar);
        setCustomerAvatarUrl(profileAvatar);
      } catch (_error) {
        if (!isMounted) {
          return;
        }

        customerAvatarCacheRef.current.set(activeRequestCustomerId, null);
        setCustomerAvatarUrl(null);
      }
    };

    loadCustomerAvatar();

    return () => {
      isMounted = false;
    };
  }, [activeRequestCustomerId, getUserProfile, isCustomerView, request, requestData]);

  useEffect(() => {
    if (!currentUserId || typeof subscribeToConversations !== 'function') {
      setHasUnreadChat(false);
      return undefined;
    }

    let isDisposed = false;
    const requestIdString = activeRequestId ? String(activeRequestId) : '';
    const unreadKey = conversationUserType === 'customer' ? 'unreadByCustomer' : 'unreadByDriver';
    const peerId =
      conversationUserType === 'customer'
        ? activeRequestDriverId
        : activeRequestCustomerId;
    const peerField = conversationUserType === 'customer' ? 'driverId' : 'customerId';

    const updateUnreadState = (userConversations = []) => {
      if (isDisposed) {
        return;
      }

      const unreadConversations = userConversations.filter(
        (conversation) => Number(conversation?.[unreadKey] || 0) > 0
      );

      const hasTripMatchUnread = unreadConversations.some(
        (conversation) =>
          (
            (requestIdString && String(conversation?.requestId || '') === requestIdString) ||
            (peerId && String(conversation?.[peerField] || '') === peerId)
          )
      );

      // Fallback for legacy rows with weak trip linkage.
      setHasUnreadChat(hasTripMatchUnread || unreadConversations.length > 0);
    };

    const refreshUnread = async () => {
      if (isDisposed || typeof getConversations !== 'function') {
        return;
      }

      const conversations = await getConversations(currentUserId, conversationUserType);
      updateUnreadState(Array.isArray(conversations) ? conversations : []);
    };

    refreshUnread();
    const pollInterval = setInterval(refreshUnread, 2500);

    const unsubscribe = subscribeToConversations(
      currentUserId,
      conversationUserType,
      updateUnreadState
    );

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      unsubscribe?.();
    };
  }, [
    activeRequestCustomerId,
    activeRequestDriverId,
    activeRequestId,
    conversationUserType,
    currentUserId,
    getConversations,
    subscribeToConversations,
  ]);

  const fetchRequestData = async () => {
    try {
      const latestData = await getRequestById(request.id);
      setRequestData(latestData);
      
      // If in customer view, update driver location
      if (isCustomerView && latestData.driverLocation) {
        setDriverLocation(latestData.driverLocation);
        
        // Extract destination based on current status
        const destination = extractDestinationFromStatus(latestData);
        if (destination) {
          setCustomerLocation(destination);
          
          // Generate route between driver and destination
          if (latestData.driverLocation) {
            generateRealRoute(latestData.driverLocation, destination);
          }
          
          // Center map to show both points
          if (mapRef.current && latestData.driverLocation && destination) {
            mapRef.current.fitToCoordinates(
              [latestData.driverLocation, destination],
              {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true,
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error fetching request data:', error);
    }
  };

  const extractDestinationFromStatus = (requestData) => {
    // Based on status, determine if we're showing pickup or dropoff location
    if (!requestData) return null;
    
    // If status is before pickedUp, show pickup location
    if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
      return requestData.pickup?.coordinates || null;
    } 
    // Otherwise show dropoff location
    else {
      return requestData.dropoff?.coordinates || null;
    }
  };

  const initializeCustomerView = async () => {
    setIsLoading(true);
    
    try {
      // Fetch initial request data
      await fetchRequestData();
      
      // Set up polling for driver location updates
      const interval = setInterval(() => {
        fetchRequestData();
      }, 10000); // Refresh every 10 seconds
      
      setRefreshInterval(interval);
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing customer view:', error);
      setLocationError('Failed to load driver location');
      setIsLoading(false);
    }
  };

  const initializeDriverNavigation = async () => {
    try {
      setIsLoading(true);
      
      // Request both foreground and background permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setLocationError('Location permission denied');
        setIsLoading(false);
        Alert.alert(
          'Permission Required',
          'This app needs location permission to provide navigation.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setLocationError('Location services are disabled');
        setIsLoading(false);
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get initial location with error handling
      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000, // 15 second timeout
          maximumAge: 10000, // Accept 10 second old location
        });

        const driverCoords = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        };

        setDriverLocation(driverCoords);

        // Set initial map region with Apple Maps style
        if (mapRef.current && mapRef.current.setCamera) {
          mapRef.current.setCamera({
            centerCoordinate: [driverCoords.longitude, driverCoords.latitude],
            zoomLevel: 18.5, // Much closer zoom for street-level view
            pitch: 60, // 3D perspective
            bearing: initialLocation.coords.heading || 0,
            animationDuration: 1000,
            padding: {
              top: 100,
              bottom: 250,
              left: 50,
              right: 50
            }
          });
        }
        
        // Store initial heading if available
        if (initialLocation.coords.heading) {
          setCurrentHeading(initialLocation.coords.heading);
        }

        // Start real-time location tracking
        startLocationTracking();

        // Extract customer location from request data
        const customerCoords = extractCustomerLocation(driverCoords);
        if (customerCoords) {
          setCustomerLocation(customerCoords);
          generateRealRoute(driverCoords, customerCoords);
        }

        // Mark as started driving if not already
        if (!navigationStarted && request?.id) {
          await startDriving(request.id, driverCoords);
          setNavigationStarted(true);
          console.log('Driver started navigation');
        }
        
        setIsLoading(false);

      } catch (locationError) {
        console.error('Error getting initial location:', locationError);
        
        // Fallback to last known location
        try {
          const lastKnownLocation = await Location.getLastKnownPositionAsync({
            maxAge: 60000, // Accept location up to 1 minute old
          });
          
          if (lastKnownLocation) {
            const driverCoords = {
              latitude: lastKnownLocation.coords.latitude,
              longitude: lastKnownLocation.coords.longitude,
            };
            setDriverLocation(driverCoords);
            
            // Continue with initialization using last known location
            const customerCoords = extractCustomerLocation(driverCoords);
            if (customerCoords) {
              setCustomerLocation(customerCoords);
              generateRealRoute(driverCoords, customerCoords);
            }
            
            startLocationTracking();
            setIsLoading(false);
          } else {
            throw new Error('No location available');
          }
        } catch (_fallbackError) {
          setLocationError('Unable to get your location. Please check your GPS settings.');
          setIsLoading(false);
          return;
        }
      }

    } catch (error) {
      console.error('Error initializing tracking:', error);
      setLocationError(`Failed to initialize: ${error.message}`);
      setIsLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation, // Best accuracy for navigation
          timeInterval: 1000, // Update every second for smooth movement
          distanceInterval: 5, // Update every 5 meters
        },
        (locationData) => {
          const newLocation = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
          };
          
          setDriverLocation(newLocation);
          
          // Update speed and heading
          if (locationData.coords.heading !== null) {
            setCurrentHeading(locationData.coords.heading);
          }
          
          // Calculate distance to next turn for dynamic zoom
          let distanceToNextTurn = null;
          if (routeSteps.length > currentStepIndex) {
            const currentStep = routeSteps[currentStepIndex];
            if (currentStep?.maneuver?.location) {
              const maneuverLocation = {
                latitude: currentStep.maneuver.location[1],
                longitude: currentStep.maneuver.location[0]
              };
              distanceToNextTurn = getDistanceFromLatLonInKm(
                newLocation.latitude,
                newLocation.longitude,
                maneuverLocation.latitude,
                maneuverLocation.longitude
              ) * 1000; // Convert to meters
            }
          }
          
          // Update map with Apple Maps style camera
          updateNavigationCamera(
            newLocation, 
            locationData.coords.speed || 0,
            distanceToNextTurn
          );
          
          // Recalculate route and ETA
          if (customerLocation) {
            generateRealRoute(newLocation, customerLocation);
          }

          // Update navigation progress
          updateNavigationProgress(newLocation);

          // Update driver location in database
          updateDriverLocationInDB(newLocation);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const updateDriverLocationInDB = async (location) => {
    try {
      if (request?.id) {
        await updateDriverStatus(request.id, TRIP_STATUS.IN_PROGRESS, location);
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const extractCustomerLocation = (driverLocation) => {
    // Helper function to parse coordinates that might be JSON strings
    const parseCoordinates = (coords) => {
      if (!coords) return null;
      
      // If it's already an object with latitude/longitude, return it
      if (typeof coords === 'object' && coords.latitude && coords.longitude) {
        return coords;
      }
      
      // If it's a JSON string, parse it
      if (typeof coords === 'string') {
        try {
          const parsed = JSON.parse(coords);
          if (parsed.latitude && parsed.longitude) {
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse coordinates:', e);
        }
      }
      
      return null;
    };

    // Try to get from request data first
    if (requestData) {
      // If we're en route to pickup, use pickup location
      if (PICKUP_PHASE_STATUSES.includes(requestData.status)) {
        const coords = parseCoordinates(requestData.pickup?.coordinates);
        if (coords) {
          console.log('Using pickup coordinates from requestData:', coords);
          return {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
      } 
      // If we're en route to dropoff, use dropoff location
      else if (DROPOFF_PHASE_STATUSES.includes(requestData.status)) {
        const coords = parseCoordinates(requestData.dropoff?.coordinates);
        if (coords) {
          console.log('Using dropoff coordinates from requestData:', coords);
          return {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
      }
    }

    // Also check the request from route params as fallback
    if (request) {
      const status = request.status || requestData?.status || TRIP_STATUS.ACCEPTED;
      if (PICKUP_PHASE_STATUSES.includes(status)) {
        const coords = parseCoordinates(request.pickup?.coordinates);
        if (coords) {
          console.log('Using pickup coordinates from route params:', coords);
          return {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
      } else if (DROPOFF_PHASE_STATUSES.includes(status)) {
        const coords = parseCoordinates(request.dropoff?.coordinates);
        if (coords) {
          console.log('Using dropoff coordinates from route params:', coords);
          return {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
        }
      }
    }

    console.warn('No valid customer location found, using fallback location');

    // Fallback: mock location near driver
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude + 0.005, // About 500m away
        longitude: driverLocation.longitude + 0.003,
      };
    }
    
    // Final fallback: fixed location
    return {
      latitude: 33.7540,
      longitude: -84.3830,
    };
  };

  const generateRealRoute = async (start, end) => {
    try {
      const routeData = await MapboxLocationService.getRoute(start, end);
      setRouteCoordinates(routeData.coordinates);
      
      // Store navigation steps for turn-by-turn guidance
      if (routeData.steps && routeData.steps.length > 0) {
        setRouteSteps(routeData.steps);
        setCurrentStepIndex(0);
        
        // Set initial instruction
        const firstStep = routeData.steps[0];
        setNextInstruction(firstStep.maneuver?.instruction || 'Continue straight');
        
        // Calculate distance to first maneuver
        if (firstStep.distance) {
          const distanceInMeters = firstStep.distance;
          setDistanceToTurn(formatDistance(distanceInMeters));
        }
      }
      
      // Update distance and ETA with real data
      const distanceText = routeData.distance.text;
      const durationText = routeData.duration_in_traffic ? 
        routeData.duration_in_traffic.text : 
        routeData.duration.text;
      
      setRemainingDistance(distanceText);
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
    } catch (error) {
      console.error('Error getting real route:', error);
      // Fallback to simple calculation if API fails
      calculateDistanceAndETA(start, end);
      generateFallbackRoute(start, end);
    }
  };

  const generateFallbackRoute = (start, end) => {
    // Simple straight-line route as fallback
    const route = [start, end];
    setRouteCoordinates(route);
  };

  const calculateDistanceAndETA = (driverCoords, customerCoords) => {
    try {
      // Calculate distance
      const distanceInKm = getDistanceFromLatLonInKm(
        driverCoords.latitude,
        driverCoords.longitude,
        customerCoords.latitude,
        customerCoords.longitude
      );
      
      // Format distance
      let formattedDistance;
      if (distanceInKm < 1) {
        formattedDistance = `${Math.round(distanceInKm * 1000)} m`;
      } else {
        formattedDistance = `${distanceInKm.toFixed(1)} km`;
      }
      
      // Calculate ETA (assuming average speed of 30 km/h)
      const timeInMinutes = Math.ceil((distanceInKm / 30) * 60);
      const formattedTime = timeInMinutes < 1 ? '<1 min' : `${timeInMinutes} min`;
      
      setRemainingDistance(formattedDistance);
      setEstimatedTime(formattedTime);
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  };

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // Navigation helper functions
  const formatDistance = (distanceInMeters) => {
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)} m`;
    } else {
      return `${(distanceInMeters / 1000).toFixed(1)} km`;
    }
  };

  const getManeuverIcon = (maneuverType) => {
    const iconMap = {
      'turn-right': 'turn-sharp-right',
      'turn-left': 'turn-sharp-left',
      'turn-slight-right': 'trending-up',
      'turn-slight-left': 'trending-up',
      'continue': 'arrow-up',
      'straight': 'arrow-up',
      'uturn': 'return-up-back',
      'merge': 'git-merge',
      'on-ramp': 'arrow-up-right',
      'off-ramp': 'arrow-down-right',
      'roundabout': 'refresh',
      'rotary': 'refresh',
      'roundabout-turn': 'refresh',
      'notification': 'flag',
      'depart': 'play',
      'arrive': 'flag-checkered'
    };
    
    return iconMap[maneuverType] || 'arrow-up';
  };

  const updateNavigationProgress = (currentLocation) => {
    if (!routeSteps.length || currentStepIndex >= routeSteps.length) return;

    const currentStep = routeSteps[currentStepIndex];
    
    // Calculate distance to current step's maneuver point
    if (currentStep.maneuver && currentStep.maneuver.location) {
      const maneuverLocation = {
        latitude: currentStep.maneuver.location[1],
        longitude: currentStep.maneuver.location[0]
      };
      
      const distanceToManeuver = getDistanceFromLatLonInKm(
        currentLocation.latitude,
        currentLocation.longitude,
        maneuverLocation.latitude,
        maneuverLocation.longitude
      ) * 1000; // Convert to meters

      // Update distance to turn
      setDistanceToTurn(formatDistance(distanceToManeuver));

      // Check if we're close enough to advance to next step
      if (distanceToManeuver < 50 && currentStepIndex < routeSteps.length - 1) {
        const nextStep = routeSteps[currentStepIndex + 1];
        setCurrentStepIndex(currentStepIndex + 1);
        setNextInstruction(nextStep.maneuver?.instruction || 'Continue');
        
        // Calculate distance to next maneuver
        if (nextStep.distance) {
          setDistanceToTurn(formatDistance(nextStep.distance));
        }
      }
    }
  };

  // Navigation instruction component
  const NavigationInstructions = () => {
    if (!nextInstruction || isCustomerView) return null;

    const currentStep = routeSteps[currentStepIndex];
    const maneuverType = currentStep?.maneuver?.type || 'continue';

    return (
      <View style={styles.navigationContainer}>
        {/* Purple header section with instruction */}
        <View style={[styles.navigationHeader, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.navigationHeaderContent}>
            <Text style={styles.distanceText}>
              {distanceToTurn || 'Calculating...'}
            </Text>
            <Text style={styles.instructionText} numberOfLines={2}>
              {nextInstruction}
            </Text>
            <View style={styles.directionArrows}>
              <Ionicons name="arrow-up" size={20} color={colors.white} />
              <Ionicons name="arrow-up" size={20} color={colors.white} />
              <Ionicons name="arrow-up" size={20} color={colors.white} />
              <Ionicons 
                name={getManeuverIcon(maneuverType)} 
                size={20} 
                color={colors.white}
                style={{ marginLeft: spacing.xs + 1 }}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const handleArrive = async () => {
    try {
      if (requestData?.id) {
        await arriveAtPickup(requestData.id, driverLocation);

        // Navigate to pickup confirmation screen
        navigation.navigate('PickupConfirmationScreen', { request: requestData, driverLocation });
      }
    } catch (error) {
      console.error('Error marking arrival:', error);
      Alert.alert('Error', 'Failed to update arrival status. Please try again.');
    }
  };

  const openChat = async () => {
    if (isCreatingChat) return;
    setIsCreatingChat(true);
    setHasUnreadChat(false);
    try {
      const req = requestData || route.params?.request || {};
      const requestId = req.id || req.requestId || req.originalData?.id;
      let customerId =
        req.customerId ||
        req.customer_id ||
        req.originalData?.customerId ||
        req.originalData?.customer_id ||
        req.customerUid ||
        req.customer?.uid ||
        req.customer?.id ||
        req.userId;
      let customerEmail =
        req.customerEmail ||
        req.customer_email ||
        req.originalData?.customerEmail ||
        req.originalData?.customer_email ||
        req.customer?.email ||
        '';

      if (requestId && !customerId) {
        try {
          const latestRequest = await getRequestById(requestId);
          customerId =
            latestRequest?.customerId ||
            latestRequest?.customer_id ||
            customerId;
          customerEmail =
            latestRequest?.customerEmail ||
            latestRequest?.customer_email ||
            customerEmail;
        } catch (fetchError) {
          console.warn('Failed to fetch latest request before opening chat:', fetchError);
        }
      }

      const customerName =
        req.customerName ||
        req.customer?.name ||
        req.customer?.displayName ||
        (customerEmail ? customerEmail.split('@')[0] : 'Customer');
      
      if (!requestId || !customerId || !currentUserId) {
        console.error('Missing required data for chat:', { requestId, customerId, currentUserId });
        return;
      }

      const conversationId = await createConversation(
        requestId,
        customerId,
        currentUserId,
        customerName,
        req.assignedDriverName
      );

      navigation.navigate('MessageScreen', {
        conversationId,
        requestId,
        driverName: customerName, // header shows the customer's name
      });
    } catch (e) {
      console.error('openChat error', e);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const renderCustomerView = () => {
    const cardTranslateY = cardAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [200, 0],
    });

    const isPickupStage = stage === 'pickup';
    return (
      <View style={styles.container}>
        {/* Map View */}
        <MapboxMap
          ref={mapRef}
          style={styles.map}
          centerCoordinate={driverLocation ? [driverLocation.longitude, driverLocation.latitude] : [-84.3880, 33.7490]}
          zoomLevel={18.5}
          pitch={60}
          bearing={currentHeading}
          padding={{ top: 100, bottom: 250, left: 50, right: 50 }}
          followUserLocation={false}
          followUserMode="course"
        >
          {driverLocation && (
            <Mapbox.MarkerView
              id="driver"
              coordinate={[driverLocation.longitude, driverLocation.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={18} color={colors.white} />
              </View>
            </Mapbox.MarkerView>
          )}
          
          {customerLocation && (
            <Mapbox.MarkerView
              id="customer"
              coordinate={[customerLocation.longitude, customerLocation.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={24} color={colors.primary} />
              </View>
            </Mapbox.MarkerView>
          )}
          
          {routeCoordinates.length > 0 && (
            <Mapbox.ShapeSource id="routeSource" shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates.map(coord => [coord.longitude, coord.latitude])
              }
            }}>
              <Mapbox.LineLayer
                id="routeLine"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 6,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.8,
                  lineGradient: [
                    'interpolate',
                    ['linear'],
                    ['line-progress'],
                    0, colors.primary,
                    1, colors.primaryDark
                  ]
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </MapboxMap>
        
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + spacing.sm }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        
        {/* Info Card */}
        <Animated.View 
          style={[
            styles.customerInfoCard, 
            {
              transform: [{ translateY: cardTranslateY }],
            }
          ]}
        >
          <LinearGradient
            colors={cardGradientColors}
            style={styles.cardGradient}
          >
            <View style={styles.etaContainer}>
              <Text style={styles.etaLabel}>Driver arriving in</Text>
              <Text style={styles.etaValue}>{estimatedTime}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.driverInfoContainer}>
              <View style={styles.driverImageContainer}>
                <Image
                  source={require('../../assets/profile.png')}
                  style={styles.driverImage}
                />
              </View>
              
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>
                  {requestData?.driver?.name || 'Your Driver'}
                </Text>
                <Text style={styles.vehicleInfo}>
                  {requestData?.driver?.vehicleInfo || 'Vehicle information not available'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.callButton}
                onPress={openChat}
                disabled={isCreatingChat}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
                {hasUnreadChat ? <View style={styles.callButtonUnreadDot} /> : null}
              </TouchableOpacity>
            </View>
            
            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.statusText}>
                  {isPickupStage ? "Picking up your items" : "Delivering your items"}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Ionicons name="navigate" size={18} color={colors.primary} />
                <Text style={styles.statusText}>
                  Distance: {remainingDistance}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  const renderDriverView = () => {
    const cardTranslateY = cardAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [200, 0],
    });

    // If Mapbox navigation is active, show floating overlay version
    if (isNavigating) {
      return (
        <View style={styles.container}>
          {/* Mapbox Navigation SDK runs full-screen here automatically */}
          
          {/* Close Navigation Button */}
              <TouchableOpacity
                style={[styles.closeNavButton, { top: insets.top + spacing.sm }]}
                onPress={() => stopNavigation()}
              >
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          
          {/* Floating Bottom Card */}
          <Animated.View 
            style={[
              styles.floatingBottomCard, 
              {
                transform: [{ translateY: cardTranslateY }],
              }
            ]}
          >
            <LinearGradient
              colors={cardGradientColors}
              style={styles.cardGradient}
            >
              <View style={styles.destinationHeader}>
                <View>
                  <Text style={styles.destinationTitle}>Pickup Location</Text>
                  <Text style={styles.destinationAddress} numberOfLines={1}>
                    {requestData?.pickupAddress || 'Address not available'}
                  </Text>
                </View>
                <View style={styles.etaBox}>
                  <Text style={styles.etaTime}>{estimatedTime}</Text>
                  <Text style={styles.etaLabel}>min</Text>
                </View>
              </View>
              
              <View style={styles.customerInfoContainer}>
                <View style={styles.customerAvatarContainer}>
                  {customerAvatarUrl ? (
                    <Image source={{ uri: customerAvatarUrl }} style={styles.customerAvatarImage} onError={() => setCustomerAvatarUrl(null)} />
                  ) : (
                    <Ionicons name="person" size={22} color={colors.text.muted} />
                  )}
                </View>

                <View style={styles.customerDetails}>
                  <Text style={styles.customerName}>
                    {requestData?.customer?.name || 'Customer'}
                  </Text>
                  <Text style={styles.itemInfo} numberOfLines={1}>
                    {requestData?.item?.description || 'Item information not available'}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.callButton}
                  onPress={openChat}
                  disabled={isCreatingChat}
                >
                  <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
                  {hasUnreadChat ? <View style={styles.callButtonUnreadDot} /> : null}
                </TouchableOpacity>
              </View>
              
              <View style={styles.actionContainer}>
                <TouchableOpacity 
                  style={styles.arriveButton}
                  onPress={handleArrive}
                >
                  <Text style={styles.arriveButtonText}>I've Arrived</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      );
    }

    // Otherwise show regular map view
    return (
      <View style={styles.container}>
        {/* Map View */}
        <MapboxMap
          ref={mapRef}
          style={styles.map}
          centerCoordinate={driverLocation ? [driverLocation.longitude, driverLocation.latitude] : [-84.3880, 33.7490]}
          zoomLevel={18.5}
          pitch={60}
          bearing={currentHeading}
          padding={{ top: 100, bottom: 250, left: 50, right: 50 }}
          followUserLocation={true}
          followUserMode="course"
        >
          {driverLocation && (
            <Mapbox.MarkerView
              id="driverLocation"
              coordinate={[driverLocation.longitude, driverLocation.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={18} color={colors.white} />
              </View>
            </Mapbox.MarkerView>
          )}
          
          {customerLocation && (
            <Mapbox.MarkerView
              id="pickupLocation"
              coordinate={[customerLocation.longitude, customerLocation.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={24} color={colors.primary} />
              </View>
            </Mapbox.MarkerView>
          )}
          
          {routeCoordinates.length > 0 && (
            <Mapbox.ShapeSource id="driverRouteSource" shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates.map(coord => [coord.longitude, coord.latitude])
              }
            }}>
              <Mapbox.LineLayer
                id="driverRouteLine"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </MapboxMap>
        
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + spacing.sm }]}
          onPress={() => {
            if (isNavigating) {
              stopNavigation();
            }
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>

        {/* Start Navigation Button (only show if navigation is supported) */}
        {isSupported && !isNavigating && driverLocation && customerLocation && (
          <TouchableOpacity
            style={[styles.startNavButton, { top: insets.top + spacing.sm }]}
            onPress={startNavigation}
          >
            <Ionicons name="navigate" size={20} color={colors.white} />
            <Text style={styles.startNavText}>Start Navigation</Text>
          </TouchableOpacity>
        )}

        {/* Turn-by-turn Navigation Instructions (only for fallback mode) */}
        {!isNavigating && <NavigationInstructions />}
        
        {/* Info Card */}
        <Animated.View 
          style={[
            styles.driverInfoCard, 
            {
              transform: [{ translateY: cardTranslateY }],
            }
          ]}
        >
          <LinearGradient
            colors={cardGradientColors}
            style={styles.cardGradient}
          >
            <View style={styles.destinationHeader}>
              <View>
                <Text style={styles.destinationTitle}>Pickup Location</Text>
                <Text style={styles.destinationAddress}>
                  {requestData?.pickupAddress || 'Address not available'}
                </Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaTime}>{estimatedTime}</Text>
                <Text style={styles.etaLabel}>min</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.customerInfoContainer}>
              <View style={styles.customerAvatarContainer}>
                {customerAvatarUrl ? (
                  <Image source={{ uri: customerAvatarUrl }} style={styles.customerAvatarImage} onError={() => setCustomerAvatarUrl(null)} />
                ) : (
                  <Ionicons name="person" size={22} color={colors.text.muted} />
                )}
              </View>

              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {requestData?.customer?.name || 'Customer'}
                </Text>
                <Text style={styles.itemInfo}>
                  {requestData?.item?.description || 'Item information not available'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.callButton}
                onPress={openChat}
                disabled={isCreatingChat}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
                {hasUnreadChat ? <View style={styles.callButtonUnreadDot} /> : null}
              </TouchableOpacity>
            </View>
            
            <View style={styles.actionContainer}>
              <TouchableOpacity 
                style={styles.arriveButton}
                onPress={handleArrive}
              >
                <Text style={styles.arriveButtonText}>I've Arrived</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading navigation...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color={colors.error} />
        <Text style={styles.errorText}>{locationError}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setLocationError(null);
            setIsLoading(true);
            if (isCustomerView) {
              initializeCustomerView();
            } else {
              initializeDriverNavigation();
            }
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return isCustomerView ? renderCustomerView() : renderDriverView();
}
