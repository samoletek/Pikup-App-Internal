import { useCallback, useEffect, useRef, useState } from 'react';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import { buildNavigationCameraConfig } from './navigationCamera.utils';
import {
  calculateDistanceToNextTurnMeters,
  ensureNavigationLocationAccess,
  resolveInitialDriverPosition,
  startNavigationLocationWatch,
} from './navigationLocation.utils';
import {
  calculateDistanceAndEta,
  extractCustomerLocationFromRequest,
  extractDestinationFromStatus,
  generateFallbackRoute,
} from './navigationRoute.utils';
import {
  formatDistance,
  getDistanceFromLatLonInKm,
  resolveNavigationHeading,
} from './navigationMath.utils';
import { hasReachedOrPassedStatus } from '../../services/tripErrorUtils';
import useNavigationPresentationSmoothing from './useNavigationPresentationSmoothing';

const ROUTE_REFRESH_INTERVAL_MS = 7000;
const MAX_NAVIGATION_LOCATION_ACCURACY_METERS = 80;

export default function useGpsNavigationData({
    isCustomerView,
    request,
    getRequestById,
    startDriving,
    updateDriverStatus,
    applyRouteSteps,
    routeSteps,
    currentStepIndex,
    updateNavigationProgress,
}) {
  const [driverLocation, setDriverLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [remainingDistance, setRemainingDistance] = useState('Calculating...');
  const [remainingDistanceMeters, setRemainingDistanceMeters] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState('--');
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [requestData, setRequestData] = useState(request);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [cameraConfig, setCameraConfig] = useState(null);
  const {
    animatePresentation,
    displayCameraConfig,
    displayHeading,
    displayLocation,
    resetPresentation,
    syncPresentation,
  } = useNavigationPresentationSmoothing({
    enabled: !isCustomerView,
  });

  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const refreshIntervalRef = useRef(null);
  const navigationStartedRef = useRef(false);
  const previousDriverLocationRef = useRef(null);
  const currentHeadingRef = useRef(0);
  const customerLocationRef = useRef(null);
  const routeStepsRef = useRef(routeSteps || []);
  const currentStepIndexRef = useRef(currentStepIndex || 0);
  const tripStatusRef = useRef(normalizeTripStatus(request?.status));
  const routeRefreshInFlightRef = useRef(false);
  const lastRouteRefreshAtRef = useRef(0);
  const hasRouteRef = useRef(false);

  useEffect(() => {
    setRequestData(request);
    tripStatusRef.current = normalizeTripStatus(request?.status);
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
    previousDriverLocationRef.current = null;
    hasRouteRef.current = false;
    setCameraConfig(null);
    resetPresentation();
  }, [clearCustomerPolling, resetPresentation, stopLocationTracking]);

  const updateNavigationCamera = useCallback((location, speed, distanceToNextTurn, heading = currentHeadingRef.current) => {
    const nextCameraConfig = buildNavigationCameraConfig({
      location,
      speedMetersPerSecond: speed,
      distanceToNextTurn,
      heading,
    });

    if (nextCameraConfig) {
      setCameraConfig(nextCameraConfig);
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
      setRemainingDistanceMeters(
        Number.isFinite(Number(routeData?.distance?.value))
          ? Number(routeData.distance.value)
          : null
      );
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
      hasRouteRef.current = true;
      return routeData.coordinates;
    } catch (error) {
      logger.error('GpsNavigationData', 'Error getting real route', error);
      if (hasRouteRef.current) {
        return routeCoordinates;
      }

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
      setEstimatedTime(etaText);
      if (!hasRouteRef.current) {
        const fallbackCoordinates = generateFallbackRoute(start, end);
        setRouteCoordinates(fallbackCoordinates);
        applyRouteSteps([]);
        return fallbackCoordinates;
      }

      return [];
    }
  }, [applyRouteSteps, routeCoordinates]);

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
      return await generateRealRoute(start, end);
    } finally {
      routeRefreshInFlightRef.current = false;
    }
  }, [generateRealRoute]);

  const updateDriverLocationInDB = useCallback(async (location) => {
    try {
      if (!request?.id || typeof updateDriverStatus !== 'function') {
        return;
      }

      const currentTripStatus = normalizeTripStatus(
        tripStatusRef.current || requestData?.status || request?.status
      );

      // Pickup navigation should never move the trip backwards once arrival is reached.
      if (hasReachedOrPassedStatus(currentTripStatus, TRIP_STATUS.ARRIVED_AT_PICKUP)) {
        return;
      }

      const updatedTrip = await updateDriverStatus(request.id, TRIP_STATUS.IN_PROGRESS, location);
      tripStatusRef.current = normalizeTripStatus(updatedTrip?.status || TRIP_STATUS.IN_PROGRESS);
    } catch (error) {
      logger.error('GpsNavigationData', 'Error updating driver location', error);
    }
  }, [request?.id, request?.status, requestData?.status, updateDriverStatus]);

  const applyDriverLocationUpdate = useCallback((newLocation, {
    nativeHeading = null,
    speedMetersPerSecond = 0,
    remainingDistanceMetersOverride = null,
    shouldRefreshRoute = true,
  } = {}) => {
    const resolvedHeading = resolveNavigationHeading({
      previousLocation: previousDriverLocationRef.current,
      nextLocation: newLocation,
      nativeHeading,
      currentHeading: currentHeadingRef.current,
      speedMetersPerSecond,
    });
    previousDriverLocationRef.current = newLocation;
    setDriverLocation(newLocation);
    if (Number.isFinite(resolvedHeading)) {
      setCurrentHeading(resolvedHeading);
    }

    const distanceToNextTurn = calculateDistanceToNextTurnMeters({
      routeSteps: routeStepsRef.current,
      currentStepIndex: currentStepIndexRef.current,
      location: newLocation,
    });

    updateNavigationCamera(
      newLocation,
      Number.isFinite(speedMetersPerSecond) ? speedMetersPerSecond : 0,
      distanceToNextTurn,
      resolvedHeading
    );
    animatePresentation({
      location: newLocation,
      heading: resolvedHeading,
      speedMetersPerSecond: Number.isFinite(speedMetersPerSecond) ? speedMetersPerSecond : 0,
      distanceToNextTurn,
    });

    if (Number.isFinite(remainingDistanceMetersOverride)) {
      setRemainingDistance(formatDistance(remainingDistanceMetersOverride));
      setRemainingDistanceMeters(remainingDistanceMetersOverride);
      if (remainingDistanceMetersOverride <= 15) {
        setEstimatedTime('<1');
      } else if (Number.isFinite(speedMetersPerSecond) && speedMetersPerSecond > 0) {
        const etaMinutes = Math.max(1, Math.ceil(remainingDistanceMetersOverride / speedMetersPerSecond / 60));
        setEstimatedTime(String(etaMinutes));
      }
    } else if (customerLocationRef.current && !hasRouteRef.current) {
      const straightDistanceMeters = getDistanceFromLatLonInKm(
        newLocation.latitude,
        newLocation.longitude,
        customerLocationRef.current.latitude,
        customerLocationRef.current.longitude
      ) * 1000;
      if (Number.isFinite(straightDistanceMeters)) {
        setRemainingDistance(formatDistance(straightDistanceMeters));
        setRemainingDistanceMeters(straightDistanceMeters);
      }
    }

    if (shouldRefreshRoute && customerLocationRef.current) {
      void maybeRefreshRoute(newLocation, customerLocationRef.current);
    }

    updateNavigationProgress(newLocation);
    updateDriverLocationInDB(newLocation);
  }, [
    animatePresentation,
    maybeRefreshRoute,
    updateDriverLocationInDB,
    updateNavigationCamera,
    updateNavigationProgress,
  ]);

  const startLocationTracking = useCallback(async () => {
    try {
      locationSubscription.current = await startNavigationLocationWatch((locationData) => {
        const accuracy = Number(locationData?.coords?.accuracy);
        if (
          previousDriverLocationRef.current &&
          Number.isFinite(accuracy) &&
          accuracy > MAX_NAVIGATION_LOCATION_ACCURACY_METERS
        ) {
          return;
        }

        const newLocation = {
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        };
        const speedMetersPerSecond = Number(locationData.coords.speed);

        applyDriverLocationUpdate(newLocation, {
          nativeHeading: locationData.coords.heading,
          speedMetersPerSecond: Number.isFinite(speedMetersPerSecond) ? speedMetersPerSecond : 0,
        });
      });
    } catch (error) {
      logger.error('GpsNavigationData', 'Error starting location tracking', error);
    }
  }, [
    applyDriverLocationUpdate,
  ]);

  const fetchRequestData = useCallback(async () => {
    try {
      if (!request?.id) {
        return;
      }

      const latestData = await getRequestById(request.id);
      setRequestData((prev) => ({ ...(prev || {}), ...(latestData || {}) }));
      tripStatusRef.current = normalizeTripStatus(
        latestData?.status || tripStatusRef.current
      );

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
      setCameraConfig(null);
      hasRouteRef.current = false;
      previousDriverLocationRef.current = null;

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
      previousDriverLocationRef.current = driverCoords;

      const initialHeading = resolveNavigationHeading({
        previousLocation: null,
        nextLocation: driverCoords,
        nativeHeading: initialPosition.heading,
        currentHeading: 0,
        speedMetersPerSecond: 0,
      });
      if (Number.isFinite(initialHeading)) {
        setCurrentHeading(initialHeading);
      }

      const initialCameraConfig = buildNavigationCameraConfig({
        location: driverCoords,
        speedMetersPerSecond: 0,
        distanceToNextTurn: null,
        heading: initialHeading,
      });
      if (initialCameraConfig) {
        setCameraConfig(initialCameraConfig);
      }
      syncPresentation({
        location: driverCoords,
        heading: initialHeading,
        speedMetersPerSecond: 0,
        distanceToNextTurn: null,
      });

      const customerCoords = extractCustomerLocationFromRequest({
        requestData,
        routeRequest: request,
        driverLocation: driverCoords,
      });
      if (customerCoords) {
        setCustomerLocation(customerCoords);
        await maybeRefreshRoute(driverCoords, customerCoords, { force: true });
      }

      await startLocationTracking();

      if (!navigationStartedRef.current && request?.id) {
        const currentTripStatus = normalizeTripStatus(
          tripStatusRef.current || requestData?.status || request?.status
        );
        if (!hasReachedOrPassedStatus(currentTripStatus, TRIP_STATUS.IN_PROGRESS)) {
          const updatedTrip = await startDriving(request.id, driverCoords);
          tripStatusRef.current = normalizeTripStatus(
            updatedTrip?.status || TRIP_STATUS.IN_PROGRESS
          );
          logger.info('GpsNavigationData', 'Driver started navigation', { requestId: request.id });
        }
        navigationStartedRef.current = true;
      }

      setIsLoading(false);
    } catch (error) {
      logger.error('GpsNavigationData', 'Error initializing tracking', error);
      setLocationError(`Failed to initialize: ${error.message}`);
      setIsLoading(false);
    }
  }, [
    maybeRefreshRoute,
    requestData,
    request,
    startDriving,
    startLocationTracking,
    syncPresentation,
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
    displayDriverLocation: isCustomerView ? driverLocation : (displayLocation || driverLocation),
    displayHeading: isCustomerView ? currentHeading : displayHeading,
    routeCoordinates,
    remainingDistance,
    remainingDistanceMeters,
    estimatedTime,
    isLoading,
    locationError,
    currentHeading,
    cameraConfig: isCustomerView ? cameraConfig : (displayCameraConfig || cameraConfig),
    setRemainingDistance,
    setRemainingDistanceMeters,
    setEstimatedTime,
    setLocationError,
    setIsLoading,
    initializeCustomerView,
    initializeDriverNavigation,
    clearNavigationResources,
  };
}
