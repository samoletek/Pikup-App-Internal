import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  SafeAreaView,
  Dimensions,
  Animated
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = 200;
const CARD_WIDTH = width * 0.8;

// Dark map style similar to Uber
const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#212121"
      }
    ]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "administrative.country",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#181818"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#1b1b1b"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry.fill",
    "stylers": [
      {
        "color": "#2c2c2c"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#8a8a8a"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#373737"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3c3c3c"
      }
    ]
  },
  {
    "featureType": "road.highway.controlled_access",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#4e4e4e"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "transit",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#000000"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#3d3d3d"
      }
    ]
  }
];

export default function EnRouteToPickupScreen({ navigation, route }) {
  const { request, isCustomerView = false, isDelivery = false, title } = route.params || {};
  const { user } = useAuth();
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState('10-15 min');
  const [distance, setDistance] = useState('2.5 mi');
  const mapRef = useRef(null);
  
  // Animated values for card
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Determine destination based on whether this is pickup or delivery
  const destination = isDelivery 
    ? (request?.dropoffCoordinates || { latitude: 33.754746, longitude: -84.386330 })
    : (request?.pickupCoordinates || { latitude: 33.753746, longitude: -84.386330 });

  useEffect(() => {
    // Slide up animation for card
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied');
        return;
      }

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const initialCoords = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude
      };
      
      setDriverLocation(initialCoords);
      
      // Fit map to show both driver and destination
      if (mapRef.current && initialCoords) {
        mapRef.current.fitToCoordinates(
          [initialCoords, destination],
          {
            edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
            animated: true,
          }
        );
      }

      // Start watching position
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setDriverLocation({ latitude, longitude });
        }
      );
    };

    startTracking();
  }, []);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCallCustomer = () => {
    // Implement call functionality
    console.log('Calling customer...');
  };

  const handleMessageCustomer = () => {
    // Navigate to message screen
    navigation.navigate('MessageScreen', { recipientId: request?.customerId });
  };

  const handleCallDriver = () => {
    // Implement call functionality for customer view
    console.log('Calling driver...');
  };

  const handleMessageDriver = () => {
    // Navigate to message screen for customer view
    navigation.navigate('MessageScreen', { recipientId: request?.driverId });
  };

  // Get the appropriate screen title
  const screenTitle = title || (isDelivery 
    ? (isCustomerView ? "Driver on the way to delivery" : "On the way to delivery") 
    : (isCustomerView ? "Driver on the way" : "On the way to pickup"));

  // Get the appropriate location title
  const locationTitle = isDelivery ? "Delivery Location" : "Pickup Location";

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
      >
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title={isCustomerView ? "Driver's location" : "Your location"}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        
        <Marker 
          coordinate={destination} 
          title={locationTitle}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={16} color="#fff" />
          </View>
        </Marker>

        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, destination]}
            strokeColor="#A77BFF"
            strokeWidth={4}
            lineDashPattern={[0]}
            lineCap="round"
          />
        )}
      </MapView>
      
      {/* Back button */}
      <SafeAreaView style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
      
      {/* Bottom Card */}
      <Animated.View 
        style={[
          styles.bottomCard,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.handle} />
        
        <Text style={styles.title}>
          {screenTitle}
        </Text>
        
        <View style={styles.etaContainer}>
          <View style={styles.etaBox}>
            <Ionicons name="time-outline" size={20} color="#A77BFF" />
            <Text style={styles.etaText}>{eta}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.etaBox}>
            <Ionicons name="navigate-outline" size={20} color="#A77BFF" />
            <Text style={styles.etaText}>{distance}</Text>
            <Text style={styles.etaLabel}>Distance</Text>
          </View>
        </View>
        
        <View style={styles.locationCard}>
          <Ionicons name="location" size={24} color="#A77BFF" />
          <View style={styles.locationInfo}>
            <Text style={styles.locationTitle}>{locationTitle}</Text>
            <Text style={styles.locationAddress}>
              {isDelivery 
                ? (request?.dropoff?.address || '456 Oak Avenue, Atlanta, GA')
                : (request?.pickup?.address || '123 Main Street, Atlanta, GA')}
            </Text>
          </View>
        </View>
        
        {isCustomerView ? (
          // Customer view - show driver info
          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {request?.driverName || 'Your Driver'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>4.9</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleMessageDriver}
              >
                <Ionicons name="chatbubble" size={20} color="#A77BFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCallDriver}
              >
                <Ionicons name="call" size={20} color="#A77BFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Driver view - show customer info
          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {request?.customerEmail?.split('@')[0] || 'Customer'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleMessageCustomer}
              >
                <Ionicons name="chatbubble" size={20} color="#A77BFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCallCustomer}
              >
                <Ionicons name="call" size={20} color="#A77BFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Only show "I've Arrived" button for driver view */}
        {!isCustomerView && (
          <TouchableOpacity style={styles.arrivedButton}>
            <Text style={styles.arrivedButtonText}>I've Arrived</Text>
          </TouchableOpacity>
        )}
        
        {/* Show tracking status for customer view */}
        {isCustomerView && (
          <View style={styles.trackingStatus}>
            <Ionicons name="navigate" size={20} color="#A77BFF" />
            <Text style={styles.trackingText}>
              {isDelivery ? "Tracking delivery in real-time" : "Tracking driver's location in real-time"}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#141426',
  },
  map: { 
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 38, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#141426',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#2A2A3B',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    padding: 16,
  },
  etaBox: {
    alignItems: 'center',
    flex: 1,
  },
  etaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  etaLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: '#2A2A3B',
    marginHorizontal: 10,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  locationInfo: {
    marginLeft: 16,
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  customerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#A77BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerDetails: {
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#FFD700',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  arrivedButton: {
    backgroundColor: '#A77BFF',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A77BFF',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00D4AA',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 123, 255, 0.1)',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  trackingText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
});
