import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { useAuth } from "../../contexts/AuthContext";
import { usePayment } from "../../contexts/PaymentContext";
import {
  ACTIVE_TRIP_STATUSES,
  TRIP_STATUS,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import CustomerOrderModal from "../../components/CustomerOrderModal";
import PhoneVerificationModal from "../../components/PhoneVerificationModal";
import DeliveryStatusTracker from "../../components/DeliveryStatusTracker";
import MapboxLocationService from "../../services/MapboxLocationService";
import MapboxMap from "../../components/mapbox/MapboxMap";
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from "../../styles/theme";

const toMapboxCoordinate = (location) => {
  const rawCoordinates = location?.coordinates || location;

  if (
    Array.isArray(rawCoordinates) &&
    rawCoordinates.length === 2 &&
    Number.isFinite(Number(rawCoordinates[0])) &&
    Number.isFinite(Number(rawCoordinates[1]))
  ) {
    return [Number(rawCoordinates[0]), Number(rawCoordinates[1])];
  }

  const longitude = Number(rawCoordinates?.longitude);
  const latitude = Number(rawCoordinates?.latitude);

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return [longitude, latitude];
  }

  return null;
};

const formatSearchDuration = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(
    2,
    "0"
  )}`;
};

const getBookingAddress = (booking, pointType) => {
  const addressKey = `${pointType}Address`;
  const point = booking?.[pointType];
  return (
    booking?.[addressKey] ||
    point?.address ||
    point?.formatted_address ||
    "Address unavailable"
  );
};

const formatScheduleLabel = (scheduledTime) => {
  if (!scheduledTime) {
    return "ASAP";
  }

  const parsedDate = new Date(scheduledTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Scheduled";
  }

  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function CustomerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentUser, refreshProfile, getUserPickupRequests, createPickupRequest, cancelOrder } = useAuth();
  const { createPaymentIntent, confirmPayment } = usePayment();

  const [userLocation, setUserLocation] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [isSearchSheetExpanded, setIsSearchSheetExpanded] = useState(false);
  const [searchElapsedSeconds, setSearchElapsedSeconds] = useState(0);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [orderModalKey, setOrderModalKey] = useState(0);
  const searchingPinPulse = useRef(new Animated.Value(0)).current;
  const searchSheetExpandAnim = useRef(new Animated.Value(0)).current;

  const floatingWidth = useMemo(
    () => Math.min(Math.max(width - spacing.lg * 2, 280), 560),
    [width]
  );

  const logoWidth = useMemo(
    () => Math.min(Math.max(width * 0.2, 76), 112),
    [width]
  );

  const canCreateOrder = !activeDelivery && !pendingBooking;

  const searchingPulseSize = searchingPinPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 96],
  });

  const searchingPulseRingOpacity = searchingPinPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.02],
  });

  const searchSheetDetailsHeight = searchSheetExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 165],
  });

  const searchSheetDetailsOpacity = searchSheetExpandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const searchingMarkerCoordinate = useMemo(() => {
    const pickupCoordinate = toMapboxCoordinate(pendingBooking?.pickup);
    if (pickupCoordinate) {
      return pickupCoordinate;
    }

    if (userLocation?.longitude && userLocation?.latitude) {
      return [userLocation.longitude, userLocation.latitude];
    }

    return null;
  }, [pendingBooking, userLocation]);

  const searchingStartedAtMs = useMemo(() => {
    const rawDate = pendingBooking?.createdAt || pendingBooking?.created_at;
    if (!rawDate) {
      return Date.now();
    }

    const parsed = new Date(rawDate).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }, [pendingBooking?.id, pendingBooking?.createdAt, pendingBooking?.created_at]);

  const searchTimerLabel = useMemo(
    () => formatSearchDuration(searchElapsedSeconds),
    [searchElapsedSeconds]
  );

  const pendingBookingSummary = useMemo(() => {
    if (!pendingBooking) {
      return null;
    }

    const totalAmount =
      Number(pendingBooking?.pricing?.total ?? pendingBooking?.price ?? 0) || 0;
    const itemsCount = Array.isArray(pendingBooking?.items)
      ? pendingBooking.items.length
      : pendingBooking?.item
        ? 1
        : 0;

    return {
      pickupAddress: getBookingAddress(pendingBooking, "pickup"),
      dropoffAddress: getBookingAddress(pendingBooking, "dropoff"),
      vehicleType: pendingBooking?.vehicleType || pendingBooking?.vehicle?.type || "Vehicle",
      scheduleLabel: formatScheduleLabel(
        pendingBooking?.scheduledTime || pendingBooking?.scheduled_time
      ),
      itemsCount,
      totalAmountLabel: `$${totalAmount.toFixed(2)}`,
    };
  }, [pendingBooking]);

  const mapCenterCoordinate = useMemo(() => {
    if (pendingBooking && searchingMarkerCoordinate) {
      return searchingMarkerCoordinate;
    }

    if (userLocation?.longitude && userLocation?.latitude) {
      return [userLocation.longitude, userLocation.latitude];
    }

    return [-84.388, 33.749];
  }, [pendingBooking, searchingMarkerCoordinate, userLocation]);

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
        setPendingBooking(null);
        return;
      }

      const activeRequest = requests.find((req) =>
        ACTIVE_TRIP_STATUSES.includes(normalizeTripStatus(req.status))
      );
      const pendingRequest = requests.find(
        (req) => normalizeTripStatus(req.status) === TRIP_STATUS.PENDING
      );

      setActiveDelivery(activeRequest || null);
      setPendingBooking(activeRequest ? null : pendingRequest || null);
    } catch (error) {
      console.error("Error checking active deliveries:", error);
      setActiveDelivery(null);
      setPendingBooking(null);
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

  useEffect(() => {
    if ((activeDelivery || pendingBooking) && searchModalVisible) {
      setSearchModalVisible(false);
    }
  }, [activeDelivery, pendingBooking, searchModalVisible]);

  useEffect(() => {
    if (!pendingBooking) {
      setIsSearchSheetExpanded(false);
    }
  }, [pendingBooking]);

  useEffect(() => {
    Animated.timing(searchSheetExpandAnim, {
      toValue: isSearchSheetExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isSearchSheetExpanded, searchSheetExpandAnim]);

  useEffect(() => {
    if (!pendingBooking) {
      searchingPinPulse.stopAnimation();
      searchingPinPulse.setValue(0);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(searchingPinPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(searchingPinPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      searchingPinPulse.stopAnimation();
      searchingPinPulse.setValue(0);
    };
  }, [pendingBooking, searchingPinPulse]);

  useEffect(() => {
    if (!pendingBooking) {
      setSearchElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const seconds = Math.floor((Date.now() - searchingStartedAtMs) / 1000);
      setSearchElapsedSeconds(Math.max(0, seconds));
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);

    return () => clearInterval(timerId);
  }, [pendingBooking, searchingStartedAtMs]);

  const handleDeliveryComplete = useCallback(
    (deliveryData) => {
      setActiveDelivery(null);
      navigation.navigate("DeliveryFeedbackScreen", {
        requestId: deliveryData?.id,
      });
    },
    [navigation]
  );

  const handleOrderConfirm = useCallback(
    async (orderData) => {
      // TODO: TEMP DISABLED for testing - restore phone verification
      // if (!currentUser?.phone_verified) {
      //   setPhoneVerifyVisible(true);
      //   return { pending: true };
      // }

      if (activeDelivery || pendingBooking) {
        return {
          success: false,
          error: "Complete or cancel your current booking before creating a new one.",
        };
      }

      const selectedPaymentMethod = orderData?.selectedPaymentMethod;
      const totalAmount = Number(orderData?.pricing?.total || 0);

      if (!selectedPaymentMethod?.stripePaymentMethodId) {
        return {
          success: false,
          error: "Please select a saved payment method.",
        };
      }
      const amountInCents = Math.round(totalAmount * 100);
      if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
        return {
          success: false,
          error: "Invalid order total. Please review your order and try again.",
        };
      }

      try {
        const rideDetails = {
          scheduleType: orderData?.scheduleType,
          scheduledDateTime: orderData?.scheduledDateTime,
          pickup: orderData?.pickup,
          dropoff: orderData?.dropoff,
          distance: orderData?.distance,
          duration: orderData?.duration,
          vehicleType: orderData?.selectedVehicle?.type,
          itemsCount: orderData?.items?.length || 0,
          timestamp: new Date().toISOString(),
        };
        const paymentIntentResult = await createPaymentIntent(
          amountInCents,
          "usd",
          rideDetails,
          selectedPaymentMethod.stripePaymentMethodId
        );
        if (!paymentIntentResult.success || !paymentIntentResult.paymentIntent?.client_secret) {
          return {
            success: false,
            error: paymentIntentResult.error || "Failed to start payment.",
          };
        }
        const paymentResult = await confirmPayment(
          paymentIntentResult.paymentIntent.client_secret,
          selectedPaymentMethod.stripePaymentMethodId
        );
        if (!paymentResult.success) {
          return {
            success: false,
            error: paymentResult.error || "Unable to confirm payment.",
          };
        }

        const createdRequest = await createPickupRequest({
          pickup: orderData?.pickup,
          dropoff: orderData?.dropoff,
          pickupDetails: orderData?.pickupDetails || {},
          dropoffDetails: orderData?.dropoffDetails || {},
          vehicle: orderData?.selectedVehicle,
          pricing: {
            ...(orderData?.pricing || {}),
            total: totalAmount,
            distance: Number(orderData?.distance || orderData?.pricing?.distance || 0),
          },
          items: orderData?.items || [],
          scheduledTime:
            orderData?.scheduleType === "scheduled"
              ? orderData?.scheduledDateTime
              : null,
        });

        setSearchModalVisible(false);
        setOrderModalKey((prev) => prev + 1);
        setPendingBooking(createdRequest || null);
        setIsSearchSheetExpanded(false);
        checkActiveDeliveries();

        return { success: true };
      } catch (error) {
        console.error("Error confirming customer order:", error);
        return {
          success: false,
          error: error?.message || "Payment failed. Please try again.",
        };
      }
    },
    [
      currentUser?.phone_verified,
      activeDelivery,
      pendingBooking,
      createPaymentIntent,
      confirmPayment,
      createPickupRequest,
      checkActiveDeliveries,
    ]
  );

  const handleCancelPendingBooking = useCallback(() => {
    if (!pendingBooking?.id || isCancellingPending) {
      return;
    }

    Alert.alert(
      "Cancel booking?",
      "We will stop searching for a driver and move this trip to Activity as cancelled.",
      [
        { text: "Keep searching", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            try {
              setIsCancellingPending(true);
              await cancelOrder(pendingBooking.id, "customer_request");
              setPendingBooking(null);
              await checkActiveDeliveries();
            } catch (error) {
              console.error("Error cancelling pending booking:", error);
              Alert.alert(
                "Unable to cancel",
                error?.message || "Please try again in a moment."
              );
            } finally {
              setIsCancellingPending(false);
            }
          },
        },
      ]
    );
  }, [pendingBooking, isCancellingPending, cancelOrder, checkActiveDeliveries]);

  return (
    <View style={styles.container}>
      <MapboxMap
        style={[styles.map, { bottom: -tabBarHeight }]}
        centerCoordinate={mapCenterCoordinate}
        zoomLevel={14}
      >
        <Mapbox.UserLocation visible />

        {pendingBooking && searchingMarkerCoordinate && (
          <Mapbox.MarkerView
            id="searching-driver-marker"
            coordinate={searchingMarkerCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
            allowOverlapWithPuck
          >
            <View style={styles.searchingMarkerContainer}>
              <Animated.View
                style={[
                  styles.searchingMarkerPulse,
                  {
                    opacity: searchingPulseRingOpacity,
                    width: searchingPulseSize,
                    height: searchingPulseSize,
                  },
                ]}
              />
              <View style={styles.searchingMarkerCore}>
                <Ionicons name="search" size={16} color={colors.white} />
              </View>
            </View>
          </Mapbox.MarkerView>
        )}
      </MapboxMap>

      <View style={[styles.header, { paddingTop: insets.top }]}>
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
          />
        </View>
      )}

      {canCreateOrder && (
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
      )}

      {Boolean(pendingBooking) && !activeDelivery && (
        <View
          style={[
            styles.searchSheetContainer,
            {
              bottom: 0,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.searchStatusCard}
            activeOpacity={0.9}
            onPress={() => setIsSearchSheetExpanded((prev) => !prev)}
          >
            <View style={styles.searchStatusHeader}>
              <View style={styles.searchStatusMainTextWrap}>
                <View style={styles.searchSheetTitleRow}>
                  <Text style={styles.searchSheetTitle}>Looking for your driver</Text>
                  <Text style={styles.searchSheetSubtitle}>
                    We are matching your trip now. Please wait.
                  </Text>
                </View>
                <View style={styles.searchingTimerRow}>
                  <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.searchingTimerText}>Search time: {searchTimerLabel}</Text>
                </View>
              </View>

              <Ionicons
                name={isSearchSheetExpanded ? "chevron-down" : "chevron-up"}
                size={20}
                color={colors.text.tertiary}
              />
            </View>

            <Animated.View
              style={[
                styles.searchSheetDetailsAnimated,
                {
                  height: searchSheetDetailsHeight,
                  opacity: searchSheetDetailsOpacity,
                },
              ]}
            >
              <View style={styles.searchSheetDetails}>
                {pendingBookingSummary && (
                  <>
                    <View style={styles.searchDetailRow}>
                      <Ionicons name="arrow-up-circle-outline" size={14} color={colors.primary} />
                      <Text style={styles.searchDetailText} numberOfLines={1}>
                        {pendingBookingSummary.pickupAddress}
                      </Text>
                    </View>

                    <View style={styles.searchDetailRow}>
                      <Ionicons name="arrow-down-circle-outline" size={14} color={colors.success} />
                      <Text style={styles.searchDetailText} numberOfLines={1}>
                        {pendingBookingSummary.dropoffAddress}
                      </Text>
                    </View>

                    <View style={styles.searchDetailMetaRow}>
                      <View style={styles.searchMetaPill}>
                        <Ionicons name="car-outline" size={13} color={colors.text.secondary} />
                        <Text style={styles.searchMetaPillText}>{pendingBookingSummary.vehicleType}</Text>
                      </View>
                      <View style={styles.searchMetaPill}>
                        <Ionicons name="cube-outline" size={13} color={colors.text.secondary} />
                        <Text style={styles.searchMetaPillText}>
                          {pendingBookingSummary.itemsCount} item{pendingBookingSummary.itemsCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <View style={styles.searchMetaPill}>
                        <Ionicons name="cash-outline" size={13} color={colors.text.secondary} />
                        <Text style={styles.searchMetaPillText}>{pendingBookingSummary.totalAmountLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.searchScheduleRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                      <Text style={styles.searchScheduleText}>
                        {pendingBookingSummary.scheduleLabel}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.searchingCancelButton,
              styles.searchingCancelButtonStandalone,
              isCancellingPending && styles.searchingCancelButtonDisabled,
            ]}
            onPress={handleCancelPendingBooking}
            activeOpacity={0.85}
            disabled={isCancellingPending}
          >
            {isCancellingPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.searchingCancelButtonText}>Cancel Search</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <CustomerOrderModal
        key={orderModalKey}
        visible={searchModalVisible && canCreateOrder}
        onClose={() => setSearchModalVisible(false)}
        onConfirm={handleOrderConfirm}
        userLocation={userLocation}
        renderPhoneVerification={() => (
          <PhoneVerificationModal
            visible={phoneVerifyVisible}
            onClose={() => setPhoneVerifyVisible(false)}
            onVerified={async () => {
              setPhoneVerifyVisible(false);
              await refreshProfile();
            }}
            userId={currentUser?.uid || currentUser?.id}
            userTable="customers"
          />
        )}
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
    height: 20,
    resizeMode: "contain",
    ...shadows.lg,
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
  searchingMarkerContainer: {
    width: 136,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
  },
  searchingMarkerPulse: {
    backgroundColor: colors.transparent,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 999,
  },
  searchingMarkerCore: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  searchSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    zIndex: 22,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  searchStatusCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  searchStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchStatusMainTextWrap: {
    flex: 1,
    marginRight: spacing.base,
  },
  searchSheetTitleRow: {
    flexDirection: "column",
  },
  searchSheetTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  searchSheetSubtitle: {
    marginTop: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  searchSheetDetailsAnimated: {
    overflow: "hidden",
  },
  searchSheetDetails: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  searchDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.base,
  },
  searchDetailText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  searchDetailMetaRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  searchMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchMetaPillText: {
    marginLeft: 6,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  searchScheduleRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  searchScheduleText: {
    marginLeft: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  searchingTimerRow: {
    marginTop: spacing.base,
    flexDirection: "row",
    alignItems: "center",
  },
  searchingTimerText: {
    marginLeft: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  searchingCancelButton: {
    width: "100%",
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  searchingCancelButtonStandalone: {
    marginTop: spacing.md,
  },
  searchingCancelButtonDisabled: {
    opacity: 0.7,
  },
  searchingCancelButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
