import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import { MIN_VERIFICATION_PHOTOS } from '../../hooks/usePickupVerificationPhotos';
import { logger } from '../../services/logger';
import { navigateDriverToHome, parseCoordinates } from './navigationRoute.utils';
import { TRIP_STATUS } from '../../constants/tripStatus';

const DELIVERY_TRIP_HYDRATION_RETRIES = 2;
const DELIVERY_TRIP_HYDRATION_RETRY_DELAY_MS = 600;
const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const resolveTripPointCoordinates = (trip, pointName) => {
  if (!trip || typeof trip !== 'object') {
    return null;
  }

  const points = pointName === 'pickup'
    ? [
      trip?.pickup,
      trip?.pickup?.coordinates,
      trip?.pickupCoordinates,
      trip?.pickup_location?.coordinates,
      trip?.pickup_location,
      trip?.originalData?.pickup,
      trip?.originalData?.pickup?.coordinates,
      trip?.originalData?.pickupCoordinates,
      trip?.originalData?.pickup_location?.coordinates,
      trip?.originalData?.pickup_location,
    ]
    : [
      trip?.dropoff,
      trip?.dropoff?.coordinates,
      trip?.dropoffCoordinates,
      trip?.dropoff_location?.coordinates,
      trip?.dropoff_location,
      trip?.originalData?.dropoff,
      trip?.originalData?.dropoff?.coordinates,
      trip?.originalData?.dropoffCoordinates,
      trip?.originalData?.dropoff_location?.coordinates,
      trip?.originalData?.dropoff_location,
    ];

  for (const candidate of points) {
    const parsed = parseCoordinates(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const latitude = Number(
    pointName === 'pickup'
      ? (
        trip?.pickupLat
        ?? trip?.pickup_lat
        ?? trip?.originalData?.pickupLat
        ?? trip?.originalData?.pickup_lat
      )
      : (
        trip?.dropoffLat
        ?? trip?.dropoff_lat
        ?? trip?.originalData?.dropoffLat
        ?? trip?.originalData?.dropoff_lat
      )
  );
  const longitude = Number(
    pointName === 'pickup'
      ? (
        trip?.pickupLng
        ?? trip?.pickup_lon
        ?? trip?.pickup_lng
        ?? trip?.originalData?.pickupLng
        ?? trip?.originalData?.pickup_lon
        ?? trip?.originalData?.pickup_lng
      )
      : (
        trip?.dropoffLng
        ?? trip?.dropoff_lon
        ?? trip?.dropoff_lng
        ?? trip?.originalData?.dropoffLng
        ?? trip?.originalData?.dropoff_lon
        ?? trip?.originalData?.dropoff_lng
      )
  );

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  return null;
};

const mergeCoordinatesIntoTripPoint = (pointValue, coordinates) => {
  if (!coordinates) {
    return pointValue;
  }

  const normalizedCoordinates = [coordinates.longitude, coordinates.latitude];
  if (pointValue && typeof pointValue === 'object' && !Array.isArray(pointValue)) {
    return {
      ...pointValue,
      coordinates: normalizedCoordinates,
      latitude: Number.isFinite(Number(pointValue.latitude)) ? pointValue.latitude : coordinates.latitude,
      longitude: Number.isFinite(Number(pointValue.longitude)) ? pointValue.longitude : coordinates.longitude,
    };
  }

  return {
    coordinates: normalizedCoordinates,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
};

const applyTripPointFallback = (trip, pointName, fallbackCoordinates) => {
  if (!trip || !fallbackCoordinates) {
    return;
  }

  if (pointName === 'pickup') {
    trip.pickup = mergeCoordinatesIntoTripPoint(trip.pickup, fallbackCoordinates);
    trip.pickup_location = mergeCoordinatesIntoTripPoint(trip.pickup_location, fallbackCoordinates);
    return;
  }

  trip.dropoff = mergeCoordinatesIntoTripPoint(trip.dropoff, fallbackCoordinates);
  trip.dropoff_location = mergeCoordinatesIntoTripPoint(trip.dropoff_location, fallbackCoordinates);
};

const mergeTripForDropoffNavigation = ({ previousTrip, updatedTrip, fallbackDriverLocation = null }) => {
  const safePreviousTrip = previousTrip && typeof previousTrip === 'object' ? previousTrip : {};
  const safeUpdatedTrip = updatedTrip && typeof updatedTrip === 'object' ? updatedTrip : {};

  const mergedTrip = {
    ...safePreviousTrip,
    ...safeUpdatedTrip,
    status: safeUpdatedTrip.status || TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
  };

  if (!mergedTrip.pickup) {
    mergedTrip.pickup = safeUpdatedTrip.pickup_location || safePreviousTrip.pickup || safePreviousTrip.pickup_location || null;
  }

  if (!mergedTrip.dropoff) {
    mergedTrip.dropoff = safeUpdatedTrip.dropoff_location || safePreviousTrip.dropoff || safePreviousTrip.dropoff_location || null;
  }

  if (!mergedTrip.pickup_location) {
    mergedTrip.pickup_location = safeUpdatedTrip.pickup || safePreviousTrip.pickup_location || safePreviousTrip.pickup || null;
  }

  if (!mergedTrip.dropoff_location) {
    mergedTrip.dropoff_location = safeUpdatedTrip.dropoff || safePreviousTrip.dropoff_location || safePreviousTrip.dropoff || null;
  }

  if (!mergedTrip.driverLocation && fallbackDriverLocation) {
    mergedTrip.driverLocation = fallbackDriverLocation;
  }

  if (!mergedTrip.driver_location && fallbackDriverLocation) {
    mergedTrip.driver_location = fallbackDriverLocation;
  }

  if (!mergedTrip.originalData && safePreviousTrip?.originalData) {
    mergedTrip.originalData = safePreviousTrip.originalData;
  }

  if (!mergedTrip.originalData && safePreviousTrip && Object.keys(safePreviousTrip).length > 0) {
    mergedTrip.originalData = safePreviousTrip;
  }

  const fallbackPickupCoordinates = (
    resolveTripPointCoordinates(safeUpdatedTrip, 'pickup')
    || resolveTripPointCoordinates(safePreviousTrip, 'pickup')
  );
  const fallbackDropoffCoordinates = (
    resolveTripPointCoordinates(safeUpdatedTrip, 'dropoff')
    || resolveTripPointCoordinates(safePreviousTrip, 'dropoff')
  );
  applyTripPointFallback(mergedTrip, 'pickup', fallbackPickupCoordinates);
  applyTripPointFallback(mergedTrip, 'dropoff', fallbackDropoffCoordinates);

  return mergedTrip;
};

const hydrateDeliveryTripCoordinates = async ({
  requestId,
  getRequestById,
  fallbackTrip,
}) => {
  if (!requestId || typeof getRequestById !== 'function') {
    return fallbackTrip;
  }

  let latestTrip = fallbackTrip;
  for (let attempt = 0; attempt <= DELIVERY_TRIP_HYDRATION_RETRIES; attempt += 1) {
    try {
      const refreshedTrip = await getRequestById(requestId);
      if (refreshedTrip?.id === requestId) {
        latestTrip = refreshedTrip;
        const hasDropoffCoordinates = Boolean(resolveTripPointCoordinates(refreshedTrip, 'dropoff'));
        if (hasDropoffCoordinates) {
          return refreshedTrip;
        }
      }
    } catch (error) {
      logger.warn('PickupConfirmationFlow', 'Failed to hydrate delivery trip data after pickup confirmation', {
        requestId,
        attempt: attempt + 1,
        error,
      });
    }

    if (attempt < DELIVERY_TRIP_HYDRATION_RETRIES) {
      await wait(DELIVERY_TRIP_HYDRATION_RETRY_DELAY_MS);
    }
  }

  return latestTrip;
};

export default function usePickupConfirmationFlow({
  confirmPickup,
  createConversation,
  currentUserId,
  driverLocation,
  getRequestById,
  getUserProfile,
  navigation,
  photos,
  request,
  startDelivery,
  onDeliveryStarted,
}) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const {
    isCreatingChat,
    openChat,
  } = useDriverTripChat({
    requestData: request,
    routeRequest: request,
    getRequestById,
    getUserProfile,
    currentUserId,
    createConversation,
    navigation,
    errorMessage: 'Could not open chat right now. Please try again.',
  });

  const handleConfirmPickup = useCallback(async () => {
    const requestId = request?.id || request?.requestId || request?.originalData?.id;
    if (!requestId) {
      Alert.alert('Error', 'Could not confirm pickup right now. Please try again.');
      return;
    }

    setIsCompleting(true);
    setIsUploadingPhotos(true);

    try {
      await confirmPickup(requestId, photos, driverLocation);
      setIsUploadingPhotos(false);

      const deliveryTrip = await startDelivery(requestId, driverLocation);
      const hydratedDeliveryTrip = await hydrateDeliveryTripCoordinates({
        requestId,
        getRequestById,
        fallbackTrip: deliveryTrip,
      });
      const resolvedDeliveryTrip = mergeTripForDropoffNavigation({
        previousTrip: request,
        updatedTrip: hydratedDeliveryTrip,
        fallbackDriverLocation: driverLocation || null,
      });
      if (typeof onDeliveryStarted === 'function') {
        await onDeliveryStarted(resolvedDeliveryTrip);
      }
      navigateDriverToHome(navigation, {
        activatedTrip: resolvedDeliveryTrip,
      });
    } catch (error) {
      logger.error('PickupConfirmationFlow', 'Error confirming pickup', error);
      setIsUploadingPhotos(false);
      const errorMessage = String(error?.message || '').toLowerCase();
      if (errorMessage.includes('session expired') || errorMessage.includes('sign in again')) {
        Alert.alert(
          'Session Expired',
          'Your session expired while uploading pickup photos. Please sign in again and retry.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (errorMessage.includes('cancelled')) {
        Alert.alert(
          'Order Cancelled',
          'The customer has cancelled this order.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigateDriverToHome(navigation);
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      Alert.alert(
        'Error',
        'Failed to confirm pickup and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  }, [
    confirmPickup,
    driverLocation,
    getRequestById,
    navigation,
    onDeliveryStarted,
    photos,
    request,
    startDelivery,
  ]);

  const confirmPickupComplete = useCallback(() => {
    if (photos.length < MIN_VERIFICATION_PHOTOS) {
      Alert.alert(
        'Photos Required',
        `Please take at least ${MIN_VERIFICATION_PHOTOS} photos to verify the pickup.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Confirm Pickup', 'Have you successfully picked up all items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Start Delivery',
        onPress: handleConfirmPickup,
      },
    ]);
  }, [handleConfirmPickup, photos.length]);

  return {
    confirmPickupComplete,
    isCompleting,
    isCreatingChat,
    isUploadingPhotos,
    openChat,
  };
}
