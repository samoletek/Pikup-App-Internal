// Gps Navigation Driver View component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Mapbox from '@rnmapbox/maps';
import MapboxMap from '../mapbox/MapboxMap';
import NavigationInstructionsBanner from './NavigationInstructionsBanner';
import { colors, spacing } from '../../styles/theme';
import { resolveCustomerDisplayFromRequest } from '../../utils/profileDisplay';

export default function GpsNavigationDriverView({
  styles,
  mapRef,
  driverLocation,
  customerLocation,
  routeCoordinates,
  currentHeading,
  insetsTop,
  isNavigating,
  isSupported,
  startNavigation,
  stopNavigation,
  cardAnimation,
  cardGradientColors,
  estimatedTime,
  requestData,
  customerAvatarUrl,
  onCustomerAvatarError,
  openChat,
  isCreatingChat,
  hasUnreadChat,
  handleArrive,
  nextInstruction,
  currentManeuverIcon,
  distanceToTurn,
  onBack,
}) {
  const cardTranslateY = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });
  const customerDisplay = resolveCustomerDisplayFromRequest(requestData, {
    fallbackName: 'Customer',
  });

  if (isNavigating) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.closeNavButton, { top: insetsTop + spacing.sm }]}
          onPress={stopNavigation}
        >
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.floatingBottomCard,
            {
              transform: [{ translateY: cardTranslateY }],
            },
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
                  <Image source={{ uri: customerAvatarUrl }} style={styles.customerAvatarImage} onError={onCustomerAvatarError} />
                ) : (
                  <Text style={styles.customerAvatarInitials}>{customerDisplay.initials}</Text>
                )}
              </View>

              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>
                  {customerDisplay.name}
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
              coordinates: routeCoordinates.map((coord) => [coord.longitude, coord.latitude]),
            },
          }}>
            <Mapbox.LineLayer
              id="driverRouteLine"
              style={{
                lineColor: colors.primary,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
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

      {isSupported && !isNavigating && driverLocation && customerLocation && (
        <TouchableOpacity
          style={[styles.startNavButton, { top: insetsTop + spacing.sm }]}
          onPress={startNavigation}
        >
          <Ionicons name="navigate" size={20} color={colors.white} />
          <Text style={styles.startNavText}>Start Navigation</Text>
        </TouchableOpacity>
      )}

      {!isNavigating && (
        <NavigationInstructionsBanner
          nextInstruction={nextInstruction}
          isNavigating={false}
          maneuverIcon={currentManeuverIcon}
          distanceToTurn={distanceToTurn}
          topPadding={insetsTop + spacing.lg}
          ui={styles}
        />
      )}

      <Animated.View
        style={[
          styles.driverInfoCard,
          {
            transform: [{ translateY: cardTranslateY }],
          },
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
                <Image source={{ uri: customerAvatarUrl }} style={styles.customerAvatarImage} onError={onCustomerAvatarError} />
              ) : (
                <Text style={styles.customerAvatarInitials}>{customerDisplay.initials}</Text>
              )}
            </View>

            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>
                {customerDisplay.name}
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
}
