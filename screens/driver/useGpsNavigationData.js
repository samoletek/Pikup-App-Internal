import { useCallback, useEffect, useRef, useState } from 'react';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
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
import { getDistanceFromLatLonInKm } from './navigationMath.utils';
import { hasReachedOrPassedStatus } from '../../services/tripErrorUtils';

const ROUTE_REFRESH_INTERVAL_MS = 7000;

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

  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const refreshIntervalRef = useRef(null);
  const navigationStartedRef = useRef(false);
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
      setRemainingDistanceMeters(
        Number.isFinite(Number(routeData?.distance?.value))
          ? Number(routeData.distance.value)
          : null
      );
      setEstimatedTime(durationText.replace(' mins', ' min').replace(' min', ''));
      hasRouteRef.current = true;
    } catch (error) {
      logger.error('GpsNavigationData', 'Error getting real route', error);
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

  const startLocationTracking = useCallback(async () => {
    try {
      locationSubscription.current = await startNavigationLocationWatch((locationData) => {
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

        if (customerLocationRef.current) {
          const straightDistanceMeters = getDistanceFromLatLonInKm(
            newLocation.latitude,
            newLocation.longitude,
            customerLocationRef.current.latitude,
            customerLocationRef.current.longitude
          ) * 1000;
          if (Number.isFinite(straightDistanceMeters)) {
            setRemainingDistanceMeters(straightDistanceMeters);
          }

          void maybeRefreshRoute(newLocation, customerLocationRef.current);
        }

        updateNavigationProgress(newLocation);
        updateDriverLocationInDB(newLocation);
      });
    } catch (error) {
      logger.error('GpsNavigationData', 'Error starting location tracking', error);
    }
  }, [
    maybeRefreshRoute,
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
        const initialHeading = Number(initialPosition.heading);
        if (Number.isFinite(initialHeading) && initialHeading >= 0) {
          setCurrentHeading(initialHeading);
        }
      }

      await startLocationTracking();

      const customerCoords = extractCustomerLocationFromRequest({
        requestData,
        routeRequest: request,
        driverLocation: driverCoords,
      });
      if (customerCoords) {
        setCustomerLocation(customerCoords);
        await maybeRefreshRoute(driverCoords, customerCoords, { force: true });
      }

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
    remainingDistanceMeters,
    estimatedTime,
    isLoading,
    locationError,
    currentHeading,
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
