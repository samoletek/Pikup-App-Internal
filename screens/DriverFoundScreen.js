import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import MapboxMap from '../components/mapbox/MapboxMap';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRequestStatus } from '../hooks/useRequestStatus';

const { width } = Dimensions.get('window');

export default function DriverFoundScreen({ navigation, route }) {
  const [bannerY] = useState(new Animated.Value(-100));
  const [bannerScale] = useState(new Animated.Value(0.8));
  const [region, setRegion] = useState({
    latitude: 33.7490,
    longitude: -84.3880,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [driverLocation] = useState({
    latitude: 33.7590,
    longitude: -84.3780,
  });

  // NEW: Get real request data from route params
  const { 
    requestId, 
    requestData, 
    selectedLocations, 
    selectedVehicle 
  } = route.params || {};
  
  // NEW: Use the request status hook for real-time updates
  const { requestStatus, loading } = useRequestStatus(requestId);

  // NEW: Extract driver info from real data
  const getDriverInfo = () => {
    if (requestStatus?.status === 'accepted' && requestStatus?.driverEmail) {
      return {
        name: requestStatus.driverEmail.split('@')[0] || 'Driver',
        email: requestStatus.driverEmail,
        vehicle: selectedVehicle?.type || 'Vehicle',
        licensePlate: 'ABC-1234', // Mock for now
        rating: 5.0,
        rides: 248,
        eta: selectedVehicle?.arrival || '15 minutes'
      };
    }
    
    // Fallback to mock data if no real driver yet
    return {
      name: 'Looking for driver...',
      email: '',
      vehicle: selectedVehicle?.type || 'Vehicle',
      licensePlate: '---',
      rating: 5.0,
      rides: 0,
      eta: selectedVehicle?.arrival || '15 minutes'
    };
  };

  const driverInfo = getDriverInfo();

  useEffect(() => {
    getCurrentLocation();
    
    // Only animate banner if we have a real driver
    if (requestStatus?.status === 'accepted') {
      animateBanner();
    }

    // Navigate to delivery tracking when driver accepts request
    const timer = setTimeout(() => {
      if (requestStatus?.status === 'accepted') {
        navigation.replace('DeliveryTrackingScreen', {
          requestId,
          requestData
        });
      }
    }, 5000); // Shorter delay for better UX

    return () => clearTimeout(timer);
  }, [requestStatus]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Permission denied, using Atlanta location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

    } catch (error) {
      console.log('Location error, using Atlanta:', error);
    }
  };

  const animateBanner = () => {
    // Enhanced banner animation
    Animated.parallel([
      Animated.spring(bannerY, {
        toValue: 50, // Start below safe area
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(bannerScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      })
    ]).start(() => {
      // Keep visible for 3 seconds, then slide out
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(bannerY, {
            toValue: -100,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(bannerScale, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          })
        ]).start();
      }, 3000);
    });
  };

  // NEW: Get status-based content
  const getStatusContent = () => {
    if (loading) {
      return {
        title: 'Checking status...',
        subtitle: 'Please wait',
        showBanner: false
      };
    }
    
    switch (requestStatus?.status) {
      case 'accepted':
        return {
          title: 'Driver Found!',
          subtitle: `${driverInfo.name} is on the way`,
          showBanner: true
        };
      case 'inProgress':
        return {
          title: 'Driver En Route',
          subtitle: `${driverInfo.name} is coming to pick up`,
          showBanner: true
        };
      case 'pending':
        return {
          title: 'Looking for Driver',
          subtitle: 'We\'re finding the best driver for you',
          showBanner: false
        };
      default:
        return {
          title: 'Driver Found!',
          subtitle: 'Your driver is on the way',
          showBanner: true
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <View style={styles.container}>
      <MapboxMap 
        style={styles.map}
        centerCoordinate={[region.longitude, region.latitude]}
        zoomLevel={11}
        customMapStyle={Mapbox.StyleURL.Dark}
      >
        {/* Driver location marker - only show if driver accepted */}
        {requestStatus?.status === 'accepted' && (
          <Mapbox.PointAnnotation
            id="driver"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          </Mapbox.PointAnnotation>
        )}

        {/* Your location marker */}
        <Mapbox.PointAnnotation
          id="user"
          coordinate={[region.longitude, region.latitude]}
        >
          <View style={styles.userMarker}>
            <View style={styles.userDot} />
          </View>
        </Mapbox.PointAnnotation>
      </MapboxMap>

      {/* Enhanced Driver Found Banner - only show when appropriate */}
      {statusContent.showBanner && (
        <Animated.View 
          style={[
            styles.banner, 
            { 
              transform: [
                { translateY: bannerY },
                { scale: bannerScale }
              ] 
            }
          ]}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>{statusContent.title}</Text>
              <Text style={styles.bannerSubtitle}>{statusContent.subtitle}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Driver Info Card */}
      <View style={styles.card}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusIndicator}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: requestStatus?.status === 'accepted' ? '#00D4AA' : '#FFA500' }
            ]} />
            <Text style={styles.statusText}>
              {requestStatus?.status === 'accepted' ? 'Driver Assigned' : 'Looking for Driver'}
            </Text>
          </View>
          {requestStatus?.acceptedAt && (
            <Text style={styles.acceptedTime}>
              Accepted {new Date(requestStatus.acceptedAt).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* ETA Header */}
        <View style={styles.etaHeader}>
          <View style={styles.etaIconContainer}>
            <Ionicons name="time" size={20} color="#00D4AA" />
          </View>
          <Text style={styles.arrivalText}>Arriving in {driverInfo.eta}</Text>
          <TouchableOpacity style={styles.trackButton}>
            <Text style={styles.trackButtonText}>Track</Text>
          </TouchableOpacity>
        </View>

        {/* Request Info */}
        <View style={styles.requestInfo}>
          <Text style={styles.requestTitle}>Your Request</Text>
          <Text style={styles.requestDetail}>
            From: {selectedLocations?.pickup || 'Pickup location'}
          </Text>
          <Text style={styles.requestDetail}>
            To: {selectedLocations?.dropoff || 'Dropoff location'}
          </Text>
          <Text style={styles.requestDetail}>
            Vehicle: {selectedVehicle?.type || 'Vehicle type'}
          </Text>
        </View>

        {/* Driver Info Row */}
        <View style={styles.driverSection}>
          <View style={styles.driverInfo}>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverInfo.name}</Text>
              <Text style={styles.vehicle}>{driverInfo.vehicle} • Silver</Text>
              {requestStatus?.status === 'accepted' && (
                <View style={styles.ratingRow}>
                  <View style={styles.stars}>
                    {[...Array(5)].map((_, i) => (
                      <Ionicons key={i} name="star" size={14} color="#FFD700" />
                    ))}
                  </View>
                  <Text style={styles.rating}>{driverInfo.rating} ({driverInfo.rides} rides)</Text>
                </View>
              )}
            </View>
            <View style={styles.vehicleImageContainer}>
              <Image
                source={selectedVehicle?.image || require('../assets/van.png')}
                style={styles.vehicleImg}
                resizeMode="contain"
              />
              <Text style={styles.licensePlate}>{driverInfo.licensePlate}</Text>
            </View>
          </View>
        </View>

        {/* Message Input - only show if driver accepted */}
        {requestStatus?.status === 'accepted' && (
          <View style={styles.messageSection}>
            <TextInput
              style={styles.messageInput}
              placeholder={`Send a message to ${driverInfo.name}...`}
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity style={styles.sendButton}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color="#A77BFF" />
            <Text style={styles.actionButtonText}>Edit Ride</Text>
          </TouchableOpacity>

          {requestStatus?.status === 'accepted' && (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.chatButton]}
                onPress={() => navigation.navigate('MessageScreen', { 
                  requestId, 
                  driverInfo 
                })}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.callButton]}>
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Call</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Emergency Button */}
        <TouchableOpacity style={styles.emergencyButton}>
          <Ionicons name="shield-checkmark" size={16} color="#fff" />
          <Text style={styles.emergencyText}>Safety & Emergency</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#000',
  },
  map: { 
    ...StyleSheet.absoluteFillObject 
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 10,
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerContent: {
    backgroundColor: '#A77BFF',
    borderRadius: 15,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  bannerIcon: {
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  card: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#0A0A1F',
    width: '100%',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptedTime: {
    color: '#666',
    fontSize: 12,
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  etaIconContainer: {
    marginRight: 12,
  },
  arrivalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  trackButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestInfo: {
    backgroundColor: '#141426',
    padding: 16,
    borderRadius: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  requestTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  requestDetail: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  driverSection: {
    marginBottom: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  vehicle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  rating: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleImageContainer: {
    alignItems: 'center',
  },
  vehicleImg: {
    width: 100,
    height: 60,
    marginBottom: 4,
  },
  licensePlate: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  messageSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#141426',
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    color: '#fff',
    marginRight: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  sendButton: {
    backgroundColor: '#A77BFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#141426',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  chatButton: {
    backgroundColor: '#2D2D3D',
  },
  callButton: {
    backgroundColor: '#00D4AA',
  },
  actionButtonText: {
    color: '#A77BFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emergencyButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#A77BFF',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 3,
    left: 3,
  },
});