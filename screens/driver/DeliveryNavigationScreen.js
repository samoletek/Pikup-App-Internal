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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import MapboxLocationService from '../../services/MapboxLocationService';
import MapboxMap from '../../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { LinearGradient } from 'expo-linear-gradient';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import useMapboxNavigation from '../../components/mapbox/useMapboxNavigation';
import styles from './DeliveryNavigationScreen.styles';
import { TRIP_STATUS } from '../../constants/tripStatus';
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

export default function DeliveryNavigationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { request, pickupPhotos, driverLocation: initialDriverLocation } = route.params;
  const {
    arriveAtDropoff,
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
  
  const [driverLocation, setDriverLocation] = useState(initialDriverLocation);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
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
  const conversationUserType = userType === 'customer' ? 'customer' : 'driver';
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
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const cardAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const customerAvatarCacheRef = useRef(new Map());
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(requestData?.id, navigation, {
    currentScreen: 'DeliveryNavigationScreen',
    enabled: !!requestData?.id,
    onCancel: () => {
      // Stop location tracking when order is cancelled
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      // Stop Mapbox navigation if active
      if (isNavigating) {
        stopNavigation();
      }
    }
  });
  
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
    destination: dropoffLocation,
    onRouteProgress: (progress) => {
      // Update ETA and distance from navigation progress
      if (progress.durationRemaining) {
        const minutes = Math.round(progress.durationRemaining / 60);
        setEstimatedTime(minutes < 1 ? '<1' : minutes.toString());
      }
    },
    onArrival: () => {
      Alert.alert('Navigation', 'You have arrived at your destination!');
      stopNavigation();
      handleArriveAtDropoff();
    },
    onCancel: () => {
      // Navigation was cancelled by user
      console.log('Delivery navigation cancelled by user');
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
    initializeDeliveryTracking();

    return () => {
      // Clean up location tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      
      // Stop Mapbox navigation if active
      if (isNavigating) {
        stopNavigation();
      }
    };
    // Screen bootstrap is intentionally one-time; retry button handles manual re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start Mapbox Navigation when coordinates are ready
  useEffect(() => {
    if (Platform.OS === 'ios' && 
        isSupported && 
        driverLocation && 
        dropoffLocation && 
        !isNavigating && 
        !navigationAttempted) {
      
      setNavigationAttempted(true);
      
      startNavigation().catch((error) => {
        console.log('Mapbox navigation not available for delivery, using fallback map:', error);
        // Keep navigationAttempted true to prevent retries
      });
    }
  }, [
    driverLocation,
    dropoffLocation,
    isSupported,
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

    if (!activeRequestCustomerId || typeof getUserProfile !== 'function') {
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
  }, [activeRequestCustomerId, getUserProfile, request, requestData]);

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
    } catch (error) {
      console.error('Error fetching request data:', error);
    }
  };

  const initializeDeliveryTracking = async () => {
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

      let currentLocation = initialDriverLocation;
      
      // Get fresh location if we don't have one
      if (!currentLocation) {
        try {
          const locationData = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 15000, // 15 second timeout
            maximumAge: 10000, // Accept 10 second old location
          });
          
          currentLocation = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
          };
        } catch (locationError) {
          console.error('Error getting current location:', locationError);
          
          // Fallback to last known location
          try {
            const lastKnownLocation = await Location.getLastKnownPositionAsync({
              maxAge: 60000, // Accept location up to 1 minute old
            });
            
            if (lastKnownLocation) {
              currentLocation = {
                latitude: lastKnownLocation.coords.latitude,
                longitude: lastKnownLocation.coords.longitude,
              };
            } else {
              throw new Error('No location available');
            }
          } catch (_fallbackError) {
            setLocationError('Unable to get your location. Please check your GPS settings.');
            setIsLoading(false);
            return;
          }
        }
      }

      setDriverLocation(currentLocation);

      // Set initial map region with Apple Maps style
      if (mapRef.current && mapRef.current.setCamera) {
        mapRef.current.setCamera({
          centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
          zoomLevel: 18.5, // Much closer zoom for street-level view
          pitch: 60, // 3D perspective
          bearing: 0,
          animationDuration: 1000,
          padding: {
            top: 100,
            bottom: 250,
            left: 50,
            right: 50
          }
        });
      }

      // Start real-time location tracking
      startLocationTracking();

      // Extract dropoff location from request data
      const dropoffCoords = extractDropoffLocation(currentLocation);
      if (dropoffCoords) {
        setDropoffLocation(dropoffCoords);
        generateRealRoute(currentLocation, dropoffCoords);
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error initializing delivery tracking:', error);
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
          if (dropoffLocation) {
            generateRealRoute(newLocation, dropoffLocation);
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
        await updateDriverStatus(request.id, TRIP_STATUS.EN_ROUTE_TO_DROPOFF, location);
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  };

  const extractDropoffLocation = (currentLocation) => {
    // Try to get dropoff coordinates from request data
    if (requestData?.dropoffCoordinates) {
      return requestData.dropoffCoordinates;
    }
    
    if (requestData?.dropoffLat && requestData?.dropoffLng) {
      return {
        latitude: requestData.dropoffLat,
        longitude: requestData.dropoffLng
      };
    }
    
    // For now, use mock location near driver if no real data available
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude + 0.008, // About 800m away
        longitude: currentLocation.longitude + 0.005,
      };
    }
    
    // Fallback mock location
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
      const durationText = routeData.duration_in_traffic ? 
        routeData.duration_in_traffic.text : 
        routeData.duration.text;
      
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

  const calculateDistanceAndETA = (driverCoords, dropoffCoords) => {
    // Calculate distance
    const distanceInKm = getDistanceFromLatLonInKm(
      driverCoords.latitude,
      driverCoords.longitude,
      dropoffCoords.latitude,
      dropoffCoords.longitude
    );
    
    // Calculate ETA (assuming average speed of 30 km/h)
    const timeInMinutes = Math.ceil(distanceInKm / 30 * 60);
    
    setEstimatedTime(timeInMinutes < 1 ? '<1' : timeInMinutes.toString());
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
    if (!nextInstruction || isNavigating) return null;

    const currentStep = routeSteps[currentStepIndex];
    const maneuverType = currentStep?.maneuver?.type || 'continue';

    return (
      <View style={styles.navigationContainer}>
        {/* Purple header section with instruction */}
        <View style={[styles.navigationHeader, { paddingTop: insets.top + spacing.sm }]}>
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

  const handleArriveAtDropoff = async () => {
    try {
      if (requestData?.id) {
        await arriveAtDropoff(requestData.id, driverLocation);

        // Navigate to delivery confirmation screen
        navigation.navigate('DeliveryConfirmationScreen', { 
          request: requestData,
          pickupPhotos: pickupPhotos,
          driverLocation
        });
      }
    } catch (error) {
      console.error('Error marking arrival at dropoff:', error);
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
            initializeDeliveryTracking();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderNavigationView = () => {
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
                  <Text style={styles.destinationTitle}>Dropoff Location</Text>
                  <Text style={styles.destinationAddress} numberOfLines={1}>
                    {requestData?.dropoffAddress || 'Address not available'}
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
                  onPress={handleArriveAtDropoff}
                >
                  <Text style={styles.arriveButtonText}>I've Arrived at Dropoff</Text>
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
          centerCoordinate={[
            driverLocation?.longitude || -84.3880,
            driverLocation?.latitude || 33.7490
          ]}
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
          
          {dropoffLocation && (
            <Mapbox.MarkerView
              id="dropoffLocation"
              coordinate={[dropoffLocation.longitude, dropoffLocation.latitude]}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={24} color={colors.primary} />
              </View>
            </Mapbox.MarkerView>
          )}
          
          {routeCoordinates.length > 0 && (
            <Mapbox.ShapeSource id="deliveryRouteSource" shape={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates.map(coord => [coord.longitude, coord.latitude])
              }
            }}>
              <Mapbox.LineLayer
                id="deliveryRouteLine"
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
        {isSupported && !isNavigating && driverLocation && dropoffLocation && (
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
            styles.infoCard, 
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
                <Text style={styles.destinationTitle}>Dropoff Location</Text>
                <Text style={styles.destinationAddress}>
                  {requestData?.dropoffAddress || 'Address not available'}
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
                onPress={handleArriveAtDropoff}
              >
                <Text style={styles.arriveButtonText}>I've Arrived at Dropoff</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  return renderNavigationView();
}
