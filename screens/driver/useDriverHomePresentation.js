import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  DROPOFF_PHASE_STATUSES,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import {
  ACTIVE_TRIP_STATUS_LABELS,
  REQUEST_POOLS,
} from "./DriverHomeScreen.utils";

const WAIT_TIME_LABEL = "5 to 11 min";
const DEFAULT_PROGRESS_VALUE = 0.3;

export default function useDriverHomePresentation({
  acceptedRequestId,
  activeJob,
  activeRequestPool,
  driverLocation,
  hasActiveTrip,
  isOnline,
  navigation,
  reopenRequestModalModeRef,
  reopenRequestModalOnFocusRef,
  route,
  setSelectedRequest,
  setShowAllRequests,
  setShowRequestModal,
}) {
  const onlineDriverPulse = useRef(new Animated.Value(0)).current;

  const onlineDriverMarkerCoordinate = useMemo(() => {
    if (!driverLocation?.longitude || !driverLocation?.latitude) {
      return null;
    }
    return [driverLocation.longitude, driverLocation.latitude];
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  const shouldShowOnlineDriverMarker = Boolean(
    isOnline && !acceptedRequestId && onlineDriverMarkerCoordinate
  );

  const onlineDriverPulseSize = onlineDriverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 94],
  });

  const onlineDriverPulseOpacity = onlineDriverPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.05],
  });

  const activeJobStatus = normalizeTripStatus(activeJob?.status);
  const isScheduledPoolActive = activeRequestPool === REQUEST_POOLS.SCHEDULED;
  const activeJobStatusLabel = ACTIVE_TRIP_STATUS_LABELS[activeJobStatus] || "Active order";

  const activeJobDestinationAddress = useMemo(() => {
    if (!activeJob) {
      return "";
    }

    if (DROPOFF_PHASE_STATUSES.includes(activeJobStatus)) {
      return activeJob.dropoffAddress || activeJob?.dropoff?.address || "Drop-off location";
    }

    return activeJob.pickupAddress || activeJob?.pickup?.address || "Pickup location";
  }, [activeJob, activeJobStatus]);

  const activeJobSecondaryLabel = useMemo(() => {
    const primaryItem = activeJob?.item || activeJob?.items?.[0];
    if (primaryItem?.name) {
      return primaryItem.name;
    }

    if (activeJob?.vehicleType) {
      return activeJob.vehicleType;
    }

    return null;
  }, [activeJob]);

  const openActiveTrip = useCallback((trip) => {
    if (!trip?.id) {
      return;
    }

    const normalizedStatus = normalizeTripStatus(trip.status);

    if (DROPOFF_PHASE_STATUSES.includes(normalizedStatus)) {
      navigation.navigate("DeliveryNavigationScreen", {
        request: trip,
        driverLocation: trip?.driverLocation || driverLocation || null,
      });
      return;
    }

    navigation.navigate("GpsNavigationScreen", {
      request: trip,
      stage: "pickup",
    });
  }, [driverLocation, navigation]);

  useEffect(() => {
    if (!shouldShowOnlineDriverMarker) {
      onlineDriverPulse.stopAnimation();
      onlineDriverPulse.setValue(0);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(onlineDriverPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(onlineDriverPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      onlineDriverPulse.stopAnimation();
      onlineDriverPulse.setValue(0);
    };
  }, [onlineDriverPulse, shouldShowOnlineDriverMarker]);

  useEffect(() => {
    if (route.params?.selectedRequest) {
      setSelectedRequest(route.params.selectedRequest);
      setShowRequestModal(true);
    }
  }, [route.params, setSelectedRequest, setShowRequestModal]);

  useFocusEffect(
    useCallback(() => {
      if (!reopenRequestModalOnFocusRef.current) {
        return undefined;
      }

      reopenRequestModalOnFocusRef.current = false;
      const reopenMode = reopenRequestModalModeRef.current;
      reopenRequestModalModeRef.current = "all";

      if (!isOnline || hasActiveTrip) {
        return undefined;
      }

      if (reopenMode === "single") {
        setShowRequestModal(true);
      } else {
        setShowAllRequests(true);
      }

      return undefined;
    }, [
      hasActiveTrip,
      isOnline,
      reopenRequestModalModeRef,
      reopenRequestModalOnFocusRef,
      setShowAllRequests,
      setShowRequestModal,
    ])
  );

  return {
    activeJobDestinationAddress,
    activeJobSecondaryLabel,
    activeJobStatusLabel,
    isScheduledPoolActive,
    onlineDriverMarkerCoordinate,
    onlineDriverPulseOpacity,
    onlineDriverPulseSize,
    openActiveTrip,
    progressValue: DEFAULT_PROGRESS_VALUE,
    shouldShowOnlineDriverMarker,
    waitTime: WAIT_TIME_LABEL,
  };
}
