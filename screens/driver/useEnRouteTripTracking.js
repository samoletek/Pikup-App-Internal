import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Animated } from "react-native";
import * as Location from "expo-location";
import { logger } from "../../services/logger";
import {
  ensureNavigationLocationAccess,
  resolveInitialDriverPosition,
  startNavigationLocationWatch,
} from "./navigationLocation.utils";
import { calculateDistanceAndEta } from "./navigationRoute.utils";
import {
  resolveCustomerNameFromRequest,
  resolveDriverNameFromRequest,
} from "../../utils/participantIdentity";

const { height } = Dimensions.get("window");
const FALLBACK_PICKUP_COORDINATES = { latitude: 33.753746, longitude: -84.38633 };
const FALLBACK_DROPOFF_COORDINATES = { latitude: 33.754746, longitude: -84.38633 };

function parseCoordinates(rawCoordinates) {
  if (!rawCoordinates) {
    return null;
  }

  if (typeof rawCoordinates === "object") {
    const latitude = Number(
      rawCoordinates.latitude ?? rawCoordinates.lat ?? rawCoordinates.y
    );
    const longitude = Number(
      rawCoordinates.longitude ?? rawCoordinates.lng ?? rawCoordinates.lon ?? rawCoordinates.x
    );

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  if (typeof rawCoordinates === "string") {
    try {
      return parseCoordinates(JSON.parse(rawCoordinates));
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function resolveDestination({ isDelivery, request }) {
  const fallbackCoordinates = isDelivery
    ? FALLBACK_DROPOFF_COORDINATES
    : FALLBACK_PICKUP_COORDINATES;

  if (!request || typeof request !== "object") {
    return fallbackCoordinates;
  }

  const directCoordinates = isDelivery
    ? request.dropoffCoordinates
    : request.pickupCoordinates;
  const nestedCoordinates = isDelivery
    ? request.dropoff?.coordinates
    : request.pickup?.coordinates;

  const latKey = isDelivery ? request.dropoffLat : request.pickupLat;
  const lngKey = isDelivery ? request.dropoffLng : request.pickupLng;
  const directLatLng = (
    Number.isFinite(Number(latKey)) && Number.isFinite(Number(lngKey))
      ? { latitude: Number(latKey), longitude: Number(lngKey) }
      : null
  );

  return (
    parseCoordinates(directCoordinates) ||
    parseCoordinates(nestedCoordinates) ||
    directLatLng ||
    fallbackCoordinates
  );
}

function formatRating(rawRating) {
  const numericRating = Number(rawRating);
  if (!Number.isFinite(numericRating) || numericRating <= 0) {
    return "--";
  }
  return numericRating.toFixed(1);
}

export default function useEnRouteTripTracking({
  isCustomerView,
  isDelivery,
  mapRef,
  navigation,
  request,
}) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState("--");
  const [distance, setDistance] = useState("--");
  const slideAnim = useRef(new Animated.Value(height)).current;

  const destination = useMemo(() => {
    return resolveDestination({ isDelivery, request });
  }, [isDelivery, request]);

  const destinationCoordinate = useMemo(() => {
    return [destination.longitude, destination.latitude];
  }, [destination.latitude, destination.longitude]);

  const screenTitle = useMemo(() => {
    if (isDelivery) {
      return isCustomerView ? "Driver on the way to delivery" : "On the way to delivery";
    }
    return isCustomerView ? "Driver on the way" : "On the way to pickup";
  }, [isCustomerView, isDelivery]);

  const locationTitle = isDelivery ? "Delivery Location" : "Pickup Location";
  const locationAddress = (
    isDelivery
      ? request?.dropoff?.address || "Delivery location"
      : request?.pickup?.address || "Pickup location"
  );

  const counterpartName = isCustomerView
    ? resolveDriverNameFromRequest(request, "Your Driver")
    : resolveCustomerNameFromRequest(request, "Customer");
  const counterpartRating = formatRating(
    isCustomerView
      ? request?.driverRating || request?.driver?.rating
      : request?.customerRating || request?.customer?.rating
  );

  useEffect(() => {
    let locationSubscription = null;
    let isMounted = true;

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const updateEtaAndDistance = (coords) => {
      const { distanceText, etaText } = calculateDistanceAndEta(coords, destination);
      setDistance(distanceText);
      setEta(etaText);
    };

    const startTracking = async () => {
      const accessResult = await ensureNavigationLocationAccess();
      if (!accessResult.granted) {
        logger.warn("EnRouteTripTracking", accessResult.errorMessage);
        return;
      }

      let initialPosition = null;
      try {
        initialPosition = await resolveInitialDriverPosition();
      } catch (error) {
        logger.error("EnRouteTripTracking", "Unable to initialize location tracking", error);
        return;
      }

      const initialCoords = initialPosition.coords;
      if (!isMounted) {
        return;
      }

      setDriverLocation(initialCoords);
      updateEtaAndDistance(initialCoords);

      if (mapRef.current?.setCamera) {
        mapRef.current.setCamera({
          centerCoordinate: [
            (initialCoords.longitude + destination.longitude) / 2,
            (initialCoords.latitude + destination.latitude) / 2,
          ],
          zoomLevel: 12.5,
          animationDuration: 1200,
        });
      }

      locationSubscription = await startNavigationLocationWatch(
        (location) => {
          if (!isMounted) {
            return;
          }

          const { latitude, longitude } = location.coords;
          const nextLocation = { latitude, longitude };
          setDriverLocation(nextLocation);
          updateEtaAndDistance(nextLocation);
        },
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        }
      );
    };

    void startTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [destination, mapRef, slideAnim]);

  const handleMessageCustomer = () => {
    navigation.navigate("MessageScreen", { recipientId: request?.customerId });
  };

  const handleMessageDriver = () => {
    navigation.navigate("MessageScreen", { recipientId: request?.driverId });
  };

  const handleCallCustomer = () => {
    logger.info("EnRouteTripTracking", "Calling customer");
  };

  const handleCallDriver = () => {
    logger.info("EnRouteTripTracking", "Calling driver");
  };

  const handleArrived = () => {
    if (isCustomerView) {
      return;
    }

    if (isDelivery) {
      navigation.navigate("DeliveryConfirmationScreen", {
        request,
        pickupPhotos: request?.pickupPhotos || [],
        driverLocation,
      });
      return;
    }

    navigation.navigate("PickupConfirmationScreen", {
      request,
      driverLocation,
    });
  };

  return {
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
  };
}
