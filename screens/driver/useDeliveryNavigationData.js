import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { TRIP_STATUS } from '../../constants/tripStatus';
import { buildNavigationCameraConfig } from './navigationCamera.utils';
import { calculateDistanceAndEta, generateFallbackRoute } from './navigationRoute.utils';
import {
  calculateDistanceToNextTurnMeters,
  ensureNavigationLocationAccess,
  resolveInitialDriverPosition,
  setNavigationInitialCamera,
  startNavigationLocationWatch,
} from './navigationLocation.utils';

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

  const [driverLocation, setDriverLocation] = useState(initialDriverLocation);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const [currentHeading, setCurrentHeading] = useState(0);

  const updateNavigationCamera = useCallback((location, speed, distanceToNextTurn) => {
    if (!mapRef.current) return;

    const cameraConfig = buildNavigationCameraConfig({
      location,
      speedMetersPerSecond: speed,
      distanceToNextTurn,
      heading: currentHeading || 0,
    });

    if (cameraConfig) {
      mapRef.current.setCamera(cameraConfig);
    }
  }, [currentHeading, mapRef]);

  const updateDriverLocationInDB = useCallback(async (location) => {
    try {
      if (request?.id) {
        await updateDriverStatus(request.id, TRIP_STATUS.EN_ROUTE_TO_DROPOFF, location);
      }
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error updating driver location', error);
    }
  }, [request?.id, updateDriverStatus]);

  const generateRealRoute = useCallback(async (start, end) => {
    try {
      const routeData = await MapboxLocationService.getRoute(start, end);
      setRouteCoordinates(routeData.coordinates);

      applyRouteSteps(routeData.steps || []);

      const durationText = routeData.duration_in_traffic
        ? routeData.duration_in_traffic.text
        : routeData.duration.text;

      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error getting real route', error);
      const { etaText } = calculateDistanceAndEta(start, end);
      setEstimatedTime(etaText.replace(' min', ''));
      setRouteCoordinates(generateFallbackRoute(start, end));
      applyRouteSteps([]);
    }
  }, [applyRouteSteps]);

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

          if (typeof locationData.coords.heading === 'number') {
            setCurrentHeading(locationData.coords.heading);
          }

          const distanceToNextTurn = calculateDistanceToNextTurnMeters({
            routeSteps,
            currentStepIndex,
            location: newLocation,
          });

          updateNavigationCamera(
            newLocation,
            locationData.coords.speed || 0,
            distanceToNextTurn
          );

          if (dropoffLocation) {
            void generateRealRoute(newLocation, dropoffLocation);
          }

          updateNavigationProgress(newLocation);
          void updateDriverLocationInDB(newLocation);
        }
      );
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error starting location tracking', error);
    }
  }, [
    currentStepIndex,
    dropoffLocation,
    generateRealRoute,
    routeSteps,
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
        setCurrentHeading(initialPosition.heading);
      }

      await startLocationTracking();

      const dropoffCoords = extractDropoffLocation(currentLocation);
      if (dropoffCoords) {
        setDropoffLocation(dropoffCoords);
        await generateRealRoute(currentLocation, dropoffCoords);
      }

      setIsLoading(false);
    } catch (error) {
      logger.error('DeliveryNavigationData', 'Error initializing delivery tracking', error);
      setLocationError(`Failed to initialize: ${error.message}`);
      setIsLoading(false);
    }
  }, [
    extractDropoffLocation,
    generateRealRoute,
    initialDriverLocation,
    mapRef,
    startLocationTracking,
  ]);

  const fetchRequestData = useCallback(async () => {
    try {
      const latestData = await getRequestById(request.id);
      setRequestData(latestData);
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
      Alert.alert('Error', 'Failed to update arrival status. Please try again.');
    }
  }, [arriveAtDropoff, driverLocation, navigation, pickupPhotos, requestData]);

  useEffect(() => {
    void initializeDeliveryTracking();
    return () => {
      stopLocationTracking();
    };
  }, [initializeDeliveryTracking, stopLocationTracking]);

  useEffect(() => {
    if (request?.id) {
      void fetchRequestData();
    }
  }, [fetchRequestData, request?.id]);

  return {
    currentHeading,
    driverLocation,
    dropoffLocation,
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
    setEstimatedTime,
    stopLocationTracking,
  };
}
