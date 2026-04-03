import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import { buildNavigationCameraConfig } from './navigationCamera.utils';
import {
  calculateDistanceAndEta,
  generateFallbackRoute,
  navigateDriverToHome,
} from './navigationRoute.utils';
import {
  calculateDistanceToNextTurnMeters,
  ensureNavigationLocationAccess,
  resolveInitialDriverPosition,
  setNavigationInitialCamera,
  startNavigationLocationWatch,
} from './navigationLocation.utils';
import { hasReachedOrPassedStatus } from '../../services/tripErrorUtils';
import { getDistanceFromLatLonInKm } from './navigationMath.utils';

const ROUTE_REFRESH_INTERVAL_MS = 7000;

export default function useDeliveryNavigationData({
  applyRouteSteps,
  arriveAtDropoff,
  currentStepIndex,
  getRequestById,
  initialDriverLocation,
  mapRef,
  navigation,
  pickupPhotos,
  request,
  routeSteps,
  updateDriverStatus,
  updateNavigationProgress,
}) {
  const locationSubscription = useRef(null);
  const dropoffLocationRef = useRef(null);
  const routeStepsRef = useRef(routeSteps || []);
  const currentStepIndexRef = useRef(currentStepIndex || 0);
  const currentHeadingRef = useRef(0);
  const tripStatusRef = useRef(normalizeTripStatus(request?.status));
  const routeRefreshInFlightRef = useRef(false);
  const lastRouteRefreshAtRef = useRef(0);
  const hasRouteRef = useRef(false);

  const [driverLocation, setDriverLocation] = useState(initialDriverLocation);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [remainingDistance, setRemainingDistance] = useState('Calculating...');
  const [remainingDistanceMeters, setRemainingDistanceMeters] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0);

  useEffect(() => {
    dropoffLocationRef.current = dropoffLocation;
  }, [dropoffLocation]);

  useEffect(() => {
    tripStatusRef.current = normalizeTripStatus(request?.status);
  }, [request?.status]);

  useEffect(() => {
    routeStepsRef.current = routeSteps || [];
  }, [routeSteps]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex || 0;
  }, [currentStepIndex]);

  useEffect(() => {
    currentHeadingRef.current = currentHeading || 0;
  }, [currentHeading]);

  const updateNavigationCamera = useCallback((location, speed, distanceToNextTurn) => {
    if (!mapRef.current) return;

    const cameraConfig = buildNavigationCameraConfig({
      location,
      speedMetersPerSecond: speed,
      distanceToNextTurn,
      heading: currentHeadingRef.current,
    });

    if (cameraConfig) {
      mapRef.current.setCamera(cameraConfig);
    }
  }, [mapRef]);

  const updateDriverLocationInDB = useCallback(async (location) => {
    try {
      if (!request?.id || typeof updateDriverStatus !== 'function') {
        return;
      }

      const currentTripStatus = normalizeTripStatus(
        tripStatusRef.current || requestData?.status || request?.status
      );

      // Delivery navigation should not push stale statuses once dropoff arrival is reached.
      if (
        hasReachedOrPassedStatus(currentTripStatus, TRIP_STATUS.ARRIVED_AT_DROPOFF) ||
        !hasReachedOrPassedStatus(currentTripStatus, TRIP_STATUS.PICKED_UP)
      ) {
        return;
      }

      const updatedTrip = await updateDriverStatus(
        request.id,
        TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
        location
      );
      tripStatusRef.current = normalizeTripStatus(
        updatedTrip?.status || TRIP_STATUS.EN_ROUTE_TO_DROPOFF
      );
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error updating driver location', error);
    }
  }, [request?.id, request?.status, requestData?.status, updateDriverStatus]);

  const generateRealRoute = useCallback(async (start, end) => {
    try {
      const routeData = await MapboxLocationService.getRoute(start, end);
      setRouteCoordinates(routeData.coordinates);

      applyRouteSteps(routeData.steps || []);

      const durationText = routeData.duration_in_traffic
        ? routeData.duration_in_traffic.text
        : routeData.duration.text;

      setRemainingDistance(routeData.distance.text);
      setRemainingDistanceMeters(
        Number.isFinite(Number(routeData?.distance?.value))
          ? Number(routeData.distance.value)
          : null
      );
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
      hasRouteRef.current = true;
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error getting real route', error);
      const { distanceText, etaText } = calculateDistanceAndEta(start, end);
      const fallbackDistanceMeters = getDistanceFromLatLonInKm(
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude
      ) * 1000;
      setRemainingDistance(distanceText);
      setRemainingDistanceMeters(
        Number.isFinite(fallbackDistanceMeters) ? fallbackDistanceMeters : null
      );
      setEstimatedTime(etaText.replace(' min', ''));
      if (!hasRouteRef.current) {
        setRouteCoordinates(generateFallbackRoute(start, end));
        applyRouteSteps([]);
      }
    }
  }, [applyRouteSteps]);

  const maybeRefreshRoute = useCallback(async (start, end, { force = false } = {}) => {
    if (!start || !end) {
      return;
    }

    const now = Date.now();
    if (!force) {
      if (routeRefreshInFlightRef.current) {
        return;
      }
      if (now - lastRouteRefreshAtRef.current < ROUTE_REFRESH_INTERVAL_MS) {
        return;
      }
    }

    routeRefreshInFlightRef.current = true;
    lastRouteRefreshAtRef.current = now;
    try {
      await generateRealRoute(start, end);
    } finally {
      routeRefreshInFlightRef.current = false;
    }
  }, [generateRealRoute]);

  const extractDropoffLocation = useCallback((currentLocation) => {
    if (requestData?.dropoffCoordinates) {
      return requestData.dropoffCoordinates;
    }

    if (requestData?.dropoffLat && requestData?.dropoffLng) {
      return {
        latitude: requestData.dropoffLat,
        longitude: requestData.dropoffLng,
      };
    }

    if (currentLocation) {
      return {
        latitude: currentLocation.latitude + 0.008,
        longitude: currentLocation.longitude + 0.005,
      };
    }

    return {
      latitude: 33.7540,
      longitude: -84.3830,
    };
  }, [requestData?.dropoffCoordinates, requestData?.dropoffLat, requestData?.dropoffLng]);

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(async () => {
    try {
      locationSubscription.current = await startNavigationLocationWatch(
        (locationData) => {
          const newLocation = {
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
          };

          setDriverLocation(newLocation);

          const heading = Number(locationData.coords.heading);
          if (Number.isFinite(heading) && heading >= 0) {
            setCurrentHeading(heading);
          }

          const distanceToNextTurn = calculateDistanceToNextTurnMeters({
            routeSteps: routeStepsRef.current,
            currentStepIndex: currentStepIndexRef.current,
            location: newLocation,
          });

          updateNavigationCamera(
            newLocation,
            locationData.coords.speed || 0,
            distanceToNextTurn
          );

          const destination = dropoffLocationRef.current;
          if (destination) {
            const straightDistanceMeters = getDistanceFromLatLonInKm(
              newLocation.latitude,
              newLocation.longitude,
              destination.latitude,
              destination.longitude
            ) * 1000;
            if (Number.isFinite(straightDistanceMeters)) {
              setRemainingDistanceMeters(straightDistanceMeters);
            }

            void maybeRefreshRoute(newLocation, destination);
          }

          updateNavigationProgress(newLocation);
          void updateDriverLocationInDB(newLocation);
        }
      );
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error starting location tracking', error);
    }
  }, [
    maybeRefreshRoute,
    updateDriverLocationInDB,
    updateNavigationCamera,
    updateNavigationProgress,
  ]);

  const initializeDeliveryTracking = useCallback(async () => {
    try {
      setIsLoading(true);

      const accessResult = await ensureNavigationLocationAccess();
      if (!accessResult.granted) {
        setLocationError(accessResult.errorMessage);
        setIsLoading(false);
        return;
      }

      let initialPosition = null;
      try {
        initialPosition = await resolveInitialDriverPosition({
          initialLocation: initialDriverLocation,
        });
      } catch (locationInitError) {
        logger.error('DeliveryNavigationData', 'Error getting current location', locationInitError);
        setLocationError('Unable to get your location. Please check your GPS settings.');
        setIsLoading(false);
        return;
      }

      const currentLocation = initialPosition.coords;
      setDriverLocation(currentLocation);
      setNavigationInitialCamera(mapRef, currentLocation, initialPosition.heading || 0);

      if (typeof initialPosition.heading === 'number') {
        const initialHeading = Number(initialPosition.heading);
        if (Number.isFinite(initialHeading) && initialHeading >= 0) {
          setCurrentHeading(initialHeading);
        }
      }

      await startLocationTracking();

      const dropoffCoords = extractDropoffLocation(currentLocation);
      if (dropoffCoords) {
        dropoffLocationRef.current = dropoffCoords;
        setDropoffLocation(dropoffCoords);
        await maybeRefreshRoute(currentLocation, dropoffCoords, { force: true });
      }

      setIsLoading(false);
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error initializing delivery tracking', error);
      setLocationError(`Failed to initialize: ${error.message}`);
      setIsLoading(false);
    }
  }, [
    extractDropoffLocation,
    maybeRefreshRoute,
    initialDriverLocation,
    mapRef,
    startLocationTracking,
  ]);

  const fetchRequestData = useCallback(async () => {
    try {
      const latestData = await getRequestById(request.id);
      setRequestData((prev) => ({ ...(prev || {}), ...(latestData || {}) }));
      tripStatusRef.current = normalizeTripStatus(
        latestData?.status || tripStatusRef.current
      );
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error fetching request data', error);
    }
  }, [getRequestById, request.id]);

  const handleArriveAtDropoff = useCallback(async () => {
    try {
      if (requestData?.id) {
        await arriveAtDropoff(requestData.id, driverLocation);

        navigation.navigate('DeliveryConfirmationScreen', {
          request: requestData,
          pickupPhotos,
          driverLocation,
        });
      }
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error marking arrival at dropoff', error);
      const errorMessage = String(error?.message || '').toLowerCase();
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
      Alert.alert('Error', 'Failed to update arrival status. Please try again.');
    }
  }, [arriveAtDropoff, driverLocation, navigation, pickupPhotos, requestData]);

  useEffect(() => {
    void initializeDeliveryTracking();
    return () => {
      stopLocationTracking();
    };
    // Delivery bootstrap is intentionally one-time; retry action re-initializes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (request?.id) {
      void fetchRequestData();
    }
  }, [fetchRequestData, request?.id]);

  return {
    currentHeading,
    driverLocation,
    dropoffLocation,
    remainingDistance,
    remainingDistanceMeters,
    estimatedTime,
    handleArriveAtDropoff,
    initializeDeliveryTracking,
    isLoading,
    locationError,
    navigationAttempted,
    requestData,
    routeCoordinates,
    setLocationError,
    setIsLoading,
    setNavigationAttempted,
    setRemainingDistance,
    setRemainingDistanceMeters,
    setEstimatedTime,
    stopLocationTracking,
  };
}
