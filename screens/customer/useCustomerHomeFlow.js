import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  TRIP_STATUS,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import MapboxLocationService from "../../services/MapboxLocationService";
import { submitCustomerOrder } from "../../services/CustomerOrderSubmissionService";
import { logger } from "../../services/logger";
import {
  ACTIVE_DELIVERY_STEP_META,
  getTripId,
} from "./CustomerHomeScreen.utils";

export default function useCustomerHomeFlow({
  activeDelivery,
  pendingBooking,
  currentUser,
  currentUserId,
  navigation,
  checkActiveDeliveries,
  setPendingBooking,
  cancelOrder,
  uploadToSupabase,
  createPaymentIntent,
  confirmPayment,
  createPickupRequest,
  onOrderCreated,
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [orderModalKey, setOrderModalKey] = useState(0);

  const canCreateOrder = !activeDelivery && !pendingBooking;
  const activeDeliveryStep = useMemo(() => {
    if (!activeDelivery) {
      return null;
    }

    const normalizedStatus = normalizeTripStatus(activeDelivery.status);
    const scheduledAtMs = new Date(
      activeDelivery.scheduledTime || activeDelivery.scheduled_time || ''
    ).getTime();
    if (
      normalizedStatus === TRIP_STATUS.ACCEPTED &&
      Number.isFinite(scheduledAtMs) &&
      scheduledAtMs > Date.now()
    ) {
      return {
        label: 'Scheduled',
        icon: 'calendar',
      };
    }
    return ACTIVE_DELIVERY_STEP_META[normalizedStatus] || null;
  }, [activeDelivery]);

  const resolveLocationWithStateCode = useCallback(async (rawLocation) => {
    if (
      !Number.isFinite(Number(rawLocation?.latitude)) ||
      !Number.isFinite(Number(rawLocation?.longitude))
    ) {
      return null;
    }

    const normalizedLocation = {
      latitude: Number(rawLocation.latitude),
      longitude: Number(rawLocation.longitude),
      stateCode: String(rawLocation.stateCode || '').trim().toUpperCase() || null,
    };

    if (normalizedLocation.stateCode) {
      return normalizedLocation;
    }

    try {
      const geocodedLocation = await MapboxLocationService.reverseGeocode(
        normalizedLocation.latitude,
        normalizedLocation.longitude
      );
      const resolvedStateCode = String(geocodedLocation?.stateCode || '')
        .trim()
        .toUpperCase();

      return {
        ...normalizedLocation,
        stateCode: resolvedStateCode || null,
      };
    } catch (error) {
      logger.warn('CustomerHomeFlow', 'Unable to resolve customer geo state from coordinates', error);
      return normalizedLocation;
    }
  }, []);

  const loadCurrentLocation = useCallback(async () => {
    try {
      const savedLocation = await MapboxLocationService.getLastKnownLocation();
      if (savedLocation?.latitude && savedLocation?.longitude) {
        const normalizedSavedLocation = await resolveLocationWithStateCode(savedLocation);
        if (normalizedSavedLocation) {
          setUserLocation(normalizedSavedLocation);
        }
      }

      const location = await MapboxLocationService.getCurrentLocation();
      if (location?.latitude && location?.longitude) {
        const normalizedCurrentLocation = await resolveLocationWithStateCode(location);
        if (normalizedCurrentLocation) {
          setUserLocation(normalizedCurrentLocation);
        }
      }
    } catch (error) {
      logger.error("CustomerHomeFlow", "Location error", error);
    }
  }, [resolveLocationWithStateCode]);

  useEffect(() => {
    void loadCurrentLocation();
  }, [loadCurrentLocation]);

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

      const orderSubmission = await submitCustomerOrder({
        orderData: {
          ...orderData,
          customerLocation: userLocation || null,
        },
        currentUserId,
        uploadToSupabase,
        createPaymentIntent,
        confirmPayment,
        createPickupRequest,
      });

      if (!orderSubmission.success) {
        return {
          success: false,
          error: orderSubmission.error || "Payment failed. Please try again.",
        };
      }

      if (Array.isArray(orderSubmission.notices) && orderSubmission.notices.length > 0) {
        orderSubmission.notices.forEach((notice) => {
          Alert.alert(notice.title, notice.message, [{ text: "OK" }]);
        });
      }

      setSearchModalVisible(false);
      setOrderModalKey((prev) => prev + 1);
      setPendingBooking(orderSubmission.createdRequest || null);
      onOrderCreated?.();
      checkActiveDeliveries();

      return { success: true };
    },
    [
      currentUser?.phone_verified,
      activeDelivery,
      pendingBooking,
      userLocation,
      currentUserId,
      uploadToSupabase,
      createPaymentIntent,
      confirmPayment,
      createPickupRequest,
      setPendingBooking,
      onOrderCreated,
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
              const cancellationResult = await cancelOrder(pendingBooking.id, "customer_request");
              if (!cancellationResult?.success) {
                throw new Error(cancellationResult?.error || "Please try again in a moment.");
              }
              setPendingBooking(null);
              await checkActiveDeliveries();
            } catch (error) {
              logger.error("CustomerHomeFlow", "Error cancelling pending booking", error);
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
  }, [pendingBooking, isCancellingPending, cancelOrder, setPendingBooking, checkActiveDeliveries]);

  return {
    activeDeliveryStep,
    canCreateOrder,
    handleCancelPendingBooking,
    handleOpenActiveTripDetails,
    handleOrderConfirm,
    isCancellingPending,
    orderModalKey,
    phoneVerifyVisible,
    searchModalVisible,
    setPhoneVerifyVisible,
    setSearchModalVisible,
    userLocation,
  };
}
