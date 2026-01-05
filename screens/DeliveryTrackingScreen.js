import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  Alert,
  StatusBar,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import MapboxLocationService from '../services/MapboxLocationService';
import MapboxMap from '../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import { LinearGradient } from 'expo-linear-gradient';
import CancelOrderModal from '../components/CancelOrderModal';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.55;
const BOTTOM_SECTION_HEIGHT = height * 0.45;

export default function DeliveryTrackingScreen({ route, navigation }) {
  const { requestId, requestData: initialRequestData } = route.params || {};
  const {
    getRequestById,
    updateRequestStatus,
    getCancellationInfo,
    createConversation,
    currentUser,
  } = useAuth();
  const {
    notifyDriverAccepted,
    notifyDriverArrived,
    notifyItemsPickedUp,
    notifyDeliveryCompleted,
    notifyEtaUpdate,
    notifyPhotosUploaded,
    showToast
  } = useNotifications();
  
  // State management
  const [requestData, setRequestData] = useState(initialRequestData);
  const [driverLocation, setDriverLocation] = useState(null);
  const [previousDriverLocation, setPreviousDriverLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(!initialRequestData);
  const [orderDetailsExpanded, setOrderDetailsExpanded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [remainingDistance, setRemainingDistance] = useState('Calculating...');
  const [previousStatus, setPreviousStatus] = useState(initialRequestData?.status);
  const [previousEta, setPreviousEta] = useState('--');
  
  // Image modal state
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  
  // Cancel order modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  
  // Handle successful order cancellation
  const handleCancelSuccess = () => {
    setCancelModalVisible(false);
    // Navigate back to home screen
    navigation.navigate('CustomerHome');
  };
  
  // Animation references
  const mapRef = useRef(null);
  const scrollViewRef = useRef(null);
  const imageScrollRef = useRef(null);
  const bottomSectionY = useRef(new Animated.Value(0)).current;
  const orderDetailsHeight = useRef(new Animated.Value(0)).current;

  // Helper function to calculate distance between two points in miles
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

  // Driver profile is no longer needed since we store driver names in request data

  // Initialize and fetch data
  useEffect(() => {
    if (requestId) {
      fetchRequestData();
      
      // Set up real-time updates every 5 seconds for more responsive tracking
      const interval = setInterval(() => {
        fetchRequestData();
      }, 5000);
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [requestId]);

  // Handle delivery completion navigation
  useEffect(() => {
    if (requestData?.status === 'completed') {
      // Navigate to feedback screen when delivered
      navigation.replace('DeliveryFeedbackScreen', {
        requestId,
        requestData,
        returnToHome: true
      });
    }
  }, [requestData?.status]);

  // Smart notifications - detect status changes and trigger notifications
  useEffect(() => {
    if (!requestData || !previousStatus) return;

    const currentStatus = requestData.status;
    const driverName = getDriverInfo().name;

    // Trigger notifications based on status changes
    if (previousStatus !== currentStatus) {
      switch (currentStatus) {
        case 'confirmed':
          if (previousStatus === 'pending') {
            showToast('Order confirmed! Finding your driver...');
          }
          break;
          
        case 'pickupInProgress':
        case 'accepted':
          if (['confirmed', 'pending'].includes(previousStatus)) {
            notifyDriverAccepted(driverName);
          }
          break;
          
        case 'arrivedAtPickup':
          if (['pickupInProgress', 'accepted', 'inProgress'].includes(previousStatus)) {
            notifyDriverArrived('pickup');
          }
          break;
          
        case 'pickedUp':
          if (previousStatus === 'arrivedAtPickup') {
            notifyItemsPickedUp();
          }
          break;
          
        case 'deliveryInProgress':
        case 'enRouteToDropoff':
          if (previousStatus === 'pickedUp') {
            showToast('Items secured! Heading to delivery location...');
          }
          break;
          
        case 'arrivedAtDropoff':
          if (['deliveryInProgress', 'pickedUp', 'enRouteToDropoff'].includes(previousStatus)) {
            notifyDriverArrived('delivery');
          }
          break;
          
        case 'completed':
          if (previousStatus === 'arrivedAtDropoff') {
            notifyDeliveryCompleted();
          }
          break;
      }
      
      setPreviousStatus(currentStatus);
    }

    // Check for new photos
    const hasNewPickupPhotos = requestData.pickupPhotos && 
      requestData.pickupPhotos.length > 0 && 
      ['pickedUp', 'enRouteToDropoff', 'arrivedAtDropoff', 'completed'].includes(currentStatus);
    
    const hasNewDeliveryPhotos = requestData.dropoffPhotos && 
      requestData.dropoffPhotos.length > 0 && 
      currentStatus === 'completed';

    if (hasNewPickupPhotos && previousStatus === 'arrivedAtPickup') {
      notifyPhotosUploaded('pickup');
    }
    
    if (hasNewDeliveryPhotos && previousStatus === 'arrivedAtDropoff') {
      notifyPhotosUploaded('delivery');
    }

  }, [requestData?.status, requestData?.pickupPhotos, requestData?.dropoffPhotos]);

  // ETA change notifications
  useEffect(() => {
    if (estimatedTime !== '--' && previousEta !== '--' && estimatedTime !== previousEta) {
      // Only notify if ETA changed significantly (more than 2 minutes difference)
      const currentMinutes = parseInt(estimatedTime);
      const previousMinutes = parseInt(previousEta);
      
      if (!isNaN(currentMinutes) && !isNaN(previousMinutes)) {
        const timeDiff = Math.abs(currentMinutes - previousMinutes);
        if (timeDiff >= 2) {
          notifyEtaUpdate(estimatedTime);
        }
      }
    }
    setPreviousEta(estimatedTime);
  }, [estimatedTime]);

  const fetchRequestData = async () => {
    try {
      if (!requestId) return;
      
      const latestData = await getRequestById(requestId);
      
      // Temporary logging to debug photo data
      console.log('=== PHOTO DEBUG INFO ===');
      console.log('pickupPhotos:', latestData?.pickupPhotos);
      console.log('dropoffPhotos:', latestData?.dropoffPhotos);
      console.log('status:', latestData?.status);
      console.log('========================');
      
      setRequestData(latestData);
      setLoading(false);
      
      // Load driver profile if we have a driver assigned
      if (latestData.assignedDriverId && !driverProfile) {
        try {
          const profile = await getUserProfile(latestData.assignedDriverId);
          setDriverProfile(profile);
        } catch (error) {
          console.error('Error loading driver profile:', error);
        }
      }
      
      // Update driver location and route
      if (latestData.driverLocation) {
        // Check if driver location has changed significantly (more than 50 meters)
        const hasLocationChanged = !previousDriverLocation || 
          calculateDistance(
            previousDriverLocation.latitude, 
            previousDriverLocation.longitude,
            latestData.driverLocation.latitude, 
            latestData.driverLocation.longitude
          ) > 0.03; // Approximately 50 meters

        if (hasLocationChanged) {
          console.log('Driver location updated:', latestData.driverLocation);
          setPreviousDriverLocation(driverLocation);
          setDriverLocation(latestData.driverLocation);
          
          // Get destination based on current status
          const destination = getDestinationForStatus(latestData);
          if (destination) {
            generateRoute(latestData.driverLocation, destination);
            
            // Center map to show both points
            centerMapToShowRoute(latestData.driverLocation, destination);
          }
        }
      } else {
        // No driver location yet, but we can still show the destination and use pre-calculated distance
        console.log('No driver location, using pre-calculated distance');
        const destination = getDestinationForStatus(latestData);
        if (destination) {
          // Use the pre-calculated distance and time from the request data
          if (latestData.estimatedDistance) {
            setRemainingDistance(latestData.estimatedDistance);
          }
          if (latestData.estimatedTime) {
            setEstimatedTime(latestData.estimatedTime.replace(' mins', '').replace(' min', ''));
          }
          
          // Center map on destination
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: destination.latitude,
              longitude: destination.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching request data:', error);
      setLoading(false);
    }
  };

  const getDestinationForStatus = (data) => {
    if (!data) return null;
    
    let destination;
    
    // Before pickup: show pickup location
    if (['confirmed', 'pickupInProgress', 'accepted', 'inProgress', 'arrivedAtPickup'].includes(data.status)) {
      destination = data.pickupCoordinates || 
                   data.pickup?.coordinates || 
                   data.selectedLocations?.pickup?.coordinates;
      
      // Parse coordinates if they're JSON strings
      if (typeof destination === 'string') {
        try {
          destination = JSON.parse(destination);
        } catch (e) {
          console.error('Error parsing pickup coordinates:', e);
          destination = null;
        }
      }
      
      // Fallback to individual lat/lng or default
      if (!destination && data.pickupLat && data.pickupLng) {
        destination = {
          latitude: data.pickupLat,
          longitude: data.pickupLng
        };
      }
      
      if (!destination) {
        destination = {
          latitude: 33.7490,
          longitude: -84.3880
        };
      }
    } else {
      // After pickup: show delivery location
      destination = data.dropoffCoordinates || 
                   data.dropoff?.coordinates || 
                   data.selectedLocations?.dropoff?.coordinates;
      
      // Parse coordinates if they're JSON strings
      if (typeof destination === 'string') {
        try {
          destination = JSON.parse(destination);
        } catch (e) {
          console.error('Error parsing dropoff coordinates:', e);
          destination = null;
        }
      }
      
      // Fallback to individual lat/lng or default
      if (!destination && data.dropoffLat && data.dropoffLng) {
        destination = {
          latitude: data.dropoffLat,
          longitude: data.dropoffLng
        };
      }
      
      if (!destination) {
        destination = {
          latitude: 33.7540,
          longitude: -84.3900
        };
      }
    }
    
    return destination;
  };

  const generateRoute = async (start, end) => {
    try {
      const routeData = await MapboxLocationService.getRoute(start, end);
      setRouteCoordinates(routeData.coordinates);
      
      const distanceText = routeData.distance.text;
      const durationText = routeData.duration_in_traffic ? 
        routeData.duration_in_traffic.text : 
        routeData.duration.text;
      
      setRemainingDistance(distanceText);
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
    } catch (error) {
      console.error('Error generating route:', error);
      // Fallback to straight line
      setRouteCoordinates([start, end]);
    }
  };

  const centerMapToShowRoute = (start, end) => {
    if (mapRef.current && start && end) {
      mapRef.current.fitToCoordinates([start, end], {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  };

  const handleCall = () => {
    const phoneNumber = requestData?.driverPhone || requestData?.assignedDriverEmail;
    if (phoneNumber) {
      const formattedNumber = Platform.OS === 'android' ? `tel:${phoneNumber}` : `telprompt:${phoneNumber}`;
      Linking.openURL(formattedNumber);
    } else {
      Alert.alert('No Phone Number', 'Unable to call driver at this time');
    }
  };

  const handleChat = async () => {
    if (isCreatingChat) return;
    setIsCreatingChat(true);
    try {
      const req = requestData || initialRequestData || {};
      const requestIdLocal = req.id || requestId;
      const customerId = req.customerId || req.customerUid || req.customer?.uid || req.userId;
      const customerEmail = req.customerEmail || req.customer?.email || '';
      const customerName =
        req.customerName ||
        req.customer?.name ||
        req.customer?.displayName ||
        (customerEmail ? customerEmail.split('@')[0] : 'Customer');
      
      const assignedDriverId = req.assignedDriverId || req.assignedDriver || req.driverId;
      const driverName = req.assignedDriverName || req.driverName || 'Driver';
      
      if (!requestIdLocal || !customerId || !assignedDriverId || !currentUser?.uid) {
        console.error('Missing required data for chat:', { requestIdLocal, customerId, assignedDriverId, currentUserUid: currentUser?.uid });
        return;
      }

      const conversationId = `${requestIdLocal}_${customerId}_${assignedDriverId}`;
      await createConversation(requestIdLocal, customerId, assignedDriverId, customerName, driverName);

      navigation.navigate('MessageScreen', {
        conversationId,
        requestId: requestIdLocal,
        driverName: driverName, // header shows the driver's name
      });
    } catch (e) {
      console.error('handleChat error', e);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const toggleOrderDetails = () => {
    const toValue = orderDetailsExpanded ? 0 : 200;
    
    Animated.spring(orderDetailsHeight, {
      toValue,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
    
    setOrderDetailsExpanded(!orderDetailsExpanded);
  };

  const openImageModal = (images, startIndex = 0) => {
    setSelectedImages(images);
    setCurrentImageIndex(startIndex);
    setImageModalVisible(true);
    
    // Scroll to the selected image after modal opens
    setTimeout(() => {
      if (imageScrollRef.current) {
        imageScrollRef.current.scrollTo({
          x: startIndex * width,
          animated: false,
        });
      }
    }, 100);
  };

  const closeImageModal = () => {
    setImageModalVisible(false);
    setSelectedImages([]);
    setCurrentImageIndex(0);
  };

  const handleImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    setCurrentImageIndex(newIndex);
  };

  const getDriverInfo = () => {
    if (!requestData) return { name: 'Driver', email: '', rating: 5.0, vehicleType: 'Vehicle' };
    
    const driverEmail = requestData.assignedDriverEmail || requestData.driverEmail;
    const driverName =
      requestData.assignedDriverName ||
      (driverEmail ? driverEmail.split('@')[0] : 'Driver');
    
    return {
      name: driverName,
      email: driverEmail,
      rating: requestData.assignedDriverRating ?? 5.0,
      vehicleType: requestData.vehicleType || 'Vehicle'
    };
  };

  const getDeliveryStage = () => {
    if (!requestData) return 0;
    
    const status = requestData.status;
    switch (status) {
      case 'confirmed': return 1;
      
      // All pickup-related statuses map to stage 2
      case 'pickupInProgress':
      case 'accepted':
      case 'inProgress':
      case 'arrivedAtPickup':
      case 'pickedUp': return 2;
      
      // All delivery-related statuses map to stage 3
      case 'deliveryInProgress':
      case 'enRouteToDropoff':
      case 'arrivedAtDropoff': return 3;
      
      case 'completed': return 4;
      
      default: return 1;
    }
  };

  const getStatusMessage = () => {
    if (!requestData) return { title: 'Loading...', subtitle: 'Please wait' };
    
    const driverName = getDriverInfo().name;
    
    switch (requestData.status) {
      case 'confirmed':
        return {
          title: 'Looking for driver',
          subtitle: 'We\'re matching you with the perfect driver',
          icon: 'search-outline'
        };
      case 'pickupInProgress':
      case 'accepted':
      case 'inProgress':
        return {
          title: 'Driver en route to pickup',
          subtitle: `${driverName} is on the way • ETA: ${estimatedTime}`,
          icon: 'car-outline'
        };
      case 'arrivedAtPickup':
        return {
          title: 'Driver at pickup',
          subtitle: `${driverName} is at pickup location`,
          icon: 'location'
        };
      case 'pickedUp':
        return {
          title: 'Picked up',
          subtitle: `${driverName} has your items and is getting ready to go`,
          icon: 'cube-outline'
        };
      case 'deliveryInProgress':
      case 'enRouteToDropoff':
        return {
          title: 'Driver en route to delivery',
          subtitle: `Heading to delivery location • ETA: ${estimatedTime}`,
          icon: 'car'
        };
      case 'arrivedAtDropoff':
        return {
          title: 'Driver at delivery',
          subtitle: `${driverName} is at delivery location`,
          icon: 'home'
        };
      case 'completed':
        return {
          title: 'Delivered! Hope you love your items ✨',
          subtitle: 'Delivery completed successfully',
          icon: 'checkmark-circle'
        };
      default:
        return {
          title: 'Looking for driver',
          subtitle: 'Your delivery is being processed',
          icon: 'search-outline'
        };
    }
  };

  const renderProgressBar = () => {
    const currentStage = getDeliveryStage();
    const stages = [
      { label: 'Confirmed', icon: 'checkmark-circle' },
      { label: 'Pickup', icon: 'location' },
      { label: 'Delivery', icon: 'car' },
      { label: 'Completed', icon: 'gift' }
    ];

    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressLine}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStage - 1) / (stages.length - 1)) * 100}%` }
            ]} 
          />
        </View>
        
        <View style={styles.stagesContainer}>
          {stages.map((stage, index) => {
            const stageNumber = index + 1;
            const isCompleted = stageNumber <= currentStage;
            const isCurrent = stageNumber === currentStage;
            
            return (
              <View key={index} style={styles.stageItem}>
                <View 
                  style={[
                    styles.stageCircle,
                    isCompleted && styles.stageCompleted,
                    isCurrent && styles.stageCurrent
                  ]}
                >
                  <Ionicons 
                    name={stage.icon} 
                    size={12} 
                    color={isCompleted ? '#fff' : '#666'} 
                  />
                </View>
                <Text 
                  style={[
                    styles.stageLabel,
                    isCompleted && styles.stageLabelCompleted
                  ]}
                >
                  {stage.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStatusCard = () => {
    const statusInfo = getStatusMessage();
    
    return (
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name={statusInfo.icon} size={24} color="#A77BFF" />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>{statusInfo.title}</Text>
            <Text style={styles.statusSubtitle}>{statusInfo.subtitle}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDriverCard = () => {
    const driverInfo = getDriverInfo();
    
    return (
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <Text style={styles.cardTitle}>Your Driver</Text>
        </View>
        
        <View style={styles.driverInfoRow}>
          <View style={styles.driverAvatarContainer}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverInfo.name}</Text>
            <Text style={styles.vehicleText}>{driverInfo.vehicleType}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{driverInfo.rating}</Text>
            </View>
          </View>
          
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#A77BFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.contactButton} 
              onPress={handleChat}
              disabled={isCreatingChat}
            >
              <Ionicons name="chatbubble" size={20} color="#A77BFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderLocationCard = () => {
    return (
      <View style={styles.locationCard}>
        <Text style={styles.cardTitle}>Route Information</Text>
        
        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>Pickup</Text>
              <Text style={styles.addressText}>
                {requestData?.pickup?.address || requestData?.selectedLocations?.pickup?.address || requestData?.pickupAddress || 'Pickup location'}
              </Text>
            </View>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routePoint}>
            <View style={styles.dropoffDot} />
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>Delivery</Text>
              <Text style={styles.addressText}>
                {requestData?.dropoff?.address || requestData?.selectedLocations?.dropoff?.address || requestData?.dropoffAddress || 'Delivery location'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={16} color="#A77BFF" />
            <Text style={styles.statText}>{remainingDistance}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color="#A77BFF" />
            <Text style={styles.statText}>{estimatedTime}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPhotosSection = () => {
    const hasPickupPhotos = requestData?.pickupPhotos && requestData.pickupPhotos.length > 0;
    const hasDeliveryPhotos = requestData?.dropoffPhotos && requestData.dropoffPhotos.length > 0;
    const showPickupPhotos = hasPickupPhotos && ['pickedUp', 'enRouteToDropoff', 'arrivedAtDropoff', 'completed'].includes(requestData?.status);
    const showDeliveryPhotos = hasDeliveryPhotos && requestData?.status === 'completed';
    
    if (!showPickupPhotos && !showDeliveryPhotos) return null;
    
    return (
      <View style={styles.photosCard}>
        {showPickupPhotos && (
          <View style={styles.photosSection}>
            <Text style={styles.photosTitle}>Pickup Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {requestData.pickupPhotos.map((photo, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.photoItem}
                  onPress={() => openImageModal(
                    requestData.pickupPhotos?.map(photo => photo.url || photo.uri || photo) || [], 
                    index
                  )}
                >
                  <Image source={{ uri: photo.url || photo.uri || photo }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {showDeliveryPhotos && (
          <View style={styles.photosSection}>
            <Text style={styles.photosTitle}>Delivery Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              {requestData.dropoffPhotos.map((photo, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.photoItem}
                  onPress={() => openImageModal(
                    requestData.dropoffPhotos?.map(photo => photo.url || photo.uri || photo) || [], 
                    index
                  )}
                >
                  <Image source={{ uri: photo.url || photo.uri || photo }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderOrderDetailsCard = () => {
    return (
      <View style={styles.orderDetailsCard}>
        <TouchableOpacity 
          style={styles.orderDetailsToggle}
          onPress={toggleOrderDetails}
        >
          <Text style={styles.orderDetailsToggleText}>
            {orderDetailsExpanded ? 'Hide Order Details' : 'Show Order Details'}
          </Text>
          <Ionicons 
            name={orderDetailsExpanded ? 'chevron-down' : 'chevron-up'} 
            size={20} 
            color="#A77BFF" 
          />
        </TouchableOpacity>
        
        <Animated.View style={[styles.orderDetailsContent, { height: orderDetailsHeight }]}>
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailLabel}>Order ID</Text>
            <Text style={styles.orderDetailValue}>#{requestId?.slice(-8) || 'N/A'}</Text>
          </View>
          
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailLabel}>Total Amount</Text>
            <Text style={styles.orderDetailValue}>
              ${requestData?.pricing?.total?.toFixed(2) || '0.00'}
            </Text>
          </View>
          
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailLabel}>Service Type</Text>
            <Text style={styles.orderDetailValue}>
              {requestData?.vehicleType || 'Standard Delivery'}
            </Text>
          </View>
          
          <View style={styles.orderDetailsRow}>
            <Text style={styles.orderDetailLabel}>Booked Time</Text>
            <Text style={styles.orderDetailValue}>
              {requestData?.createdAt ? 
                new Date(requestData.createdAt).toLocaleString() : 
                'N/A'
              }
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  };

  const renderCancelSection = () => {
    if (!requestData) return null;
    
    const cancellationInfo = getCancellationInfo(requestData);
    
    // Only show cancel button if cancellation is allowed
    if (!cancellationInfo.canCancel) {
      return null;
    }
    
    return (
      <View style={styles.cancelSection}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => setCancelModalVisible(true)}
        >
          <Ionicons name="close-circle-outline" size={20} color="#FF6B6B" />
          <Text style={styles.cancelButtonText}>Cancel Order</Text>
        </TouchableOpacity>
        
        {cancellationInfo.fee > 0 && (
          <Text style={styles.cancelFeeText}>
            Cancellation fee: ${cancellationInfo.fee.toFixed(2)}
          </Text>
        )}
      </View>
    );
  };

  const renderHelpSection = () => {
    return (
      <View style={styles.helpSection}>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={20} color="#A77BFF" />
          <Text style={styles.helpButtonText}>Help & Support</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.helpButton, styles.reportButton]}>
          <Ionicons name="warning-outline" size={20} color="#ff4444" />
          <Text style={[styles.helpButtonText, { color: '#ff4444' }]}>Report Issue</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading delivery information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Map Section - Top 55% */}
      <View style={styles.mapContainer}>
        <MapboxMap
          ref={mapRef}
          style={styles.map}
          centerCoordinate={[-84.3880, 33.7490]}
          zoomLevel={12}
        >
          {driverLocation && (
            <Mapbox.PointAnnotation
              id="driver"
              coordinate={[driverLocation.longitude, driverLocation.latitude]}
              title="Driver"
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={18} color="#fff" />
              </View>
            </Mapbox.PointAnnotation>
          )}
          
          {requestData && getDestinationForStatus(requestData) && (
            <Mapbox.PointAnnotation
              id="destination"
              coordinate={[
                getDestinationForStatus(requestData).longitude, 
                getDestinationForStatus(requestData).latitude
              ]}
              title={getDeliveryStage() <= 2 ? "Pickup Location" : "Delivery Location"}
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="location" size={24} color="#A77BFF" />
              </View>
            </Mapbox.PointAnnotation>
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
                  lineColor: '#A77BFF',
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Section - 45% with scrollable content */}
      <Animated.View style={[styles.bottomSection, { transform: [{ translateY: bottomSectionY }] }]}>
        <View style={styles.scrollHandle} />
        
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {renderProgressBar()}
          {renderStatusCard()}
          {(requestData?.assignedDriverId || requestData?.assignedDriverEmail) && renderDriverCard()}
          {renderLocationCard()}
          {renderPhotosSection()}
          {renderOrderDetailsCard()}
          {renderCancelSection()}
          {renderHelpSection()}
          
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={closeImageModal}
          >
            <View style={styles.modalContent}>
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeImageModal}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              {/* Photo Counter */}
              {selectedImages.length > 1 && (
                <View style={styles.photoCounter}>
                  <Text style={styles.photoCounterText}>
                    {currentImageIndex + 1} of {selectedImages.length}
                  </Text>
                </View>
              )}

              {/* Swipeable Images */}
              <ScrollView
                ref={imageScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                style={styles.imageScrollView}
              >
                {selectedImages.map((image, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <TouchableOpacity activeOpacity={1}>
                      <Image 
                        source={{ uri: image }} 
                        style={styles.fullScreenImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onCancelSuccess={handleCancelSuccess}
        orderData={requestData}
        orderId={requestId}
      />
    </View>
  );
}

const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#1d2c4d" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8ec3b9" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1a3646" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#304a7d" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0e1626" }]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A1F',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(10, 10, 31, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  },
  destinationMarker: {
    alignItems: 'center',
  },
  bottomSection: {
    height: BOTTOM_SECTION_HEIGHT,
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  scrollHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#2A2A3B',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  
  // Progress Bar Styles
  progressBarContainer: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  progressLine: {
    height: 3,
    backgroundColor: '#2A2A3B',
    borderRadius: 1.5,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A77BFF',
    borderRadius: 1.5,
  },
  stagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  stageCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2A2A3B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageCompleted: {
    backgroundColor: '#A77BFF',
  },
  stageCurrent: {
    backgroundColor: '#A77BFF',
    borderWidth: 3,
    borderColor: 'rgba(167, 123, 255, 0.3)',
  },
  stageLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  stageLabelCompleted: {
    color: '#A77BFF',
    fontWeight: '600',
  },
  
  // Status Card Styles
  statusCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusSubtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  
  // Driver Card Styles
  driverCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  driverHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A77BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 16,
  },
  driverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  vehicleText: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Location Card Styles
  locationCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  routeContainer: {
    marginVertical: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A77BFF',
    marginRight: 16,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D4AA',
    marginRight: 16,
  },
  routeLine: {
    width: 2,
    height: 30,
    backgroundColor: '#2A2A3B',
    marginLeft: 5,
    marginVertical: 4,
  },
  addressContainer: {
    flex: 1,
  },
  addressLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  routeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 8,
  },
  
  // Photos Section Styles
  photosCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  photosSection: {
    marginBottom: 16,
  },
  photosTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  // Order Details Styles
  orderDetailsCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    overflow: 'hidden',
  },
  orderDetailsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  orderDetailsToggleText: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: '600',
  },
  orderDetailsContent: {
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  orderDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  orderDetailLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  orderDetailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Cancel Section Styles
  cancelSection: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1A1A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    width: '100%',
  },
  cancelButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelFeeText: {
    color: '#FF9500',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Help Section Styles
  helpSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  helpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  reportButton: {
    borderColor: '#ff4444',
  },
  helpButtonText: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  
  bottomSpacing: {
    height: 40,
  },
  
  // Image Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  photoCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  imageScrollView: {
    flex: 1,
    width: '100%',
  },
  imageContainer: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: width - 40,
    height: height * 0.8,
    maxWidth: width - 40,
    maxHeight: height * 0.8,
  },
});