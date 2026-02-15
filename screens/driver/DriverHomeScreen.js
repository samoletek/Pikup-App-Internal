import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import { LinearGradient } from 'expo-linear-gradient';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import {
  borderRadius,
  colors,
  layout,
  shadows,
  spacing,
  typography,
} from '../../styles/theme';

export default function DriverHomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const panelMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const {
    userType,
    currentUser,
    getAvailableRequests,
    acceptRequest,
    checkExpiredRequests,
    updateDriverLocation,
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat,
    refreshProfile
  } = useAuth();
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

  // State for tracking available requests
  const [availableRequests, setAvailableRequests] = useState([]);
  const waitTime = '5 to 11 min';
  const progressValue = 0.3;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);

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

  // Monitor order status for accepted requests
  useOrderStatusMonitor(acceptedRequestId, navigation, {
    currentScreen: 'DriverHomeScreen',
    enabled: !!acceptedRequestId,
    onCancel: () => {
      // Reset state when order is cancelled
      setAcceptedRequestId(null);
      // Reload requests to refresh the list
      loadRequests(false);
    }
  });

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

  // Handle route parameters for navigation from other screens
  useEffect(() => {
    if (route.params?.selectedRequest) {
      setSelectedRequest(route.params.selectedRequest);
      setShowRequestModal(true);
    }
  }, [route.params]);

  // Start real-time location tracking and auto-refresh
  useEffect(() => {
    if (isOnline && !locationSubscription.current) {
      startLocationTracking();
      startAutoRefresh(); // Start auto-refresh when going online
      // Load initial requests
      loadRequests();
    } else if (!isOnline && locationSubscription.current) {
      stopLocationTracking();
      clearAutoRefresh(); // Stop auto-refresh when going offline
    }
  }, [isOnline]);

  // Auto-refresh functions
  const startAutoRefresh = () => {
    console.log('Starting auto-refresh...');

    // Background refresh to update request count every 30 seconds
    backgroundRefreshInterval.current = setInterval(async () => {
      if (isOnline) {
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
    const currentUserId = currentUser?.uid || currentUser?.id;
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
    try {
      console.log('Accepting request:', request.id);
      // Accept the request
      await acceptRequest(request.id);

      // Start monitoring the accepted request
      setAcceptedRequestId(request.id);

      // Close modal and navigate to GPS navigation
      setShowRequestModal(false);
      setShowAllRequests(false);
      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      console.error('Error accepting request:', error);
      alert('Could not accept request. Please try again.');
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

  // Incoming request handlers
  const handleIncomingRequestAccept = async (request) => {
    try {
      console.log('Accepting incoming request:', request.id);
      await acceptRequest(request.id);

      setAcceptedRequestId(request.id);
      setShowIncomingModal(false);
      setIncomingRequest(null);

      navigation.navigate('GpsNavigationScreen', { request });
    } catch (error) {
      console.error('Error accepting incoming request:', error);
      alert('Could not accept request. Please try again.');
    }
  };

  const handleIncomingRequestDecline = () => {
    const currentRequestId = incomingRequest?.id;
    setShowIncomingModal(false);
    setIncomingRequest(null);
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

          // Haptic feedback for next request
          // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          console.log('Auto-showing next request after decline:', nextRequest.id);
        }
        return current;
      });
    }, 2000); // 2 second delay before next request
  };

  const handleIncomingRequestMessage = (request) => {
    // TODO: Start conversation with customer
    console.log('Starting conversation with customer for incoming request:', request.id);
  };


  // Auto-show incoming request when new requests are available (like Uber)
  useEffect(() => {
    if (isOnline && availableRequests.length > 0 && !showIncomingModal && !incomingRequest) {
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
  }, [availableRequests, isOnline, showIncomingModal, incomingRequest]);

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
            centerCoordinate={[region.longitude, region.latitude]}
            zoomLevel={14}
            followUserLocation={isOnline}
            followUserMode={isOnline ? 'compass' : 'none'}
          />

          {/* Show user location */}
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={isOnline}
          />

          {/* Show available pickup request markers */}
          {isOnline && availableRequests.map((request) => {
            // Skip if coordinates are invalid
            if (!request?.pickup?.coordinates?.longitude || !request?.pickup?.coordinates?.latitude) {
              return null;
            }

            const isSelected = selectedRequest && selectedRequest.id === request.id;

            return (
              <Mapbox.PointAnnotation
                key={request.id}
                id={`request-${request.id}`}
                coordinate={[request.pickup.coordinates.longitude, request.pickup.coordinates.latitude]}
                onSelected={() => handleRequestMarkerPress(request)}
              >
                <View style={[
                  styles.requestMarker,
                  isSelected && styles.selectedMarker
                ]}>
                  <Text style={styles.requestMarkerPrice}>{request.price}</Text>
                  <View
                    style={[
                      styles.requestMarkerArrow,
                      isSelected && styles.selectedMarkerArrow,
                    ]}
                  />
                </View>
              </Mapbox.PointAnnotation>
            );
          })}

          {/* Show route if active */}
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
        </Mapbox.MapView>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Image
          source={require('../../assets/pikup-logo.png')}
          style={styles.logoImage}
        />
      </View>

      {/* Bottom Panel */}
      <View
        style={[
          styles.bottomPanel,
          {
            paddingBottom: insets.bottom + spacing.base,
            maxWidth: panelMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        {isOnline ? (
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
      </View>

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
        onAccept={handleIncomingRequestAccept}
        onDecline={handleIncomingRequestDecline}
        onMessage={handleIncomingRequestMessage}
      />

      {/* Offline Dashboard Overlay */}
      {!isOnline && (
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
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedMarker: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
    transform: [{ scale: 1.1 }],
    shadowColor: colors.primary,
  },
  selectedMarkerArrow: {
    borderTopColor: colors.primary,
  },
  requestMarkerPrice: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.base,
  },
  requestMarkerArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
    borderTopColor: colors.background.secondary,
  },
});
