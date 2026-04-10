import { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  DROPOFF_PHASE_STATUSES,
  TRIP_STATUS,
  normalizeTripStatus,
} from "../../constants/tripStatus";
import {
  ACTIVE_TRIP_STATUS_LABELS,
  REQUEST_POOLS,
} from "./DriverHomeScreen.utils";

const WAIT_TIME_LABEL = "5 to 11 min";
const DEFAULT_PROGRESS_VALUE = 0.3;

const firstNonEmptyText = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return '';
};

const resolveTripAddress = (trip, pointName) => {
  if (!trip || typeof trip !== 'object') {
    return '';
  }

  if (pointName === 'dropoff') {
    return firstNonEmptyText(
      trip?.dropoff?.address,
      trip?.dropoff?.formatted_address,
      trip?.dropoff_location?.address,
      trip?.dropoff_location?.formatted_address,
      trip?.dropoffAddress,
      trip?.dropoff_address,
      trip?.originalData?.dropoff?.address,
      trip?.originalData?.dropoff?.formatted_address,
      trip?.originalData?.dropoff_location?.address,
      trip?.originalData?.dropoff_location?.formatted_address,
      trip?.originalData?.dropoffAddress,
      trip?.originalData?.dropoff_address,
    );
  }

  return firstNonEmptyText(
    trip?.pickup?.address,
    trip?.pickup?.formatted_address,
    trip?.pickup_location?.address,
    trip?.pickup_location?.formatted_address,
    trip?.pickupAddress,
    trip?.pickup_address,
    trip?.originalData?.pickup?.address,
    trip?.originalData?.pickup?.formatted_address,
    trip?.originalData?.pickup_location?.address,
    trip?.originalData?.pickup_location?.formatted_address,
    trip?.originalData?.pickupAddress,
    trip?.originalData?.pickup_address,
  );
};

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
  onOpenNativeNavigation,
  setSelectedRequest,
  setShowAllRequests,
  setShowRequestModal,
}) {
  const onlineDriverPulse = useRef(new Animated.Value(0)).current;
  const handledRouteSelectedRequestIdRef = useRef(null);

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
  const activeJobScheduledAtMs = new Date(
    activeJob?.scheduledTime || activeJob?.scheduled_time || ''
  ).getTime();
  const isFutureScheduledActiveJob = (
    activeJobStatus === 'accepted' &&
    Number.isFinite(activeJobScheduledAtMs) &&
    activeJobScheduledAtMs > Date.now()
  );
  const activeJobStatusLabel = isFutureScheduledActiveJob
    ? 'Scheduled'
    : (ACTIVE_TRIP_STATUS_LABELS[activeJobStatus] || 'Active order');

  const activeJobDestinationAddress = useMemo(() => {
    if (!activeJob) {
      return "";
    }

    if (DROPOFF_PHASE_STATUSES.includes(activeJobStatus)) {
      return resolveTripAddress(activeJob, 'dropoff') || "Drop-off location";
    }

    return resolveTripAddress(activeJob, 'pickup') || "Pickup location";
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
    const resolvedDriverLocation = (
      trip?.driverLocation ||
      trip?.driver_location ||
      driverLocation ||
      null
    );
    const pickupPhotos = trip?.pickupPhotos || trip?.pickup_photos || [];

    if (normalizedStatus === TRIP_STATUS.ARRIVED_AT_PICKUP) {
      navigation.navigate("PickupConfirmationScreen", {
        request: trip,
        driverLocation: resolvedDriverLocation,
      });
      return;
    }

    if (normalizedStatus === TRIP_STATUS.ARRIVED_AT_DROPOFF) {
      navigation.navigate("DeliveryConfirmationScreen", {
        request: trip,
        pickupPhotos,
        driverLocation: resolvedDriverLocation,
      });
      return;
    }

    if (DROPOFF_PHASE_STATUSES.includes(normalizedStatus)) {
      if (typeof onOpenNativeNavigation === 'function') {
        onOpenNativeNavigation({
          ...trip,
          driverLocation: resolvedDriverLocation,
          pickupPhotos,
        });
      }
      return;
    }

    if (typeof onOpenNativeNavigation === 'function') {
      onOpenNativeNavigation({
        ...trip,
        driverLocation: resolvedDriverLocation,
      });
    }
  }, [driverLocation, navigation, onOpenNativeNavigation]);

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

  const routeSelectedRequest = route?.params?.selectedRequest || null;
  const routeSelectedRequestId = routeSelectedRequest?.id || null;

  useEffect(() => {
    if (!routeSelectedRequestId) {
      handledRouteSelectedRequestIdRef.current = null;
      return;
    }

    if (handledRouteSelectedRequestIdRef.current === routeSelectedRequestId) {
      return;
    }

    handledRouteSelectedRequestIdRef.current = routeSelectedRequestId;
    setSelectedRequest(routeSelectedRequest);
    setShowRequestModal(true);
  }, [
    routeSelectedRequest,
    routeSelectedRequestId,
    setSelectedRequest,
    setShowRequestModal,
  ]);

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
