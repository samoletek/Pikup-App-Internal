import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Mapbox from "@rnmapbox/maps";
import MapboxMap from "../../components/mapbox/MapboxMap";
import AppButton from "../../components/ui/AppButton";
import {
  colors,
  layout,
  spacing,
} from "../../styles/theme";
import styles from "./EnRouteToPickupScreen.styles";
import useEnRouteTripTracking from "./useEnRouteTripTracking";

export default function EnRouteToPickupScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, isCustomerView = false, isDelivery = false } = route.params || {};
  const mapRef = useRef(null);
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    counterpartName,
    counterpartRating,
    destinationCoordinate,
    distance,
    driverLocation,
    eta,
    handleArrived,
    handleCallCustomer,
    handleCallDriver,
    handleMessageCustomer,
    handleMessageDriver,
    locationAddress,
    locationTitle,
    screenTitle,
    slideAnim,
  } = useEnRouteTripTracking({
    isCustomerView,
    isDelivery,
    mapRef,
    navigation,
    request,
  });

  return (
    <View style={styles.container}>
      <MapboxMap
        ref={mapRef}
        style={styles.map}
        centerCoordinate={destinationCoordinate}
        zoomLevel={13}
      >
        {driverLocation ? (
          <Mapbox.PointAnnotation
            id="driverLocationMarker"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={16} color={colors.white} />
            </View>
          </Mapbox.PointAnnotation>
        ) : null}

        <Mapbox.PointAnnotation
          id="destinationMarker"
          coordinate={destinationCoordinate}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="location" size={16} color={colors.white} />
          </View>
        </Mapbox.PointAnnotation>

        {driverLocation ? (
          <Mapbox.ShapeSource
            id="enRouteToPickupRouteSource"
            shape={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [driverLocation.longitude, driverLocation.latitude],
                  destinationCoordinate,
                ],
              },
            }}
          >
            <Mapbox.LineLayer id="enRouteToPickupRouteLine" style={styles.routeLine} />
          </Mapbox.ShapeSource>
        ) : null}
      </MapboxMap>

      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + spacing.sm }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.bottomCard,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom + spacing.base,
            maxWidth: contentMaxWidth,
            width: "100%",
            alignSelf: "center",
          },
        ]}
      >
        <View style={styles.handle} />

        <Text style={styles.title}>{screenTitle}</Text>

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
            <Text style={styles.locationAddress}>{locationAddress}</Text>
          </View>
        </View>

        {isCustomerView ? (
          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color={colors.white} />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>{counterpartName}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.ratingText}>{counterpartRating}</Text>
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
          <View style={styles.customerCard}>
            <View style={styles.customerInfo}>
              <View style={styles.customerAvatar}>
                <Ionicons name="person" size={20} color={colors.white} />
              </View>
              <View style={styles.customerDetails}>
                <Text style={styles.customerName}>{counterpartName}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={styles.ratingText}>{counterpartRating}</Text>
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

        {!isCustomerView ? (
          <AppButton
            title="I've Arrived"
            style={styles.arrivedButton}
            labelStyle={styles.arrivedButtonText}
            onPress={handleArrived}
          />
        ) : null}

        {isCustomerView ? (
          <View style={styles.trackingStatus}>
            <Ionicons name="navigate" size={20} color={colors.primary} />
            <Text style={styles.trackingText}>
              {isDelivery
                ? "Tracking delivery in real-time"
                : "Tracking driver's location in real-time"}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
