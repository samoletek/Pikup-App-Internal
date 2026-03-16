// Gps Navigation Customer View component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Mapbox from '@rnmapbox/maps';
import MapboxMap from '../mapbox/MapboxMap';
import { colors, spacing } from '../../styles/theme';

export default function GpsNavigationCustomerView({
  styles,
  mapRef,
  driverLocation,
  customerLocation,
  routeCoordinates,
  currentHeading,
  insetsTop,
  cardAnimation,
  cardGradientColors,
  estimatedTime,
  requestData,
  openChat,
  isCreatingChat,
  hasUnreadChat,
  remainingDistance,
  stage,
  onBack,
}) {
  const cardTranslateY = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });
  const isPickupStage = stage === 'pickup';

  return (
    <View style={styles.container}>
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
              coordinates: routeCoordinates.map((coord) => [coord.longitude, coord.latitude]),
            },
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
                  1, colors.primaryDark,
                ],
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </MapboxMap>

      <TouchableOpacity
        style={[styles.backButton, { top: insetsTop + spacing.sm }]}
        onPress={onBack}
      >
        <Ionicons name="arrow-back" size={24} color={colors.white} />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.customerInfoCard,
          {
            transform: [{ translateY: cardTranslateY }],
          },
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
                {isPickupStage ? 'Picking up your items' : 'Delivering your items'}
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
}
