import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import MapboxMap from '../../components/mapbox/MapboxMap';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

const { height } = Dimensions.get('window');

export default function EnRouteToPickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, isCustomerView = false, isDelivery = false, title } = route.params || {};
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta] = useState('10-15 min');
  const [distance] = useState('2.5 mi');
  const mapRef = useRef(null);
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  
  // Animated values for card
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Determine destination based on whether this is pickup or delivery
  const destination = useMemo(
    () =>
      isDelivery
        ? request?.dropoffCoordinates || { latitude: 33.754746, longitude: -84.38633 }
        : request?.pickupCoordinates || { latitude: 33.753746, longitude: -84.38633 },
    [isDelivery, request?.dropoffCoordinates, request?.pickupCoordinates]
  );

  const destinationCoordinate = useMemo(
    () => [destination.longitude, destination.latitude],
    [destination.latitude, destination.longitude]
  );

  useEffect(() => {
    let locationSubscription = null;
    let isMounted = true;

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
        accuracy: Location.Accuracy.High,
      });

      const initialCoords = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };

      if (!isMounted) return;
      setDriverLocation(initialCoords);

      if (mapRef.current?.setCamera) {
        mapRef.current.setCamera({
          centerCoordinate: [
            (initialCoords.longitude + destination.longitude) / 2,
            (initialCoords.latitude + destination.latitude) / 2,
          ],
          zoomLevel: 12.5,
          animationDuration: 1200,
        });
      }

      // Start watching position
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        (location) => {
          if (!isMounted) return;
          const { latitude, longitude } = location.coords;
          setDriverLocation({ latitude, longitude });
        }
      );
    };

    startTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [destination.latitude, destination.longitude, slideAnim]);

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
      <MapboxMap
        ref={mapRef}
        style={styles.map}
        centerCoordinate={destinationCoordinate}
        zoomLevel={13}
      >
        {driverLocation && (
          <Mapbox.PointAnnotation
            id="driverLocationMarker"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={16} color={colors.white} />
            </View>
          </Mapbox.PointAnnotation>
        )}

        <Mapbox.PointAnnotation
          id="destinationMarker"
          coordinate={destinationCoordinate}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={16} color={colors.white} />
          </View>
        </Mapbox.PointAnnotation>

        {driverLocation && (
          <Mapbox.ShapeSource
            id="enRouteToPickupRouteSource"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [driverLocation.longitude, driverLocation.latitude],
                  destinationCoordinate,
                ],
              },
            }}
          >
            <Mapbox.LineLayer id="enRouteToPickupRouteLine" style={styles.routeLine} />
          </Mapbox.ShapeSource>
        )}
      </MapboxMap>
      
      {/* Back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + spacing.sm }]}
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Card */}
      <Animated.View
        style={[
          styles.bottomCard,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom + spacing.base,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }
        ]}
      >
        <View style={styles.handle} />
        
        <Text style={styles.title}>
          {screenTitle}
        </Text>
        
        <View style={styles.etaContainer}>
          <View style={styles.etaBox}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.etaText}>{eta}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.etaBox}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.etaText}>{distance}</Text>
            <Text style={styles.etaLabel}>Distance</Text>
          </View>
        </View>
        
        <View style={styles.locationCard}>
          <Ionicons name="location" size={24} color={colors.primary} />
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
                <Ionicons name="person" size={20} color={colors.white} />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {request?.driverName || 'Your Driver'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.ratingText}>4.9</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleMessageDriver}
              >
                <Ionicons name="chatbubble" size={20} color={colors.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCallDriver}
              >
                <Ionicons name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Driver view - show customer info
          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color={colors.white} />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {request?.customerEmail?.split('@')[0] || 'Customer'}
                </Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.ratingText}>4.8</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleMessageCustomer}
              >
                <Ionicons name="chatbubble" size={20} color={colors.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleCallCustomer}
              >
                <Ionicons name="call" size={20} color={colors.primary} />
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
            <Ionicons name="navigate" size={20} color={colors.primary} />
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
    backgroundColor: colors.background.secondary,
  },
  map: { 
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: spacing.base,
    zIndex: 1,
  },
  backButton: {
    position: 'absolute',
    left: spacing.base,
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: colors.black,
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
    backgroundColor: colors.border.strong,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  etaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  etaBox: {
    alignItems: 'center',
    flex: 1,
  },
  etaText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  etaLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border.strong,
    marginHorizontal: spacing.sm + 2,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  locationInfo: {
    marginLeft: spacing.base,
    flex: 1,
  },
  locationTitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  locationAddress: {
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  customerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerDetails: {
    marginLeft: spacing.md,
  },
  customerName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: typography.fontSize.base,
    color: colors.gold,
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  arrivedButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationMarker: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeLine: {
    lineColor: colors.primary,
    lineWidth: 4,
    lineCap: 'round',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  trackingText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
  },
});
