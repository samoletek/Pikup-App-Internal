import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  COMING_SOON_UNSUPPORTED_STATE_MESSAGE,
  CUSTOMER_LOCATION_REQUIRED_MESSAGE,
  SERVICE_AREA_UNRESOLVED_MESSAGE,
  SUPPORTED_ORDER_STATE_CODES,
} from "../../constants/orderAvailability";
import {
  isSupportedOrderStateCode,
  resolveLocationStateCode,
} from "../../utils/locationState";
import {
  ACTIVE_DELIVERY_STEP_META,
  getTripId,
} from "./CustomerHomeScreen.utils";
import { ensureForegroundLocationAvailability } from "../../utils/locationPermissions";
import { isPhoneVerified } from "../../utils/profileFlags";
import { shouldShowCancellationAlert } from "../../services/cancellationAlertDeduper";

export const CUSTOMER_LOCATION_GATE_STATUS = Object.freeze({
  CHECKING: "checking",
  ALLOWED: "allowed",
  PERMISSION_DENIED: "permission_denied",
  SERVICES_DISABLED: "services_disabled",
  STATE_UNRESOLVED: "state_unresolved",
  UNSUPPORTED_STATE: "unsupported_state",
});

export default function useCustomerHomeFlow({
  activeDelivery,
  pendingBooking,
  currentUser,
  currentUserId,
  navigation,
  checkActiveDeliveries,
  recentCancellation,
  clearRecentCancellation,
  recentCompletion,
  clearRecentCompletion,
  setPendingBooking,
  cancelOrder,
  uploadToSupabase,
  createPickupRequest,
  onOrderCreated,
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [locationGateStatus, setLocationGateStatus] = useState(CUSTOMER_LOCATION_GATE_STATUS.CHECKING);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [orderModalKey, setOrderModalKey] = useState(0);
  const lastDriverCancellationAlertTripIdRef = useRef(null);
  const lastAutoOpenedCompletedTripIdRef = useRef(null);
  const isPhoneVerifiedForOrders = isPhoneVerified(currentUser);
  const isGeorgiaOrderGateOpen =
    locationGateStatus === CUSTOMER_LOCATION_GATE_STATUS.ALLOWED;
  const isPhoneVerificationRequiredForOrders =
    isGeorgiaOrderGateOpen && !isPhoneVerifiedForOrders;

  const canCreateOrder = (
    !activeDelivery &&
    !pendingBooking &&
    isGeorgiaOrderGateOpen &&
    isPhoneVerifiedForOrders
  );
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

  const ensureHomeLocationAvailability = useCallback(async () => {
    const availability = await ensureForegroundLocationAvailability({
      loggerScope: "CustomerHomeFlow",
      permissionDeniedMessage: CUSTOMER_LOCATION_REQUIRED_MESSAGE,
      servicesDisabledMessage:
        "Please enable Location Services to check service availability in your area.",
      onPermissionDenied: () => {
        setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.PERMISSION_DENIED);
      },
      onServicesDisabled: () => {
        setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.SERVICES_DISABLED);
      },
      onError: () => {
        setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.STATE_UNRESOLVED);
      },
    });

    if (!availability.ok) {
      return false;
    }

    return true;
  }, []);

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
    setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.CHECKING);

    const hasLocationAccess = await ensureHomeLocationAvailability();
    if (!hasLocationAccess) {
      setUserLocation(null);
      return;
    }

    try {
      let nextUserLocation = null;

      const savedLocation = await MapboxLocationService.getLastKnownLocation();
      if (savedLocation?.latitude && savedLocation?.longitude) {
        const normalizedSavedLocation = await resolveLocationWithStateCode(savedLocation);
        if (normalizedSavedLocation) {
          setUserLocation(normalizedSavedLocation);
          nextUserLocation = normalizedSavedLocation;
        }
      }

      const location = await MapboxLocationService.getCurrentLocation();
      if (location?.latitude && location?.longitude) {
        const normalizedCurrentLocation = await resolveLocationWithStateCode(location);
        if (normalizedCurrentLocation) {
          setUserLocation(normalizedCurrentLocation);
          nextUserLocation = normalizedCurrentLocation;
        }
      }

      const stateCode = resolveLocationStateCode(nextUserLocation || null);
      if (!stateCode) {
        setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.STATE_UNRESOLVED);
        return;
      }

      if (!isSupportedOrderStateCode(stateCode, SUPPORTED_ORDER_STATE_CODES)) {
        setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.UNSUPPORTED_STATE);
        return;
      }

      setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.ALLOWED);
    } catch (error) {
      logger.error("CustomerHomeFlow", "Location error", error);
      setLocationGateStatus(CUSTOMER_LOCATION_GATE_STATUS.STATE_UNRESOLVED);
    }
  }, [ensureHomeLocationAvailability, resolveLocationWithStateCode]);

  useEffect(() => {
    void loadCurrentLocation();
  }, [loadCurrentLocation]);

  useFocusEffect(
    useCallback(() => {
      checkActiveDeliveries();
      void loadCurrentLocation();
    }, [checkActiveDeliveries, loadCurrentLocation])
  );

  useEffect(() => {
    if ((activeDelivery || pendingBooking) && searchModalVisible) {
      setSearchModalVisible(false);
    }
  }, [activeDelivery, pendingBooking, searchModalVisible]);

  useEffect(() => {
    const cancelledTripId = String(recentCancellation?.id || '').trim();
    if (!cancelledTripId) {
      return;
    }

    const cancellationReason = String(recentCancellation?.reason || '').trim().toLowerCase();
    if (cancellationReason !== 'driver_request') {
      return;
    }

    if (lastDriverCancellationAlertTripIdRef.current === cancelledTripId) {
      return;
    }

    lastDriverCancellationAlertTripIdRef.current = cancelledTripId;
    clearRecentCancellation?.();
    if (
      !shouldShowCancellationAlert({
        tripId: cancelledTripId,
        reason: cancellationReason,
      })
    ) {
      return;
    }
    Alert.alert(
      'Order Cancelled',
      'The driver has cancelled this order.',
      [{ text: 'OK' }],
      { cancelable: false }
    );
  }, [clearRecentCancellation, recentCancellation]);

  useEffect(() => {
    const completedTripId = String(recentCompletion?.id || '').trim();
    if (!completedTripId) {
      return;
    }

    if (lastAutoOpenedCompletedTripIdRef.current === completedTripId) {
      return;
    }

    lastAutoOpenedCompletedTripIdRef.current = completedTripId;
    clearRecentCompletion?.();

    navigation.navigate("CustomerTripDetailsScreen", {
      tripId: completedTripId,
      tripSummary: recentCompletion?.tripSnapshot || null,
      tripSnapshot: recentCompletion?.tripSnapshot || null,
    });
  }, [clearRecentCompletion, navigation, recentCompletion]);

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
      if (isPhoneVerificationRequiredForOrders) {
        return {
          success: false,
          error: "Please verify your phone number before creating an order.",
        };
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
      isPhoneVerificationRequiredForOrders,
      activeDelivery,
      pendingBooking,
      userLocation,
      currentUserId,
      uploadToSupabase,
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

  const locationGateNotice = useMemo(() => {
    switch (locationGateStatus) {
      case CUSTOMER_LOCATION_GATE_STATUS.PERMISSION_DENIED:
        return CUSTOMER_LOCATION_REQUIRED_MESSAGE;
      case CUSTOMER_LOCATION_GATE_STATUS.SERVICES_DISABLED:
        return "Please enable Location Services to check service availability in your area.";
      case CUSTOMER_LOCATION_GATE_STATUS.STATE_UNRESOLVED:
        return SERVICE_AREA_UNRESOLVED_MESSAGE;
      case CUSTOMER_LOCATION_GATE_STATUS.UNSUPPORTED_STATE:
        return COMING_SOON_UNSUPPORTED_STATE_MESSAGE;
      default:
        return null;
    }
  }, [locationGateStatus]);

  const phoneGateNotice = useMemo(() => {
    if (!isPhoneVerificationRequiredForOrders) {
      return null;
    }

    return "Please verify your phone number before creating a new order.";
  }, [isPhoneVerificationRequiredForOrders]);

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
    locationGateNotice,
    phoneGateNotice,
    locationGateStatus,
    isPhoneVerificationRequiredForOrders,
    userLocation,
  };
}
