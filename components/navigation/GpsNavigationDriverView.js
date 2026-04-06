// Gps Navigation Driver View component: renders its UI and handles related interactions.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Mapbox from '@rnmapbox/maps';
import MapboxMap from '../mapbox/MapboxMap';
import NavigationInstructionsBanner from './NavigationInstructionsBanner';
import DriverNavigationPuck from './DriverNavigationPuck';
import useNavigationCameraFollow from './useNavigationCameraFollow';
import { colors, spacing } from '../../styles/theme';

export default function GpsNavigationDriverView({
  styles,
  mapRef,
  driverLocation,
  customerLocation,
  routeCoordinates,
  currentHeading,
  cameraConfig,
  insetsTop,
  isNavigating,
  isSupported,
  startNavigation,
  stopNavigation,
  cardAnimation,
  cardGradientColors,
  requestData,
  openChat,
  isCreatingChat,
  hasUnreadChat,
  handleArrive,
  handleCancelTrip,
  isCancellingTrip,
  nextInstruction,
  currentManeuverIcon,
  distanceToTurn,
  currentStreetName,
  distanceToDestination,
  canArrive = false,
  onBack,
}) {
  const [bottomCardHeight, setBottomCardHeight] = useState(180);
  const cardTranslateY = cardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });
  const handleBottomCardLayout = useCallback((event) => {
    const measuredHeight = Number(event?.nativeEvent?.layout?.height);
    if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
      setBottomCardHeight(measuredHeight);
    }
  }, []);
  const {
    activeCameraConfig,
    handleCameraChanged,
    isAutoFollowEnabled,
    recenterOnVehicle,
  } = useNavigationCameraFollow({
    cameraConfig,
    mapRef,
  });
  const resolvedCenterCoordinate = activeCameraConfig?.centerCoordinate ||
    (driverLocation ? [driverLocation.longitude, driverLocation.latitude] : [-84.3880, 33.7490]);
  const resolvedCameraPadding = activeCameraConfig?.padding || { top: 100, bottom: 250, left: 50, right: 50 };

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
                style={[
                  styles.arriveButton,
                  (!canArrive || isCancellingTrip) && styles.arriveButtonDisabled,
                ]}
                onPress={handleArrive}
                disabled={!canArrive || isCancellingTrip}
              >
                <Text style={styles.arriveButtonText}>I've Arrived</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelTripButton}
                onPress={handleCancelTrip}
                disabled={isCancellingTrip}
              >
                <Text style={styles.cancelTripButtonText}>
                  {isCancellingTrip ? 'Cancelling...' : 'Cancel Trip'}
                </Text>
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
        centerCoordinate={resolvedCenterCoordinate}
        zoomLevel={activeCameraConfig?.zoomLevel ?? 18.5}
        pitch={activeCameraConfig?.pitch ?? 60}
        bearing={activeCameraConfig?.bearing ?? currentHeading}
        animationDuration={activeCameraConfig?.animationDuration ?? 900}
        padding={resolvedCameraPadding}
        followUserLocation={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled
        rotateEnabled
        onCameraChanged={handleCameraChanged}
      >
        {driverLocation ? (
          <Mapbox.MarkerView
            id="driverNavigationPuck"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <DriverNavigationPuck
              heading={currentHeading}
              mapBearing={activeCameraConfig?.bearing ?? currentHeading}
            />
          </Mapbox.MarkerView>
        ) : null}

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
        <TouchableOpacity
          style={[
            styles.recenterButton,
            isAutoFollowEnabled && styles.recenterButtonActive,
            {
              bottom: bottomCardHeight + spacing.lg,
            },
          ]}
          onPress={recenterOnVehicle}
          accessibilityRole="button"
          accessibilityLabel="Recenter map on vehicle"
          accessibilityHint="Centers the map back on the vehicle and restores follow mode"
        >
          <Ionicons name="locate" size={18} color={colors.white} />
        </TouchableOpacity>
      )}

      {!isNavigating && (
        <NavigationInstructionsBanner
          nextInstruction={nextInstruction}
          isNavigating={false}
          maneuverIcon={currentManeuverIcon}
          distanceToDestination={distanceToDestination}
          distanceToTurn={distanceToTurn}
          streetName={currentStreetName}
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
        onLayout={handleBottomCardLayout}
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
              style={[
                styles.arriveButton,
                (!canArrive || isCancellingTrip) && styles.arriveButtonDisabled,
              ]}
              onPress={handleArrive}
              disabled={!canArrive || isCancellingTrip}
            >
              <Text style={styles.arriveButtonText}>I've Arrived</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelTripButton}
              onPress={handleCancelTrip}
              disabled={isCancellingTrip}
            >
              <Text style={styles.cancelTripButtonText}>
                {isCancellingTrip ? 'Cancelling...' : 'Cancel Trip'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
