import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Alert, Easing, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';

// Configure Mapbox with your token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN);
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import OfflineDashboard from '../../components/OfflineDashboard';
import DrivingProgressModal from '../../components/DrivingProgressModal';
import NavigationModal from '../../components/NavigationModal';
import RequestModal from '../../components/RequestModal';
import IncomingRequestModal from '../../components/IncomingRequestModal';
import PhoneVerificationModal from '../../components/PhoneVerificationModal';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import {
  ACTIVE_TRIP_STATUSES,
  DROPOFF_PHASE_STATUSES,
  normalizeTripStatus,
} from '../../constants/tripStatus';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../../styles/theme';

const TIMER_SECONDS = 180;
const ACTIVE_TRIP_STATUS_LABELS = Object.freeze({
  accepted: 'Driver confirmed',
  inProgress: 'On the way to pickup',
  arrivedAtPickup: 'Arrived at pickup',
  pickedUp: 'Package collected',
  enRouteToDropoff: 'On the way to destination',
  arrivedAtDropoff: 'Arrived at destination',
});

export default function DriverHomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    userType,
    currentUser,
    getUserPickupRequests,
    getAvailableRequests,
    acceptRequest,
    checkExpiredRequests,
    updateDriverLocation,
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat,
    refreshProfile
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const [region, setRegion] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentModal, setCurrentModal] = useState(null); // 'offline', 'driving', 'navigation'
  const [activeJob, setActiveJob] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // New incoming request modal state
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);

  // Phone verification modal
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);

  // Route for incoming request (Mapbox Directions)
  const [incomingRoute, setIncomingRoute] = useState(null); // GeoJSON LineString
  const [incomingMarkers, setIncomingMarkers] = useState(null); // { pickup, dropoff }
  const cameraRef = useRef(null);

  // Minimize + timer state for incoming request
  const [isMinimized, setIsMinimized] = useState(false);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState(0);
  const requestTimerRef = useRef(null);
  const handleDeclineRef = useRef(null);
  const isAcceptingRequestRef = useRef(false);
  const miniBarPulse = useRef(new Animated.Value(0)).current;
  const onlineDriverPulse = useRef(new Animated.Value(0)).current;

  // State for tracking available requests
  const [availableRequests, setAvailableRequests] = useState([]);
  const waitTime = '5 to 11 min';
  const progressValue = 0.3;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
  const [isRestoringActiveTrip, setIsRestoringActiveTrip] = useState(true);
  const restoreInFlightRef = useRef(false);

  // Driver session tracking
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Location tracking
  const locationSubscription = useRef(null);
  const mapRef = useRef(null);

  // Background refresh interval
  const backgroundRefreshInterval = useRef(null);

  // Heartbeat throttling
  const lastHeartbeatAt = useRef(0);
  const HEARTBEAT_INTERVAL_MS = 20000; // 20 seconds
  const MIN_MOVE_METERS = 100;

  // Helper function to calculate if driver moved enough for heartbeat
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const movedEnough = (prev, next) => {
    if (!prev) return true;
    const distanceMiles = calculateDistance(prev.latitude, prev.longitude, next.latitude, next.longitude);
    const distanceMeters = distanceMiles * 1609.34; // Convert to meters
    return distanceMeters >= MIN_MOVE_METERS;
  };

  // Modal animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  const onlineDriverMarkerCoordinate = useMemo(() => {
    if (!driverLocation?.longitude || !driverLocation?.latitude) {
      return null;
    }

    return [driverLocation.longitude, driverLocation.latitude];
  }, [driverLocation?.longitude, driverLocation?.latitude]);

  const shouldShowOnlineDriverMarker = Boolean(
    isOnline && !acceptedRequestId && onlineDriverMarkerCoordinate
  );

  const onlineDriverPulseSize = onlineDriverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 94],
  });

  const onlineDriverPulseOpacity = onlineDriverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.05],
  });

  const hasActiveTrip = Boolean(acceptedRequestId && activeJob?.id);
  const activeJobStatus = normalizeTripStatus(activeJob?.status);
  const activeJobStatusLabel = ACTIVE_TRIP_STATUS_LABELS[activeJobStatus] || 'Active order';
  const activeJobDestinationAddress = useMemo(() => {
    if (!activeJob) {
      return '';
    }

    if (DROPOFF_PHASE_STATUSES.includes(activeJobStatus)) {
      return activeJob.dropoffAddress || activeJob?.dropoff?.address || 'Drop-off location';
    }

    return activeJob.pickupAddress || activeJob?.pickup?.address || 'Pickup location';
  }, [activeJob, activeJobStatus]);

  const activeJobSecondaryLabel = useMemo(() => {
    const primaryItem = activeJob?.item || activeJob?.items?.[0];
    if (primaryItem?.name) {
      return primaryItem.name;
    }

    if (activeJob?.vehicleType) {
      return activeJob.vehicleType;
    }

    return null;
  }, [activeJob]);

  const openActiveTrip = useCallback((trip) => {
    if (!trip?.id) {
      return;
    }

    const normalizedStatus = normalizeTripStatus(trip.status);

    if (DROPOFF_PHASE_STATUSES.includes(normalizedStatus)) {
      navigation.navigate('DeliveryNavigationScreen', {
        request: trip,
        driverLocation: trip?.driverLocation || driverLocation || null,
      });
      return;
    }

    navigation.navigate('GpsNavigationScreen', {
      request: trip,
      stage: 'pickup',
    });
  }, [driverLocation, navigation]);

  const restoreActiveTrip = useCallback(async ({ initialLoad = false } = {}) => {
    if (!currentUserId || userType !== 'driver' || typeof getUserPickupRequests !== 'function') {
      if (initialLoad) {
        setIsRestoringActiveTrip(false);
      }
      return null;
    }

    if (restoreInFlightRef.current) {
      return null;
    }

    restoreInFlightRef.current = true;
    if (initialLoad) {
      setIsRestoringActiveTrip(true);
    }

    try {
      const requests = await getUserPickupRequests();
      if (!Array.isArray(requests)) {
        setAcceptedRequestId(null);
        setActiveJob(null);
        return null;
      }

      const activeTrip = requests
        .filter((trip) => {
          if (!trip?.id) return false;

          const normalizedStatus = normalizeTripStatus(trip.status);
          if (!ACTIVE_TRIP_STATUSES.includes(normalizedStatus)) {
            return false;
          }

          const assignedDriverId = trip.driverId || trip.driver_id || trip.assignedDriverId || trip.assigned_driver_id;
          return assignedDriverId === currentUserId;
        })
        .sort((a, b) => {
          const aTime = new Date(a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || 0).getTime();
          const bTime = new Date(b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || 0).getTime();
          return bTime - aTime;
        })[0] || null;

      if (!activeTrip) {
        setAcceptedRequestId(null);
        setActiveJob(null);
        return null;
      }

      setAcceptedRequestId(activeTrip.id);
      setActiveJob(activeTrip);
      setIncomingRequest(null);
      setShowIncomingModal(false);
      setIsMinimized(false);
      setIncomingRoute(null);
      setIncomingMarkers(null);
      setAvailableRequests((prev) => prev.filter((request) => request.id !== activeTrip.id));
      setIsOnline(true);

      return activeTrip;
    } catch (restoreError) {
      console.error('Error restoring active trip:', restoreError);
      return null;
    } finally {
      restoreInFlightRef.current = false;
      if (initialLoad) {
        setIsRestoringActiveTrip(false);
      }
    }
  }, [currentUserId, getUserPickupRequests, userType]);

  // Monitor order status for accepted requests
  useOrderStatusMonitor(acceptedRequestId, navigation, {
    currentScreen: 'DriverHomeScreen',
    enabled: !!acceptedRequestId,
    onCancel: () => {
      // Reset state when order is cancelled
      setAcceptedRequestId(null);
      setActiveJob(null);
      // Reload requests to refresh the list
      loadRequests(false);
    }
  });

  useEffect(() => {
    if (!currentUserId || userType !== 'driver') {
      setAcceptedRequestId(null);
      setActiveJob(null);
      setIsRestoringActiveTrip(false);
      return;
    }

    restoreActiveTrip({ initialLoad: true });
  }, [currentUserId, restoreActiveTrip, userType]);

  useFocusEffect(
    useCallback(() => {
      restoreActiveTrip({ initialLoad: false });
    }, [restoreActiveTrip])
  );

  useEffect(() => {
    initializeLocation();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      // Clean up auto-refresh intervals
      clearAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!shouldShowOnlineDriverMarker) {
      onlineDriverPulse.stopAnimation();
      onlineDriverPulse.setValue(0);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(onlineDriverPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(onlineDriverPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      onlineDriverPulse.stopAnimation();
      onlineDriverPulse.setValue(0);
    };
  }, [onlineDriverPulse, shouldShowOnlineDriverMarker]);

  // Handle route parameters for navigation from other screens
  useEffect(() => {
    if (route.params?.selectedRequest) {
      setSelectedRequest(route.params.selectedRequest);
      setShowRequestModal(true);
    }
  }, [route.params]);

  // Start real-time location tracking and auto-refresh
  useEffect(() => {
    if (hasActiveTrip) {
      clearAutoRefresh();
    }

    if (isOnline && !hasActiveTrip && !locationSubscription.current) {
      startLocationTracking();
      startAutoRefresh(); // Start auto-refresh when going online
      // Load initial requests
      loadRequests();
    } else if ((!isOnline || hasActiveTrip) && locationSubscription.current) {
      stopLocationTracking();
      clearAutoRefresh(); // Stop auto-refresh when going offline
    }
  }, [hasActiveTrip, isOnline]);

  // Auto-refresh functions
  const startAutoRefresh = () => {
    console.log('Starting auto-refresh...');

    // Background refresh to update request count every 30 seconds
    backgroundRefreshInterval.current = setInterval(async () => {
      if (isOnline && !hasActiveTrip) {
        console.log('Background refresh of requests...');

        // Check for expired requests first
        try {
          const expiredCount = await checkExpiredRequests();
          if (expiredCount > 0) {
            console.log(`Reset ${expiredCount} expired requests`);
          }
        } catch (error) {
          console.error('Error checking expired requests:', error);
        }

        // Then load fresh requests
        loadRequests(false);
      }
    }, 10000); // Check every 10 seconds for real-time feel
  };

  const clearAutoRefresh = () => {
    if (backgroundRefreshInterval.current) {
      clearInterval(backgroundRefreshInterval.current);
      backgroundRefreshInterval.current = null;
    }
  };

  const loadRequests = async (showLoading = true) => {
    if (hasActiveTrip) {
      setAvailableRequests([]);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);

    try {
      console.log('Loading available pickup requests...');

      // Get requests that are already properly formatted by getAvailableRequests
      const requests = await getAvailableRequests();

      setAvailableRequests(requests);
      console.log(`Loaded ${requests.length} real requests from Firebase`);
    } catch (error) {
      console.error('Error loading requests:', error);
      setError('Could not load available requests');
      setAvailableRequests([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const initializeLocation = async () => {
    // Request foreground permission first
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // Request background permission for continuous tracking
    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      console.warn('Background location permission not granted. Real-time tracking may be limited.');
    }

    let loc = await Location.getCurrentPositionAsync({});
    const newRegion = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(newRegion);
    setDriverLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  const startLocationTracking = async () => {
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000, // Update every 2 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (loc) => {
        const newLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setDriverLocation(newLocation);

        const currentUserId = currentUser?.uid || currentUser?.id;

        // Update driver heartbeat in backend when online (throttled)
        if (isOnline && currentUserId) {
          const now = Date.now();
          if (now - lastHeartbeatAt.current >= HEARTBEAT_INTERVAL_MS && movedEnough(driverLocation, newLocation)) {
            lastHeartbeatAt.current = now;
            updateDriverHeartbeat(currentUserId, newLocation).catch(error => {
              console.error('Error updating heartbeat:', error);
            });
          }
        }

        // Update driver location in database if there's an active job
        if (activeJob?.id) {
          updateDriverLocation(activeJob.id, newLocation);
        }

        // Update map region to follow driver
        if (mapRef.current && (currentModal === 'driving' || currentModal === 'navigation')) {
          mapRef.current.animateToRegion({
            ...newLocation,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
        }
      }
    );
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const showModal = (modalType, data = null) => {
    setCurrentModal(modalType);
    if (data) setActiveJob(data);

    // Animate modal in
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideModal = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setCurrentModal(null);
    });
  };

  const checkDriverReadiness = async () => {
    const driverId = currentUser?.uid || currentUser?.id;
    if (!driverId) return { ready: false, issues: ['Not authenticated'] };

    // Fetch fresh profile from DB
    const { data: profile, error } = await supabase
      .from('drivers')
      .select('phone_verified, onboarding_complete, identity_verified')
      .eq('id', driverId)
      .single();

    if (error || !profile) return { ready: false, issues: ['Could not load profile'] };

    const issues = [];
    // BYPASS: Checks disabled for development
    // if (!profile.phone_verified) issues.push('phone');
    // if (!profile.onboarding_complete) issues.push('vehicle');
    // if (!profile.identity_verified) issues.push('identity');

    return { ready: issues.length === 0, issues, profile };
  };

  const handleGoOnline = () => {
    if (hasActiveTrip && activeJob) {
      openActiveTrip(activeJob);
      return;
    }

    if (isOnline) return;

    Alert.alert(
      'Select Driving Mode',
      'Choose how you want to drive',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Solo', onPress: () => confirmGoOnline('SOLO') },
        { text: 'Team', onPress: () => confirmGoOnline('TEAM') }
      ]
    );
  };

  const confirmGoOnline = async (mode) => {
    if (isOnline || !currentUserId) return;

    try {
      setLoading(true);

      // Check driver readiness
      const { ready, issues } = await checkDriverReadiness();

      if (!ready) {
        setLoading(false);

        if (issues.includes('phone')) {
          Alert.alert(
            'Phone Verification Required',
            'You must verify your phone number before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Verify Now', onPress: () => setPhoneVerifyVisible(true) },
            ]
          );
          return;
        }

        if (issues.includes('vehicle')) {
          Alert.alert(
            'Vehicle Registration Required',
            'Please complete your vehicle registration in the onboarding section before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Profile', onPress: () => navigation.navigate('DriverProfile') },
            ]
          );
          return;
        }

        if (issues.includes('identity')) {
          Alert.alert(
            'Identity Verification Required',
            'Please complete identity verification before going online.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Profile', onPress: () => navigation.navigate('DriverProfile') },
            ]
          );
          return;
        }

        return;
      }

      // Check location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        alert('Location permission is required to go online.');
        setLoading(false);
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({});
      const driverPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDriverLocation(driverPos);

      // Set driver online in backend with selected mode
      const sessionId = await setDriverOnline(currentUserId, driverPos, mode);
      setCurrentSessionId(sessionId);

      // Set local state
      setIsOnline(true);

      console.log('Driver is now online with session:', sessionId, 'Mode:', mode);
    } catch (error) {
      console.error('Error going online:', error);
      alert('Could not go online. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOffline = () => {
    if (!isOnline) return;
    if (hasActiveTrip) {
      Alert.alert(
        'Active order in progress',
        'Complete or cancel the current order before going offline.'
      );
      return;
    }

    Alert.alert(
      'Go Offline?',
      'You will stop receiving new pickup requests.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Offline', style: 'destructive', onPress: confirmGoOffline }
      ]
    );
  };

  const confirmGoOffline = async () => {
    const currentUserId = currentUser?.uid || currentUser?.id;
    if (!currentUserId) return;

    try {
      setLoading(true);

      // Set driver offline in backend
      await setDriverOffline(currentUserId);
      setCurrentSessionId(null);

      // Set local state
      setIsOnline(false);
      hideModal();

      console.log('Driver is now offline');
    } catch (error) {
      console.error('Error going offline:', error);
      alert('Could not go offline. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleRequestMarkerPress = (request) => {
    console.log('Request marker pressed:', request.id);
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  const handleAcceptRequest = async (request) => {
    if (isAcceptingRequestRef.current || !request?.id) {
      return;
    }

    try {
      isAcceptingRequestRef.current = true;
      console.log('Accepting request:', request.id);
      // Accept the request
      await acceptRequest(request.id);

      // Start monitoring the accepted request
      setAcceptedRequestId(request.id);
      setActiveJob(request);
      setAvailableRequests((prev) => prev.filter((item) => item.id !== request.id));

      // Close modal and navigate to GPS navigation
      setShowRequestModal(false);
      setShowAllRequests(false);
      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Could not accept request. Please try again.');
    } finally {
      isAcceptingRequestRef.current = false;
    }
  };

  const handleViewRequestDetails = (request) => {
    // Keep modal open and show request details (already shown in modal)
    console.log('Viewing details for request:', request.id);
  };

  const handleMessageCustomer = (request) => {
    setShowRequestModal(false);
    // TODO: Start conversation with customer
    console.log('Starting conversation with customer for request:', request.id);
  };

  // Fetch route from Mapbox Directions API for incoming request
  const fetchRouteForRequest = async (request) => {
    try {
      const pickupCoords = request?.pickup?.coordinates;
      const dropoffCoords = request?.dropoff?.coordinates;
      if (!pickupCoords?.longitude || !pickupCoords?.latitude ||
          !dropoffCoords?.longitude || !dropoffCoords?.latitude) {
        return;
      }

      const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords.longitude},${pickupCoords.latitude};${dropoffCoords.longitude},${dropoffCoords.latitude}?geometries=geojson&overview=full&access_token=${token}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        setIncomingRoute({
          type: 'Feature',
          properties: {},
          geometry: data.routes[0].geometry,
        });
        setIncomingMarkers({
          pickup: [pickupCoords.longitude, pickupCoords.latitude],
          dropoff: [dropoffCoords.longitude, dropoffCoords.latitude],
        });
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  };

  const clearIncomingRoute = () => {
    setIncomingRoute(null);
    setIncomingMarkers(null);
  };

  // Handle snap changes from IncomingRequestModal (0=full, 1=half)
  const handleIncomingSnapChange = (snapIndex) => {
    // Camera adjustments based on snap if needed
    console.log('Incoming modal snap:', snapIndex);
  };

  // Fetch route when incoming request appears (keep when minimized)
  useEffect(() => {
    if ((showIncomingModal || isMinimized) && incomingRequest) {
      fetchRouteForRequest(incomingRequest);
    } else if (!showIncomingModal && !isMinimized) {
      clearIncomingRoute();
    }
  }, [showIncomingModal, isMinimized, incomingRequest]);

  // Timer management — starts when incomingRequest is set, persists across minimize/expand
  useEffect(() => {
    if (!incomingRequest) {
      setRequestTimeRemaining(0);
      if (requestTimerRef.current) {
        clearInterval(requestTimerRef.current);
        requestTimerRef.current = null;
      }
      return;
    }

    setRequestTimeRemaining(TIMER_SECONDS);

    requestTimerRef.current = setInterval(() => {
      setRequestTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(requestTimerRef.current);
          requestTimerRef.current = null;
          setTimeout(() => handleDeclineRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (requestTimerRef.current) {
        clearInterval(requestTimerRef.current);
        requestTimerRef.current = null;
      }
    };
  }, [incomingRequest]);

  // Mini-bar pulse glow animation
  useEffect(() => {
    if (isMinimized && incomingRequest) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(miniBarPulse, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(miniBarPulse, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      miniBarPulse.setValue(0);
    }
  }, [isMinimized, incomingRequest]);

  // Incoming request handlers
  const handleIncomingRequestAccept = async (request) => {
    if (isAcceptingRequestRef.current || !request?.id) {
      return;
    }

    try {
      isAcceptingRequestRef.current = true;
      console.log('Accepting incoming request:', request.id);
      await acceptRequest(request.id);

      setAcceptedRequestId(request.id);
      setActiveJob(request);
      setAvailableRequests((prev) => prev.filter((item) => item.id !== request.id));
      setShowIncomingModal(false);
      setIsMinimized(false);
      setIncomingRequest(null);
      clearIncomingRoute();

      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      console.error('Error accepting incoming request:', error);
      alert('Could not accept request. Please try again.');
    } finally {
      isAcceptingRequestRef.current = false;
    }
  };

  const handleIncomingRequestDecline = () => {
    const currentRequestId = incomingRequest?.id;
    setShowIncomingModal(false);
    setIsMinimized(false);
    setIncomingRequest(null);
    clearIncomingRoute();
    console.log('Declined incoming request:', currentRequestId);

    // Remove the declined request from available requests
    setAvailableRequests(prev => prev.filter(req => req.id !== currentRequestId));

    // After a short delay, show the next request if available
    setTimeout(() => {
      setAvailableRequests(current => {
        if (current.length > 0 && isOnline) {
          const nextRequest = current[0];
          setIncomingRequest(nextRequest);
          setShowIncomingModal(true);
          console.log('Auto-showing next request after decline:', nextRequest.id);
        }
        return current;
      });
    }, 2000);
  };

  // Keep decline ref always up to date (must be after declaration)
  handleDeclineRef.current = handleIncomingRequestDecline;

  const handleIncomingRequestMinimize = () => {
    setShowIncomingModal(false);
    setIsMinimized(true);
    // Fit camera to route bounds
    if (incomingMarkers) {
      const { pickup, dropoff } = incomingMarkers;
      const sw = [Math.min(pickup[0], dropoff[0]) - 0.01, Math.min(pickup[1], dropoff[1]) - 0.01];
      const ne = [Math.max(pickup[0], dropoff[0]) + 0.01, Math.max(pickup[1], dropoff[1]) + 0.01];
      if (cameraRef.current) {
        cameraRef.current.fitBounds(ne, sw, [80, 60, 200, 60], 1000);
      }
    }
  };

  const handleExpandFromMiniBar = () => {
    setIsMinimized(false);
    setShowIncomingModal(true);
  };

  const formatRequestTime = (s) => {
    const sec = Math.max(0, s);
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  // Auto-show incoming request when new requests are available (like Uber)
  useEffect(() => {
    if (isOnline && !hasActiveTrip && availableRequests.length > 0 && !showIncomingModal && !incomingRequest && !isMinimized) {
      // Small delay to make it feel more natural
      const timer = setTimeout(() => {
        const firstRequest = availableRequests[0];
        setIncomingRequest(firstRequest);
        setShowIncomingModal(true);

        // Haptic feedback for incoming request (like Uber)
        // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        console.log('Auto-showing incoming request:', firstRequest.id);
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    }
  }, [availableRequests, hasActiveTrip, incomingRequest, isMinimized, isOnline, showIncomingModal]);

  const renderModal = () => {
    switch (currentModal) {
      case 'driving':
        return (
          <DrivingProgressModal
            request={activeJob}
            onClose={hideModal}
          />
        );
      case 'navigation':
        return (
          <NavigationModal
            request={activeJob}
            onClose={hideModal}
          />
        );
      default:
        return null;
    }
  };


  return (
    <View style={styles.container}>
      {/* Always show map */}
      {region && (
        <Mapbox.MapView
          ref={mapRef}
          style={[styles.map, { bottom: -tabBarHeight }]}
          styleURL={Mapbox.StyleURL.Dark}
          scaleBarEnabled={false}
          onPress={() => console.log('Map pressed')}
        >
          <Mapbox.Camera
            ref={cameraRef}
            centerCoordinate={[region.longitude, region.latitude]}
            zoomLevel={14}
            followUserLocation={isOnline && !incomingRoute}
            followUserMode={isOnline && !incomingRoute ? 'compass' : 'none'}
          />

          {/* Show user location */}
          <Mapbox.UserLocation
            visible={!shouldShowOnlineDriverMarker}
            showsUserHeadingIndicator={isOnline && !shouldShowOnlineDriverMarker}
          />

          {/* Pulsing driver marker while online and waiting for order acceptance */}
          {shouldShowOnlineDriverMarker && onlineDriverMarkerCoordinate && (
            <Mapbox.MarkerView
              id="online-driver-marker"
              coordinate={onlineDriverMarkerCoordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
              allowOverlapWithPuck
            >
              <View style={styles.onlineDriverMarkerContainer}>
                <Animated.View
                  style={[
                    styles.onlineDriverMarkerPulse,
                    {
                      opacity: onlineDriverPulseOpacity,
                      width: onlineDriverPulseSize,
                      height: onlineDriverPulseSize,
                    },
                  ]}
                />
                <View style={styles.onlineDriverMarkerCore}>
                  <Image
                    source={require('../../assets/pickup-truck.png')}
                    style={styles.onlineDriverMarkerIcon}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </Mapbox.MarkerView>
          )}

          {/* Show available pickup request markers (hide when incoming is active) */}
          {isOnline && !hasActiveTrip && !showIncomingModal && !isMinimized && availableRequests.map((request) => {
            // Skip if coordinates are invalid
            if (!request?.pickup?.coordinates?.longitude || !request?.pickup?.coordinates?.latitude) {
              return null;
            }

            const isSelected = selectedRequest && selectedRequest.id === request.id;

            return (
              <Mapbox.MarkerView
                key={request.id}
                id={`request-${request.id}`}
                coordinate={[request.pickup.coordinates.longitude, request.pickup.coordinates.latitude]}
                anchor={{ x: 0.5, y: 1 }}
                allowOverlap
              >
                <TouchableOpacity
                  onPress={() => handleRequestMarkerPress(request)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.requestMarkerCircle,
                    isSelected && styles.selectedMarker
                  ]}>
                    <Ionicons name="cash-outline" size={16} color={colors.white} />
                  </View>
                </TouchableOpacity>
              </Mapbox.MarkerView>
            );
          })}

          {/* Show route if active (legacy) */}
          {routeCoordinates.length > 0 && routeCoordinates.every(coord => coord?.longitude && coord?.latitude) && (
            <Mapbox.ShapeSource
              id="route-source"
              shape={{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates.map(coord => [coord.longitude, coord.latitude])
                }
              }}
            >
              <Mapbox.LineLayer
                id="route-line"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Incoming request route line */}
          {incomingRoute && (
            <Mapbox.ShapeSource id="incoming-route-source" shape={incomingRoute}>
              <Mapbox.LineLayer
                id="incoming-route-line"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 5,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.85,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Incoming request pickup marker */}
          {incomingMarkers?.pickup && (
            <Mapbox.MarkerView
              id="incoming-pickup"
              coordinate={incomingMarkers.pickup}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <View style={[styles.routeMarker, { backgroundColor: colors.primaryDark }]} />
            </Mapbox.MarkerView>
          )}

          {/* Incoming request dropoff marker */}
          {incomingMarkers?.dropoff && (
            <Mapbox.MarkerView
              id="incoming-dropoff"
              coordinate={incomingMarkers.dropoff}
              anchor={{ x: 0.5, y: 1 }}
              allowOverlap
            >
              <View style={[styles.routeMarker, { backgroundColor: colors.primary }]} />
            </Mapbox.MarkerView>
          )}
        </Mapbox.MapView>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Image
          source={require('../../assets/pikup-logo.png')}
          style={styles.logoImage}
        />
      </View>

      {/* Bottom Panel — hide when incoming request is active */}
      {!showIncomingModal && !isMinimized && <View
        style={[
          styles.bottomPanel,
          {
            paddingBottom: insets.bottom + spacing.base,
          },
        ]}
      >
        {isRestoringActiveTrip ? (
          <View style={styles.restoringTripContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.restoringTripText}>Restoring active order...</Text>
          </View>
        ) : hasActiveTrip && activeJob ? (
          <View style={styles.activeTripContainer}>
            <View style={styles.activeTripHeader}>
              <View style={styles.activeTripHeaderIcon}>
                <Ionicons name="navigate" size={16} color={colors.white} />
              </View>
              <View style={styles.activeTripHeaderTextWrap}>
                <Text style={styles.activeTripTitle}>Active Order</Text>
                <Text style={styles.activeTripStatusText}>{activeJobStatusLabel}</Text>
              </View>
            </View>

            <Text style={styles.activeTripAddress} numberOfLines={2}>
              {activeJobDestinationAddress}
            </Text>

            {activeJobSecondaryLabel ? (
              <Text style={styles.activeTripSecondaryLabel} numberOfLines={1}>
                {activeJobSecondaryLabel}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.activeTripButton}
              onPress={() => openActiveTrip(activeJob)}
              activeOpacity={0.85}
            >
              <Text style={styles.activeTripButtonText}>Resume trip</Text>
            </TouchableOpacity>
          </View>
        ) : isOnline ? (
          <>
            <View style={styles.waitTimeContainer}>
              <Text style={styles.waitTimeText}>{waitTime} wait in your area</Text>
              <Text style={styles.waitTimeSubtext}>Average wait for 10 pickup request over the last hour</Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Current Progress</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progressValue * 100}%` }]} />
              </View>
              <Text style={styles.nextLevelText}>Next Level: Gold</Text>
            </View>

            <TouchableOpacity
              style={styles.goOfflineButton}
              onPress={handleGoOffline}
              activeOpacity={0.8}
            >
              <View style={styles.onlineButtonCircle} />
              <Text style={styles.goOfflineText}>Go Offline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.goOnlineButtonContainer}
            onPress={handleGoOnline}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primaryDark, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.goOnlineButton}
            >
              <View style={styles.buttonContent}>
                <View style={styles.onlineButtonCircle} />
                <Text style={styles.goOnlineText}>Go Online</Text>
              </View>
              <View style={styles.buttonShine} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>}

      {/* Floating mini-bar when minimized */}
      {isMinimized && incomingRequest && (
        <Animated.View
          style={[
            styles.miniBar,
            { bottom: spacing.lg },
            {
              borderColor: miniBarPulse.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(125,95,255,0.5)', 'rgba(125,95,255,0.85)'],
              }),
              shadowColor: miniBarPulse.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(125,95,255,0.45)', 'rgba(125,95,255,0.75)'],
              }),
              shadowOpacity: miniBarPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 0.85],
              }),
              shadowRadius: miniBarPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 20],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.miniBarInner}
            onPress={handleExpandFromMiniBar}
            activeOpacity={0.9}
          >
            <View style={styles.miniBarLeft}>
              <Ionicons name="timer-outline" size={18} color={requestTimeRemaining <= 30 ? colors.error : colors.primary} />
              <Text style={[styles.miniBarTimer, { color: requestTimeRemaining <= 30 ? colors.error : colors.primary }]}>
                {formatRequestTime(requestTimeRemaining)}
              </Text>
            </View>
            <Text style={styles.miniBarPrice} numberOfLines={1}>
              {incomingRequest.driverPayout || incomingRequest.earnings || incomingRequest.price || '$0.00'}
            </Text>
            <View style={styles.miniBarExpand}>
              <Ionicons name="chevron-up" size={20} color={colors.text.primary} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Current Modal */}
      {currentModal && (
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0]
                  })
                }
              ]
            }
          ]}
        >
          {renderModal()}
        </Animated.View>
      )}

      {/* Request Modal */}
      <RequestModal
        visible={showRequestModal || showAllRequests}
        requests={availableRequests}
        selectedRequest={selectedRequest}
        currentLocation={driverLocation}
        loading={loading}
        error={error}
        onClose={() => {
          setShowRequestModal(false);
          setShowAllRequests(false);
          setSelectedRequest(null);
        }}
        onAccept={handleAcceptRequest}
        onViewDetails={handleViewRequestDetails}
        onMessage={handleMessageCustomer}
        onRefresh={() => loadRequests()}
      />

      {/* Incoming Request Modal */}
      <IncomingRequestModal
        visible={showIncomingModal}
        request={incomingRequest}
        timeRemaining={requestTimeRemaining}
        timerTotal={TIMER_SECONDS}
        onAccept={handleIncomingRequestAccept}
        onDecline={handleIncomingRequestDecline}
        onMinimize={handleIncomingRequestMinimize}
        onSnapChange={handleIncomingSnapChange}
      />

      {/* Offline Dashboard Overlay */}
      {!isOnline && !hasActiveTrip && !isRestoringActiveTrip && (
        <OfflineDashboard
          onGoOnline={handleGoOnline}
          navigation={navigation}
        />
      )}

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={() => setPhoneVerifyVisible(false)}
        onVerified={async () => {
          setPhoneVerifyVisible(false);
          await refreshProfile();
        }}
        userId={currentUser?.uid || currentUser?.id}
        userTable="drivers"
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  logoImage: {
    width: 106,
    height: 20,
    resizeMode: 'contain',
    ...shadows.lg,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.navigation.tabBarBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.navigation.tabBarBorder,
  },
  restoringTripContainer: {
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoringTripText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  activeTripContainer: {
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    padding: spacing.base,
  },
  activeTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activeTripHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  activeTripHeaderTextWrap: {
    flex: 1,
  },
  activeTripTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  activeTripStatusText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  activeTripAddress: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  activeTripSecondaryLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
  },
  activeTripButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTripButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
  waitTimeContainer: {
    marginBottom: spacing.base,
  },
  waitTimeText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  waitTimeSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    lineHeight: 16,
  },
  progressContainer: {
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.base + 2,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
  },
  progressLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  nextLevelText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  goOnlineButtonContainer: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    borderRadius: borderRadius.full,
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.navigation.tabBarBorder,
    position: 'relative',
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    left: -50,
    right: -50,
    height: '100%',
    backgroundColor: colors.navigation.tabBarBorder,
    transform: [{ skewX: '-20deg' }],
    zIndex: 1,
  },
  goOfflineButton: {
    backgroundColor: colors.background.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: borderRadius.full,
    shadowColor: colors.background.elevated,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: colors.navigation.tabBarBorder,
  },
  onlineButtonCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
    shadowColor: colors.white,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  goOnlineText: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: 0.5,
    textShadowColor: colors.overlayDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  goOfflineText: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: 0.5,
    textShadowColor: colors.overlayDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  requestMarker: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: spacing.xs,
    elevation: 4,
    alignItems: 'center',
  },
  requestMarkerCircle: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.base,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: spacing.xs,
    elevation: 4,
  },
  selectedMarker: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
  },
  selectedMarkerArrow: {},
  requestMarkerPrice: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  requestMarkerArrow: {
    display: 'none',
  },
  onlineDriverMarkerContainer: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDriverMarkerPulse: {
    backgroundColor: colors.transparent,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 999,
  },
  onlineDriverMarkerCore: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  onlineDriverMarkerIcon: {
    width: 24,
    height: 14,
  },
  routeMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.base,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: spacing.xs,
    elevation: 4,
  },
  routeMarkerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeMarkerLabel: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  miniBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(125,95,255,0.5)',
    shadowColor: 'rgba(125,95,255,0.45)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  miniBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  miniBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniBarTimer: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.xs,
  },
  miniBarPrice: {
    flex: 1,
    textAlign: 'center',
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  miniBarExpand: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.base,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
