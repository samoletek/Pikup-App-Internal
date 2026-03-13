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
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "../../contexts/AuthContext";
import { usePayment } from "../../contexts/PaymentContext";
import {
  ACTIVE_TRIP_STATUSES,
  TRIP_STATUS,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import CustomerOrderModal from "../../components/CustomerOrderModal";
import PhoneVerificationModal from "../../components/PhoneVerificationModal";
import MapboxLocationService from "../../services/MapboxLocationService";
import RedkikService from "../../services/RedkikService";
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

const ACTIVE_DELIVERY_STEP_META = Object.freeze({
  [TRIP_STATUS.ACCEPTED]: {
    label: "Delivery Confirmed",
    icon: "checkmark-circle",
  },
  [TRIP_STATUS.IN_PROGRESS]: {
    label: "On the way to you",
    icon: "car-sport",
  },
  [TRIP_STATUS.ARRIVED_AT_PICKUP]: {
    label: "Driver arrived",
    icon: "location",
  },
  [TRIP_STATUS.PICKED_UP]: {
    label: "Package collected",
    icon: "cube",
  },
  [TRIP_STATUS.EN_ROUTE_TO_DROPOFF]: {
    label: "On the way to destination",
    icon: "navigate",
  },
  [TRIP_STATUS.ARRIVED_AT_DROPOFF]: {
    label: "Arrived at destination",
    icon: "home",
  },
  [TRIP_STATUS.COMPLETED]: {
    label: "Delivered",
    icon: "checkmark-circle",
  },
});

const ACTIVE_TRIP_BUTTON_COLOR = "#F6C74A";

const ACTIVE_DELIVERY_POLL_INTERVAL_MS = 5000;
const IDLE_DELIVERY_POLL_INTERVAL_MS = 30000;

const getTripId = (trip) => {
  const rawId = trip?.id || trip?.requestId || trip?.request_id || null;
  if (!rawId) {
    return null;
  }
  return String(rawId);
};

export default function CustomerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    currentUser,
    refreshProfile,
    getUserPickupRequests,
    createPickupRequest,
    cancelOrder,
    createConversation,
    getRequestById,
    getConversations,
    subscribeToConversations,
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const { createPaymentIntent, confirmPayment } = usePayment();
  const { uploadToSupabase } = useAuth();

  const [userLocation, setUserLocation] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [isSearchSheetExpanded, setIsSearchSheetExpanded] = useState(false);
  const [isActiveDeliverySheetExpanded, setIsActiveDeliverySheetExpanded] = useState(false);
  const [searchElapsedSeconds, setSearchElapsedSeconds] = useState(0);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [orderModalKey, setOrderModalKey] = useState(0);
  const [hasUnreadDeliveryChat, setHasUnreadDeliveryChat] = useState(false);
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

  const floatingBottomOffset = useMemo(
    () => insets.bottom + spacing.lg,
    [insets.bottom]
  );

  const trackerMaxExpandedHeight = useMemo(
    () => Math.max(320, height - insets.top - tabBarHeight - spacing.xxl),
    [height, insets.top, tabBarHeight]
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

  const activeDeliveryStep = useMemo(() => {
    if (!activeDelivery) {
      return null;
    }

    const normalizedStatus = normalizeTripStatus(activeDelivery.status);
    return ACTIVE_DELIVERY_STEP_META[normalizedStatus] || null;
  }, [activeDelivery]);

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
    if (!currentUserId) {
      setActiveDelivery(null);
      setPendingBooking(null);
      return;
    }

    try {
      const requests = await getUserPickupRequests?.();
      if (!Array.isArray(requests)) {
        setActiveDelivery(null);
        setPendingBooking(null);
        return;
      }

      const customerRequests = requests.filter((req) => {
        const requestCustomerId = req?.customerId || req?.customer_id;
        return requestCustomerId === currentUserId;
      });

      const activeRequest = customerRequests.find((req) =>
        ACTIVE_TRIP_STATUSES.includes(normalizeTripStatus(req.status))
      );
      const pendingRequest = customerRequests.find(
        (req) => normalizeTripStatus(req.status) === TRIP_STATUS.PENDING
      );

      setActiveDelivery(activeRequest || null);
      setPendingBooking(activeRequest ? null : pendingRequest || null);
    } catch (error) {
      console.error("Error checking active deliveries:", error);
      setActiveDelivery(null);
      setPendingBooking(null);
    }
  }, [currentUserId, getUserPickupRequests]);

  useEffect(() => {
    loadCurrentLocation();
  }, [loadCurrentLocation]);

  useEffect(() => {
    checkActiveDeliveries();

    const intervalMs = activeDelivery?.id
      ? ACTIVE_DELIVERY_POLL_INTERVAL_MS
      : IDLE_DELIVERY_POLL_INTERVAL_MS;
    const intervalCheck = setInterval(checkActiveDeliveries, intervalMs);

    return () => {
      clearInterval(intervalCheck);
    };
  }, [activeDelivery?.id, checkActiveDeliveries]);

  useFocusEffect(
    useCallback(() => {
      checkActiveDeliveries();
    }, [checkActiveDeliveries])
  );

  useEffect(() => {
    if ((activeDelivery || pendingBooking) && searchModalVisible) {
      setSearchModalVisible(false);
    }
  }, [activeDelivery, pendingBooking, searchModalVisible]);

  useEffect(() => {
    if (!activeDelivery?.id) {
      setIsActiveDeliverySheetExpanded(false);
      setHasUnreadDeliveryChat(false);
    }
  }, [activeDelivery?.id]);

  useEffect(() => {
    const activeRequestId =
      activeDelivery?.id || activeDelivery?.requestId || activeDelivery?.request_id || null;
    if (!activeDelivery || !currentUserId || typeof subscribeToConversations !== "function") {
      setHasUnreadDeliveryChat(false);
      return undefined;
    }

    const requestIdString = activeRequestId ? String(activeRequestId) : "";
    const activeDriverId = String(
      activeDelivery?.assignedDriverId ||
      activeDelivery?.driverId ||
      activeDelivery?.driver_id ||
      ""
    );
    let isDisposed = false;

    const updateUnreadState = (userConversations = []) => {
      if (isDisposed) return;
      const unreadConversations = userConversations.filter(
        (conversation) =>
          Number(conversation?.unreadByCustomer || 0) > 0 &&
          Boolean(conversation?.lastMessageAt || conversation?.lastMessage)
      );

      const hasTripMatchUnread = unreadConversations.some(
        (conversation) =>
        (
          (requestIdString && String(conversation?.requestId || "") === requestIdString) ||
          (activeDriverId && String(conversation?.driverId || "") === activeDriverId)
        )
      );

      // Delivery tracker badge should reflect only active-delivery chat unread state.
      setHasUnreadDeliveryChat(hasTripMatchUnread);
    };

    const refreshUnread = async () => {
      if (typeof getConversations !== "function" || isDisposed) return;
      const conversations = await getConversations(currentUserId, "customer");
      updateUnreadState(Array.isArray(conversations) ? conversations : []);
    };

    refreshUnread();
    const pollInterval = setInterval(refreshUnread, 2500);

    const unsubscribe = subscribeToConversations(
      currentUserId,
      "customer",
      updateUnreadState
    );

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      unsubscribe?.();
    };
  }, [
    activeDelivery?.id,
    activeDelivery?.assignedDriverId,
    activeDelivery?.driverId,
    activeDelivery?.driver_id,
    currentUserId,
    getConversations,
    subscribeToConversations,
  ]);

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

  const handleOpenDeliveryChat = useCallback(
    async (deliveryData) => {
      const requestId = deliveryData?.id || activeDelivery?.id;
      if (!requestId || !currentUserId) {
        return;
      }

      setHasUnreadDeliveryChat(false);

      try {
        let driverId =
          deliveryData?.assignedDriverId ||
          deliveryData?.driverId ||
          deliveryData?.driver_id ||
          activeDelivery?.assignedDriverId ||
          activeDelivery?.driverId ||
          activeDelivery?.driver_id ||
          null;

        let driverName =
          deliveryData?.assignedDriverEmail ||
          deliveryData?.driverEmail ||
          activeDelivery?.assignedDriverEmail ||
          activeDelivery?.driverEmail ||
          "Driver";

        if (!driverId && typeof getRequestById === "function") {
          const latestRequest = await getRequestById(requestId);
          driverId =
            latestRequest?.assignedDriverId ||
            latestRequest?.driverId ||
            latestRequest?.driver_id ||
            null;

          if (!driverName || driverName === "Driver") {
            driverName =
              latestRequest?.assignedDriverEmail ||
              latestRequest?.driverEmail ||
              driverName;
          }
        }

        if (!driverId) {
          Alert.alert("Chat unavailable", "Driver details are not available yet.");
          return;
        }

        const conversationId = await createConversation(requestId, currentUserId, driverId);

        navigation.navigate("MessageScreen", {
          conversationId,
          requestId,
          driverName: driverName || "Driver",
        });
      } catch (chatError) {
        console.error("Error opening delivery chat:", chatError);
        Alert.alert("Error", "Could not open chat right now. Please try again.");
      }
    },
    [
      activeDelivery,
      createConversation,
      currentUserId,
      getRequestById,
      navigation,
      setHasUnreadDeliveryChat,
    ]
  );

  const handleOpenActiveTripDetails = useCallback(() => {
    if (!activeDelivery) {
      return;
    }

    const activeTripId = getTripId(activeDelivery);
    if (!activeTripId) {
      return;
    }

    navigation.navigate("CustomerTripDetailsScreen", {
      tripId: activeTripId,
      tripSummary: activeDelivery,
      tripSnapshot: activeDelivery,
    });
  }, [activeDelivery, navigation]);

  const handleOrderConfirm = useCallback(
    async (orderData) => {
      if (!currentUser?.phone_verified) {
        setPhoneVerifyVisible(true);
        return { pending: true };
      }

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
      if (totalAmount <= 0) {
        return {
          success: false,
          error: "Invalid order total. Please review your order and try again.",
        };
      }

      try {
        // Step 1: Purchase insurance BEFORE payment (so we know the final charge amount)
        let insuranceData = null;
        let finalAmount = totalAmount;

        if (orderData?.insuranceQuote?.offerId) {
          const attemptPurchase = async () => {
            const purchaseResult = await RedkikService.purchaseInsurance(
              orderData.insuranceQuote.offerId
            );
            if (purchaseResult?.bookingId) {
              return {
                bookingId: purchaseResult.bookingId,
                quoteId: orderData.insuranceQuote.offerId,
                premium: orderData.insuranceQuote.premium,
                status: 'purchased',
              };
            }
            return null;
          };

          try {
            insuranceData = await attemptPurchase();
            if (!insuranceData) {
              await new Promise(r => setTimeout(r, 1500));
              insuranceData = await attemptPurchase();
            }
          } catch (insuranceErr) {
            console.warn('Insurance purchase failed:', insuranceErr);
          }

          if (!insuranceData) {
            // Insurance failed — remove premium from charge amount
            const insurancePremium = Number(orderData.insuranceQuote.premium) || 0;
            finalAmount = Math.round((totalAmount - insurancePremium) * 100) / 100;

            insuranceData = {
              quoteId: orderData.insuranceQuote.offerId,
              bookingId: null,
              premium: orderData.insuranceQuote.premium,
              status: 'purchase_failed',
            };

            Alert.alert(
              'Insurance Notice',
              'We could not activate your insurance coverage. You will only be charged for the delivery itself. Our support team will follow up.',
              [{ text: 'OK' }]
            );
          }
        }

        // Step 2: Charge the correct amount (with or without insurance)
        const finalAmountInCents = Math.round(finalAmount * 100);
        if (!Number.isInteger(finalAmountInCents) || finalAmountInCents <= 0) {
          return {
            success: false,
            error: "Invalid order total. Please review your order and try again.",
          };
        }

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
          finalAmountInCents,
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

        // --- NEW: Upload Item Photos and Invoices ---
        const uploadedItems = [];
        const orderIdTimestamp = Date.now();
        
        for (let i = 0; i < (orderData?.items || []).length; i++) {
          const item = orderData.items[i];
          const uploadedPhotos = [];
          
          // Upload Item Photos
          if (Array.isArray(item.photos)) {
            for (let j = 0; j < item.photos.length; j++) {
              const photoUri = item.photos[j];
              if (photoUri && !photoUri.startsWith("http")) {
                try {
                  const filename = `order_items/${currentUserId}/${orderIdTimestamp}/item_${i}_photo_${j}.jpg`;
                  const url = await uploadToSupabase(photoUri, "trip_photos", filename);
                  if (url) uploadedPhotos.push(url);
                } catch (err) {
                  console.error(`Failed to upload photo for item ${i}:`, err);
                  // fallback to original uri if upload fails
                  uploadedPhotos.push(photoUri);
                }
              } else {
                uploadedPhotos.push(photoUri);
              }
            }
          }
          
          // Upload Invoice Photo
          let uploadedInvoicePhoto = item.invoicePhoto;
          if (uploadedInvoicePhoto && !uploadedInvoicePhoto.startsWith("http")) {
            try {
              const filename = `order_items/${currentUserId}/${orderIdTimestamp}/item_${i}_invoice.jpg`;
              const url = await uploadToSupabase(uploadedInvoicePhoto, "trip_photos", filename);
              if (url) uploadedInvoicePhoto = url;
            } catch (err) {
              console.error(`Failed to upload invoice for item ${i}:`, err);
            }
          }
          
          uploadedItems.push({
            ...item,
            photos: uploadedPhotos,
            invoicePhoto: uploadedInvoicePhoto,
          });
        }
        // ---------------------------------------------

        const createdRequest = await createPickupRequest({
          pickup: orderData?.pickup,
          dropoff: orderData?.dropoff,
          pickupDetails: orderData?.pickupDetails || {},
          dropoffDetails: orderData?.dropoffDetails || {},
          vehicle: orderData?.selectedVehicle,
          pricing: {
            ...(orderData?.pricing || {}),
            total: finalAmount,
            distance: Number(orderData?.distance || orderData?.pricing?.distance || 0),
          },
          items: uploadedItems,
          scheduledTime:
            orderData?.scheduleType === "scheduled"
              ? orderData?.scheduledDateTime
              : null,
          insurance: insuranceData,
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

      {activeDelivery && activeDeliveryStep && (
        <View
          style={[
            styles.floatingTriggerContainer,
            { paddingBottom: floatingBottomOffset, width: floatingWidth },
          ]}
        >
          <View style={styles.activeTripPulseWrap}>
            <TouchableOpacity
              style={styles.activeTripTrigger}
              onPress={handleOpenActiveTripDetails}
              activeOpacity={0.95}
            >
              <View style={[styles.activeTripSideSlot, styles.activeTripSideSlotLeft]}>
                <View style={styles.activeTripIconCircle}>
                  <Ionicons
                    name={activeDeliveryStep.icon}
                    size={20}
                    color={colors.background.primary}
                  />
                </View>
              </View>

              <Text style={styles.activeTripTriggerText} numberOfLines={1}>
                {activeDeliveryStep.label}
              </Text>

              <View style={[styles.activeTripSideSlot, styles.activeTripSideSlotRight]}>
                <View style={styles.activeTripOpenIndicator}>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.background.primary}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canCreateOrder && (
        <View
          style={[
            styles.floatingTriggerContainer,
            { paddingBottom: floatingBottomOffset, width: floatingWidth },
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
        customerEmail={currentUser?.email}
        customerName={[currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || undefined}
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
  activeDeliverySheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    bottom: 0,
    zIndex: 24,
    overflow: "hidden",
    marginHorizontal: 0,
    paddingHorizontal: 0,
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
  activeTripPulseWrap: {
    width: "100%",
  },
  activeTripTrigger: {
    backgroundColor: ACTIVE_TRIP_BUTTON_COLOR,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 56,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    shadowColor: ACTIVE_TRIP_BUTTON_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  activeTripSideSlot: {
    width: 34,
    justifyContent: "center",
  },
  activeTripSideSlotLeft: {
    alignItems: "flex-start",
  },
  activeTripSideSlotRight: {
    alignItems: "flex-end",
  },
  activeTripIconCircle: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: "rgba(255,255,255,0.52)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTripTriggerText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.background.primary,
    flex: 1,
    textAlign: "center",
    paddingHorizontal: spacing.xxs,
  },
  activeTripOpenIndicator: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,31,0.14)",
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
