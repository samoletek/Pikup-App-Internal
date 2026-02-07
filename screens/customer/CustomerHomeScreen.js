import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Mapbox from "@rnmapbox/maps";

import { useAuth } from "../../contexts/AuthContext";
import { ACTIVE_TRIP_STATUSES } from "../../constants/tripStatus";
import CustomerOrderModal from "../../components/CustomerOrderModal";
import DeliveryStatusTracker from "../../components/DeliveryStatusTracker";
import MapboxLocationService from "../../services/MapboxLocationService";
import MapboxMap from "../../components/mapbox/MapboxMap";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

export default function CustomerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getUserPickupRequests } = useAuth();

  const [userLocation, setUserLocation] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const floatingWidth = useMemo(
    () => Math.min(Math.max(width - spacing.lg * 2, 280), 560),
    [width]
  );

  const logoWidth = useMemo(
    () => Math.min(Math.max(width * 0.24, 90), 132),
    [width]
  );

  const loadCurrentLocation = useCallback(async () => {
    try {
      const savedLocation = await MapboxLocationService.getLastKnownLocation();
      if (savedLocation?.latitude && savedLocation?.longitude) {
        setUserLocation({
          latitude: savedLocation.latitude,
          longitude: savedLocation.longitude,
        });
      }

      const location = await MapboxLocationService.getCurrentLocation();
      if (location?.latitude && location?.longitude) {
        setUserLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch (error) {
      console.error("Location error:", error);
    }
  }, []);

  const checkActiveDeliveries = useCallback(async () => {
    try {
      const requests = await getUserPickupRequests?.();
      if (!Array.isArray(requests)) {
        setActiveDelivery(null);
        return;
      }

      const activeRequest = requests.find((req) =>
        ACTIVE_TRIP_STATUSES.includes(req.status)
      );

      setActiveDelivery(activeRequest || null);
    } catch (error) {
      console.error("Error checking active deliveries:", error);
      setActiveDelivery(null);
    }
  }, [getUserPickupRequests]);

  useEffect(() => {
    loadCurrentLocation();
    checkActiveDeliveries();

    const intervalCheck = setInterval(checkActiveDeliveries, 30000);

    return () => {
      clearInterval(intervalCheck);
    };
  }, [loadCurrentLocation, checkActiveDeliveries]);

  const handleDeliveryComplete = useCallback(
    (deliveryData) => {
      setActiveDelivery(null);
      navigation.navigate("DeliveryFeedbackScreen", {
        requestId: deliveryData?.id,
      });
    },
    [navigation]
  );

  const handleViewFullTracker = useCallback(
    (requestId) => {
      navigation.navigate("DeliveryTrackingScreen", {
        requestId: requestId || activeDelivery?.id,
        requestData: activeDelivery,
      });
    },
    [navigation, activeDelivery]
  );

  const handleOrderConfirm = useCallback(
    (orderData) => {
      setSearchModalVisible(false);

      navigation.navigate("OrderSummaryScreen", {
        selectedVehicle: orderData?.selectedVehicle,
        selectedLocations: {
          pickup: orderData?.pickup,
          dropoff: orderData?.dropoff,
        },
        total: null,
        isDemo: false,
        distance: orderData?.distance,
        duration: orderData?.duration,
        rideId: `ride_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        summaryData: {
          items: orderData?.items,
          pickupDetails: orderData?.pickupDetails,
          dropoffDetails: orderData?.dropoffDetails,
          itemValue:
            orderData?.items?.reduce(
              (sum, item) => sum + (Number(item?.value) || 0),
              0
            ) || 500,
        },
      });
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
      <MapboxMap
        style={styles.map}
        centerCoordinate={
          userLocation
            ? [userLocation.longitude, userLocation.latitude]
            : [-84.388, 33.749]
        }
        zoomLevel={14}
      >
        <Mapbox.UserLocation visible />
      </MapboxMap>

      <View style={[styles.header, { paddingTop: Math.max(insets.top - 14, 20) }]}>
        <Image
          source={require("../../assets/pikup-logo.png")}
          style={[styles.headerLogo, { width: logoWidth }]}
          accessible
          accessibilityLabel="PikUp"
        />
      </View>

      {activeDelivery && (
        <View style={[styles.trackerContainer, { top: Math.max(insets.top + 34, 60) }]}>
          <DeliveryStatusTracker
            requestId={activeDelivery.id}
            onDeliveryComplete={handleDeliveryComplete}
            onViewFullTracker={() => handleViewFullTracker(activeDelivery.id)}
          />
        </View>
      )}

      <View
        style={[
          styles.floatingTriggerContainer,
          { paddingBottom: insets.bottom + spacing.lg, width: floatingWidth },
        ]}
      >
        <TouchableOpacity
          style={styles.floatingTrigger}
          onPress={() => setSearchModalVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.triggerIconCircle}>
            <Ionicons name="search" size={20} color={colors.text.primary} />
          </View>

          <Text style={styles.floatingTriggerText}>Where to?</Text>

          <View style={styles.triggerTimeBadge}>
            <Ionicons
              name="time"
              size={12}
              color={colors.text.secondary}
              style={styles.timeIconLeft}
            />
            <Text style={styles.triggerTimeText}>Now</Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={colors.text.secondary}
              style={styles.timeIconRight}
            />
          </View>
        </TouchableOpacity>
      </View>

      <CustomerOrderModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onConfirm={handleOrderConfirm}
        userLocation={userLocation}
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  headerLogo: {
    height: 24,
    resizeMode: "contain",
    marginTop: spacing.sm,
  },
  trackerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 15,
  },
  floatingTriggerContainer: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    zIndex: 20,
  },
  floatingTrigger: {
    backgroundColor: colors.background.tertiary,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 56,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
  },
  triggerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  floatingTriggerText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  triggerTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
  },
  triggerTimeText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  timeIconLeft: {
    marginRight: 4,
  },
  timeIconRight: {
    marginLeft: 4,
  },
});
