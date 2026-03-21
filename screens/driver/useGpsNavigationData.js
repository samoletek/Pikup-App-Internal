import { useCallback, useEffect, useRef, useState } from 'react';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { normalizeTripStatus, TRIP_STATUS } from '../../constants/tripStatus';
import { buildNavigationCameraConfig } from './navigationCamera.utils';
import {
  calculateDistanceToNextTurnMeters,
  ensureNavigationLocationAccess,
  resolveInitialDriverPosition,
  setNavigationInitialCamera,
  startNavigationLocationWatch,
} from './navigationLocation.utils';
import {
  calculateDistanceAndEta,
  extractCustomerLocationFromRequest,
  extractDestinationFromStatus,
  generateFallbackRoute,
} from './navigationRoute.utils';

const asObject = (value) => (value && typeof value === 'object' ? value : {});

const mergeRequestSnapshots = (previousSnapshot, latestSnapshot) => {
  const previous = asObject(previousSnapshot);
  const latest = asObject(latestSnapshot);
  const previousOriginalData = asObject(previous.originalData);
  const latestOriginalData = asObject(latest.originalData);
  const mergedOriginalData = {
    ...previousOriginalData,
    ...latestOriginalData,
  };

  return {
    ...previous,
    ...latest,
    originalData:
      Object.keys(mergedOriginalData).length > 0
        ? mergedOriginalData
        : latest.originalData || previous.originalData,
  };
};

export default function useGpsNavigationData({
  isCustomerView,
  request,
  getRequestById,
  startDriving,
  updateDriverLocation,
  applyRouteSteps,
  routeSteps,
  currentStepIndex,
  updateNavigationProgress,
}) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [remainingDistance, setRemainingDistance] = useState('Calculating...');
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
  const [currentHeading, setCurrentHeading] = useState(0);

  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const refreshIntervalRef = useRef(null);
  const navigationStartedRef = useRef(false);
  const currentHeadingRef = useRef(0);
  const customerLocationRef = useRef(null);
  const routeStepsRef = useRef(routeSteps || []);
  const currentStepIndexRef = useRef(currentStepIndex || 0);

  useEffect(() => {
    setRequestData(request);
  }, [request]);

  useEffect(() => {
    customerLocationRef.current = customerLocation;
  }, [customerLocation]);

  useEffect(() => {
    routeStepsRef.current = routeSteps || [];
  }, [routeSteps]);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex || 0;
  }, [currentStepIndex]);

  useEffect(() => {
    currentHeadingRef.current = currentHeading || 0;
  }, [currentHeading]);

  const clearCustomerPolling = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const clearNavigationResources = useCallback(() => {
    stopLocationTracking();
    clearCustomerPolling();
  }, [clearCustomerPolling, stopLocationTracking]);

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
  }, []);

  const generateRealRoute = useCallback(async (start, end) => {
    try {
      const routeData = await MapboxLocationService.getRoute(start, end);
      setRouteCoordinates(routeData.coordinates);
      applyRouteSteps(routeData.steps || []);

      const distanceText = routeData.distance.text;
      const durationText = routeData.duration_in_traffic
        ? routeData.duration_in_traffic.text
        : routeData.duration.text;

      setRemainingDistance(distanceText);
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
    } catch (error) {
      logger.error('GpsNavigationData', 'Error getting real route', error);
      const { distanceText, etaText } = calculateDistanceAndEta(start, end);
      setRemainingDistance(distanceText);
      setEstimatedTime(etaText);
      setRouteCoordinates(generateFallbackRoute(start, end));
      applyRouteSteps([]);
    }
  }, [applyRouteSteps]);

  const canStartDrivingTransition = useCallback(() => {
    const normalizedStatus = normalizeTripStatus(requestData?.status || request?.status);
    return normalizedStatus === TRIP_STATUS.ACCEPTED || normalizedStatus === TRIP_STATUS.PENDING;
  }, [request?.status, requestData?.status]);

  const updateDriverLocationInDB = useCallback(async (location) => {
    try {
      if (request?.id && typeof updateDriverLocation === 'function') {
        await updateDriverLocation(request.id, location);
      }
    } catch (error) {
      logger.error('GpsNavigationData', 'Error updating driver location', error);
    }
  }, [request?.id, updateDriverLocation]);

  const startLocationTracking = useCallback(async () => {
    try {
      locationSubscription.current = await startNavigationLocationWatch((locationData) => {
        const newLocation = {
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        };

        setDriverLocation(newLocation);

        if (typeof locationData.coords.heading === 'number') {
          setCurrentHeading(locationData.coords.heading);
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

        if (customerLocationRef.current) {
          generateRealRoute(newLocation, customerLocationRef.current);
        }

        updateNavigationProgress(newLocation);
        updateDriverLocationInDB(newLocation);
      });
    } catch (error) {
      logger.error('GpsNavigationData', 'Error starting location tracking', error);
    }
  }, [
    generateRealRoute,
    updateDriverLocationInDB,
    updateNavigationCamera,
    updateNavigationProgress,
  ]);

  const fetchRequestData = useCallback(async () => {
    try {
      if (!request?.id) {
        return;
      }

      const latestData = await getRequestById(request.id);
      setRequestData((prevRequestData) => mergeRequestSnapshots(prevRequestData, latestData));

      if (isCustomerView && latestData?.driverLocation) {
        setDriverLocation(latestData.driverLocation);

        const destination = extractDestinationFromStatus(latestData);
        if (destination) {
          setCustomerLocation(destination);

          await generateRealRoute(latestData.driverLocation, destination);

          if (mapRef.current) {
            mapRef.current.fitToCoordinates(
              [latestData.driverLocation, destination],
              {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true,
              }
            );
          }
        }
      }
    } catch (error) {
      logger.error('GpsNavigationData', 'Error fetching request data', error);
    }
  }, [generateRealRoute, getRequestById, isCustomerView, request?.id]);

  const initializeCustomerView = useCallback(async () => {
    setIsLoading(true);

    try {
      await fetchRequestData();
      clearCustomerPolling();

      refreshIntervalRef.current = setInterval(() => {
        fetchRequestData();
      }, 10000);

      setIsLoading(false);
    } catch (error) {
      logger.error('GpsNavigationData', 'Error initializing customer view', error);
      setLocationError('Failed to load driver location');
      setIsLoading(false);
    }
  }, [clearCustomerPolling, fetchRequestData]);

  const initializeDriverNavigation = useCallback(async () => {
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
        initialPosition = await resolveInitialDriverPosition();
      } catch (locationInitError) {
        logger.error('GpsNavigationData', 'Error getting initial location', locationInitError);
        setLocationError('Unable to get your location. Please check your GPS settings.');
        setIsLoading(false);
        return;
      }

      const driverCoords = initialPosition.coords;
      setDriverLocation(driverCoords);
      setNavigationInitialCamera(mapRef, driverCoords, initialPosition.heading || 0);

      if (typeof initialPosition.heading === 'number') {
        setCurrentHeading(initialPosition.heading);
      }

      await startLocationTracking();

      const customerCoords = extractCustomerLocationFromRequest({
        requestData,
        routeRequest: request,
        driverLocation: driverCoords,
      });
      if (customerCoords) {
        setCustomerLocation(customerCoords);
        await generateRealRoute(driverCoords, customerCoords);
      }

      if (!navigationStartedRef.current && request?.id) {
        const shouldStartDriving = canStartDrivingTransition();
        if (shouldStartDriving) {
          await startDriving(request.id, driverCoords);
        }
        navigationStartedRef.current = true;
        logger.info(
          'GpsNavigationData',
          shouldStartDriving
            ? 'Driver started navigation'
            : 'Driver resumed navigation without status transition',
          { requestId: request.id, status: normalizeTripStatus(requestData?.status || request?.status) }
        );
      }

      setIsLoading(false);
    } catch (error) {
      logger.error('GpsNavigationData', 'Error initializing tracking', error);
      setLocationError(`Failed to initialize: ${error.message}`);
      setIsLoading(false);
    }
  }, [
    generateRealRoute,
    requestData,
    request,
    canStartDrivingTransition,
    startDriving,
    startLocationTracking,
  ]);

  useEffect(() => {
    if (request?.id) {
      fetchRequestData();
    }
  }, [fetchRequestData, request?.id]);

  return {
    mapRef,
    requestData,
    driverLocation,
    customerLocation,
    routeCoordinates,
    remainingDistance,
    estimatedTime,
    isLoading,
    locationError,
    currentHeading,
    setRemainingDistance,
    setEstimatedTime,
    setLocationError,
    setIsLoading,
    initializeCustomerView,
    initializeDriverNavigation,
    clearNavigationResources,
  };
}
