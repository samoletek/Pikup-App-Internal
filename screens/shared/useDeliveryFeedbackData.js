import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { TRIP_STATUS } from "../../constants/tripStatus";
import { submitDeliveryFeedback } from "../../services/deliveryFeedbackService";
import { logger } from "../../services/logger";

const DEFAULT_DRIVER_NAME = "Your Driver";
const DEFAULT_VEHICLE_INFO = "Vehicle";
const DEFAULT_DRIVER_RATING = 5;

function resolveDriverNameFromRequest(data) {
  if (!data || typeof data !== "object") {
    return DEFAULT_DRIVER_NAME;
  }

  if (typeof data.assignedDriverName === "string" && data.assignedDriverName.trim()) {
    return data.assignedDriverName.trim();
  }

  const driverEmail = data.assignedDriverEmail || data.driverEmail || data.driver_email;
  if (typeof driverEmail === "string" && driverEmail.includes("@")) {
    return driverEmail.split("@")[0];
  }

  return DEFAULT_DRIVER_NAME;
}

function resolveVehicleInfoFromRequest(data) {
  if (!data || typeof data !== "object") {
    return DEFAULT_VEHICLE_INFO;
  }

  return (
    data.vehicleType ||
    data.vehicle_type ||
    data.vehicle?.type ||
    DEFAULT_VEHICLE_INFO
  );
}

function resolveDriverIdFromRequest(data) {
  return (
    data?.assignedDriverId ||
    data?.driverId ||
    data?.driver_id ||
    null
  );
}

function resolveRequestDateLabel(requestData) {
  if (!requestData) {
    return "Your recent delivery";
  }

  const rawDate = requestData.createdAt || requestData.created_at || null;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const safeDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();

  return safeDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function resolveTipAmount({ customTip, tip }) {
  const chosenTip = customTip ? Number(customTip) : (typeof tip === "number" ? tip : 0);
  return Number.isFinite(chosenTip) && chosenTip >= 0 ? chosenTip : null;
}

export default function useDeliveryFeedbackData({
  routeParams,
  getRequestById,
  updateRequestStatus,
  getDriverProfile,
  currentUser,
  confirmPayment,
  defaultPaymentMethod,
  createPaymentIntent,
  navigation,
}) {
  const { requestId, requestData: initialRequestData } = routeParams || {};
  const [delivered, setDelivered] = useState(true);
  const [tip, setTip] = useState(null);
  const [customTip, setCustomTip] = useState("");
  const [rating, setRating] = useState(5);
  const [requestData, setRequestData] = useState(initialRequestData || null);
  const [loading, setLoading] = useState(!initialRequestData);
  const [driverName, setDriverName] = useState(DEFAULT_DRIVER_NAME);
  const [vehicleInfo, setVehicleInfo] = useState(DEFAULT_VEHICLE_INFO);
  const [driverRating, setDriverRating] = useState(DEFAULT_DRIVER_RATING);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tripTotal = useMemo(() => Number(requestData?.pricing?.total || 0), [requestData?.pricing?.total]);
  const requestDateLabel = useMemo(() => resolveRequestDateLabel(requestData), [requestData]);

  const processRequestData = useCallback(async (data) => {
    if (!data || typeof data !== "object") {
      setDriverName(DEFAULT_DRIVER_NAME);
      setVehicleInfo(DEFAULT_VEHICLE_INFO);
      setDriverRating(DEFAULT_DRIVER_RATING);
      return;
    }

    setDriverName(resolveDriverNameFromRequest(data));
    setVehicleInfo(resolveVehicleInfoFromRequest(data));

    const driverId = resolveDriverIdFromRequest(data);
    if (!driverId || typeof getDriverProfile !== "function") {
      setDriverRating(DEFAULT_DRIVER_RATING);
      return;
    }

    try {
      const driverProfile = await getDriverProfile(driverId);
      const parsedRating = Number(
        driverProfile?.rating || driverProfile?.driverProfile?.rating || DEFAULT_DRIVER_RATING
      );
      setDriverRating(Number.isFinite(parsedRating) ? parsedRating : DEFAULT_DRIVER_RATING);
    } catch (error) {
      logger.error("DeliveryFeedbackData", "Error loading driver rating", error);
      setDriverRating(DEFAULT_DRIVER_RATING);
    }
  }, [getDriverProfile]);

  const fetchRequestData = useCallback(async () => {
    if (!requestId || typeof getRequestById !== "function") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const fetchedRequest = await getRequestById(requestId);
      setRequestData(fetchedRequest);
      await processRequestData(fetchedRequest);
    } catch (error) {
      logger.error("DeliveryFeedbackData", "Error fetching request data", error);
      Alert.alert("Error", "Failed to load delivery information");
    } finally {
      setLoading(false);
    }
  }, [getRequestById, processRequestData, requestId]);

  useEffect(() => {
    const hydrate = async () => {
      if (requestId && !initialRequestData) {
        await fetchRequestData();
        return;
      }

      if (initialRequestData) {
        await processRequestData(initialRequestData);
      }

      setLoading(false);
    };

    void hydrate();
  }, [fetchRequestData, initialRequestData, processRequestData, requestId]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);
      const effectiveRequestId = requestId || requestData?.id || initialRequestData?.id;
      if (!effectiveRequestId) {
        throw new Error("Missing request ID for feedback submission");
      }

      const chosenTip = resolveTipAmount({ customTip, tip });
      if (chosenTip === null) {
        Alert.alert("Invalid tip amount", "Please enter a valid tip amount.");
        return;
      }

      const activeRequestData = requestData || initialRequestData || {};
      const driverId = resolveDriverIdFromRequest(activeRequestData);
      let tipPaymentIntentId = null;

      if (chosenTip > 0) {
        if (!defaultPaymentMethod?.stripePaymentMethodId) {
          Alert.alert("Payment method required", "Please add a payment method before sending a tip.");
          return;
        }

        const tipAmountInCents = Math.round(chosenTip * 100);
        const createTipIntentResult = await createPaymentIntent(tipAmountInCents, "usd", {
          type: "tip",
          requestId: effectiveRequestId,
          driverId,
          customerId: currentUser?.uid || currentUser?.id,
        });

        if (!createTipIntentResult.success || !createTipIntentResult.paymentIntent?.client_secret) {
          Alert.alert("Tip Payment Failed", createTipIntentResult.error || "Unable to start tip payment");
          return;
        }

        const paymentResult = await confirmPayment(
          createTipIntentResult.paymentIntent.client_secret,
          defaultPaymentMethod?.stripePaymentMethodId
        );

        if (!paymentResult.success) {
          Alert.alert("Tip Payment Failed", paymentResult.error || "Unable to process tip payment");
          return;
        }

        tipPaymentIntentId = (
          paymentResult.paymentIntent?.id ||
          createTipIntentResult.paymentIntent.id ||
          null
        );
      }

      const feedbackResult = await submitDeliveryFeedback({
        requestId: effectiveRequestId,
        rating,
        tip: chosenTip,
        driverId,
      });

      if (!feedbackResult.success) {
        logger.warn("DeliveryFeedbackData", "Feedback edge function returned error", feedbackResult.error);
      }

      await updateRequestStatus(effectiveRequestId, TRIP_STATUS.COMPLETED, {
        customerRating: rating,
        customerTip: chosenTip || 0,
        tipPaymentIntentId,
        feedbackSubmitted: true,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert(
        "Thank You!",
        chosenTip > 0 ? "Your tip was sent and feedback submitted!" : "Feedback submitted!",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("CustomerTabs"),
          },
        ]
      );
    } catch (error) {
      logger.error("DeliveryFeedbackData", "Error submitting feedback", error);
      Alert.alert("Error", error.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    confirmPayment,
    createPaymentIntent,
    currentUser?.id,
    currentUser?.uid,
    customTip,
    defaultPaymentMethod?.stripePaymentMethodId,
    initialRequestData,
    navigation,
    rating,
    requestData,
    requestId,
    submitting,
    tip,
    updateRequestStatus,
  ]);

  const handleStartClaim = useCallback(() => {
    navigation.navigate("CustomerClaimsScreen");
  }, [navigation]);

  const handleViewPhotos = useCallback(() => {
    setShowPhotosModal(true);
  }, []);

  return {
    customTip,
    delivered,
    driverName,
    driverRating,
    handleStartClaim,
    handleSubmit,
    handleViewPhotos,
    loading,
    requestData,
    requestDateLabel,
    setCustomTip,
    setDelivered,
    setRating,
    setShowPhotosModal,
    setTip,
    showPhotosModal,
    submitting,
    tip,
    tripTotal,
    vehicleInfo,
    rating,
  };
}
