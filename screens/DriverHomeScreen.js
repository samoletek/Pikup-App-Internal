import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, ScrollView, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';

// Configure Mapbox with your token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN);
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import OfflineModal from '../components/OfflineModal';
import OfflineDashboard from '../components/OfflineDashboard';
import DrivingProgressModal from '../components/DrivingProgressModal';
import NavigationModal from '../components/NavigationModal';
import RequestModal from '../components/RequestModal';
import IncomingRequestModal from '../components/IncomingRequestModal';
import { LinearGradient } from 'expo-linear-gradient';
import useOrderStatusMonitor from '../hooks/useOrderStatusMonitor';

export default function DriverHomeScreen({ navigation, route }) {
  const { 
    userType, 
    currentUser,
    getAvailableRequests, 
    acceptRequest, 
    checkExpiredRequests,
    updateDriverLocation,
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat
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
  
  // State for tracking available requests
  const [availableRequests, setAvailableRequests] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [waitTime, setWaitTime] = useState('5 to 11 min');
  const [progressValue, setProgressValue] = useState(0.3); // Value between 0-1 for progress bar
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
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

  // Mock data for requests
  const mockRequests = [
    {
      id: '1',
      pickup: {
        address: '123 Main St, Atlanta, GA',
        coordinates: { latitude: 33.7490, longitude: -84.3880 }
      },
      dropoff: {
        address: '456 Peachtree St, Atlanta, GA',
        coordinates: { latitude: 33.7590, longitude: -84.3920 }
      },
      price: '$35.00',
      distance: '2.3 mi',
      time: '15 min',
      customer: {
        name: 'John D.',
        rating: 4.8,
        photo: require('../assets/profile.png')
      },
      item: {
        description: 'Medium-sized package, fragile',
        type: 'Package',
        needsHelp: false
      }
    },
    {
      id: '2',
      pickup: {
        address: '789 Piedmont Ave, Atlanta, GA',
        coordinates: { latitude: 33.7650, longitude: -84.3700 }
      },
      dropoff: {
        address: '101 Centennial Park, Atlanta, GA',
        coordinates: { latitude: 33.7620, longitude: -84.3930 }
      },
      price: '$42.50',
      distance: '3.1 mi',
      time: '20 min',
      customer: {
        name: 'Sarah M.',
        rating: 4.9,
        photo: require('../assets/profile.png')
      },
      item: {
        description: 'Furniture - Small table and chairs',
        type: 'Furniture',
        needsHelp: true
      }
    },
    {
      id: '3',
      pickup: {
        address: '555 Northside Dr, Atlanta, GA',
        coordinates: { latitude: 33.7690, longitude: -84.4050 }
      },
      dropoff: {
        address: '222 Tech Square, Atlanta, GA',
        coordinates: { latitude: 33.7760, longitude: -84.3890 }
      },
      price: '$28.75',
      distance: '1.8 mi',
      time: '12 min',
      customer: {
        name: 'Michael T.',
        rating: 4.7,
        photo: require('../assets/profile.png')
      },
      item: {
        description: 'Grocery delivery - 3 bags',
        type: 'Groceries',
        needsHelp: false
      }
    }
  ];

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
      setLastRefreshTime(new Date());
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
        
        // Update driver heartbeat in backend when online (throttled)
        if (isOnline && currentUser?.uid) {
          const now = Date.now();
          if (now - lastHeartbeatAt.current >= HEARTBEAT_INTERVAL_MS && movedEnough(driverLocation, newLocation)) {
            lastHeartbeatAt.current = now;
            updateDriverHeartbeat(currentUser.uid, newLocation).catch(error => {
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

  const handleGoOnline = async () => {
    if (isOnline || !currentUser?.uid) return;
    
    try {
      setLoading(true);
      
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
      
      // Set driver online in backend
      const sessionId = await setDriverOnline(currentUser.uid, driverPos);
      setCurrentSessionId(sessionId);
      
      // Set local state
      setIsOnline(true);
      
      console.log('Driver is now online with session:', sessionId);
    } catch (error) {
      console.error('Error going online:', error);
      alert('Could not go online. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOffline = () => {
    if (!isOnline) return;
    
    showModal('offline');
  };

  const confirmGoOffline = async () => {
    if (!currentUser?.uid) return;
    
    try {
      setLoading(true);
      
      // Set driver offline in backend
      await setDriverOffline(currentUser.uid);
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

  const getRefreshTimeText = () => {
    if (!lastRefreshTime) return 'Not yet refreshed';
    
    const now = new Date();
    const diff = Math.floor((now - lastRefreshTime) / 1000); // seconds
    
    if (diff < 60) return `Updated ${diff} seconds ago`;
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)} minutes ago`;
    return `Updated ${Math.floor(diff / 3600)} hours ago`;
  };


  const renderModal = () => {
    switch (currentModal) {
      case 'offline':
        return (
          <OfflineModal
            onConfirm={confirmGoOffline}
            onCancel={hideModal}
          />
        );
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
          style={styles.map}
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
                  <View style={styles.requestMarkerArrow} />
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
                  lineColor: '#A77BFF',
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
      <View style={styles.header}>
        <View style={styles.leftSection}>
          <Image 
            source={require('../assets/pikup-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          {/* Fallback text logo - uncomment to use instead of image */}
          {/* <Text style={styles.appName}>PikUp</Text> */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, isOnline ? styles.onlineIndicator : styles.offlineIndicator]} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
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
              colors={['#7C3AED', '#6366F1']}
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
      
      {/* View All Requests Button (only when online and requests available) */}
      {/* {isOnline && availableRequests.length > 0 && (
        <View style={styles.viewAllButtonContainer}>
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => setShowAllRequests(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(167, 123, 255, 0.9)', 'rgba(167, 123, 255, 0.7)']}
              style={styles.viewAllButtonGradient}
            >
              <View style={styles.viewAllButtonContent}>
                <Ionicons name="list" size={20} color="#fff" />
                <Text style={styles.viewAllButtonText}>
                  View All Requests ({availableRequests.length})
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )} */}


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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    zIndex: 10,
  },
  leftSection: {
    alignItems: 'flex-start',
  },
  logoImage: {
    width: 350,
    aspectRatio: 4.08,
    height: undefined,
    resizeMode: "contain",
    marginTop: -25,
    marginBottom: -55,
  },
  appName: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
    textShadowColor: "rgba(167, 123, 255, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineIndicator: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  offlineIndicator: {
    backgroundColor: '#F44336',
    shadowColor: '#F44336',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 31, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  waitTimeContainer: {
    marginBottom: 16,
  },
  waitTimeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  waitTimeSubtext: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 16,
  },
  progressContainer: {
    backgroundColor: 'rgba(30, 30, 56, 0.6)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(42, 42, 66, 0.8)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#A77BFF',
    borderRadius: 3,
  },
  nextLevelText: {
    color: '#aaa',
    fontSize: 14,
  },
  goOnlineButtonContainer: {
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    borderRadius: 28,
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ skewX: '-20deg' }],
    zIndex: 1,
  },
  goOfflineButton: {
    backgroundColor: '#4B5563',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    shadowColor: '#4B5563',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  onlineButtonCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 8,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  goOnlineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  goOfflineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  viewAllButtonContainer: {
    position: 'absolute',
    bottom: 280,
    left: 20,
    right: 20,
  },
  viewAllButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  viewAllButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  viewAllButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  driverMarker: {
    backgroundColor: '#A77BFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  requestMarker: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#00D4AA',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedMarker: {
    backgroundColor: '#A77BFF',
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
    shadowColor: '#A77BFF',
  },
  requestMarkerPrice: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1a1a2e',
  },
});