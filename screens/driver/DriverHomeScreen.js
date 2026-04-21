import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useAuthIdentity,
  useDriverActions,
  useProfileActions,
  useTripActions,
} from '../../contexts/AuthContext';
import DriverHomeScreenContent from '../../components/driver/DriverHomeScreenContent';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import useIncomingRequestRoute from '../../hooks/useIncomingRequestRoute';
import useRequestOfferTimer from '../../hooks/useRequestOfferTimer';
import useDriverRequestPoolRealtime from '../../hooks/useDriverRequestPoolRealtime';
import useDriverAvailabilityActions from '../../hooks/useDriverAvailabilityActions';
import useDriverIncomingRequestHandlers from '../../hooks/useDriverIncomingRequestHandlers';
import useDriverActiveTripRestore from '../../hooks/useDriverActiveTripRestore';
import useDriverRequestsFeed from '../../hooks/useDriverRequestsFeed';
import useDriverHomeLocationTracking from '../../hooks/useDriverHomeLocationTracking';
import useMapboxNavigation from '../../components/mapbox/useMapboxNavigation';
import useDriverHomeRequestActions from './useDriverHomeRequestActions';
import useAcceptedScheduledRequests from './useAcceptedScheduledRequests';
import useDriverHomePresentation from './useDriverHomePresentation';
import styles from './DriverHomeScreen.styles';
import { appConfig } from '../../config/appConfig';
import { buildDriverHomeContentProps } from './driverHomeContentProps';
import {
  REQUEST_POOLS,
  formatRequestTime,
  resolveDriverGeoRestriction,
  resolveDriverOnboardingDestination,
  resolveDriverOnboardingUiState,
} from './DriverHomeScreen.utils';
import { parseCoordinates } from './navigationRoute.utils';
import {
  DRIVER_AVAILABILITY_COMING_SOON_MESSAGE,
  DRIVER_AVAILABILITY_COMING_SOON_TITLE,
  SUPPORTED_ORDER_STATE_CODES,
} from '../../constants/orderAvailability';
import {
  ARRIVAL_UNLOCK_RADIUS_METERS,
  DROPOFF_ARRIVAL_UNLOCK_RADIUS_METERS,
  formatDistance,
  getDistanceFromLatLonInKm,
} from './navigationMath.utils';
import {
  DROPOFF_PHASE_STATUSES,
  PICKUP_PHASE_STATUSES,
  TRIP_STATUS,
  isFutureScheduledTrip,
  normalizeTripStatus,
} from '../../constants/tripStatus';
import {
  isSupportedOrderStateCode,
} from '../../utils/locationState';
import { logger } from '../../services/logger';
import {
  getDriverReadinessProfile,
  subscribeToDriverProfileUpdates,
} from '../../services/DriverService';

const parseTripPoint = (trip, pointName) => {
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
      ? (trip?.pickupLat ?? trip?.pickup_lat ?? trip?.originalData?.pickupLat ?? trip?.originalData?.pickup_lat)
      : (trip?.dropoffLat ?? trip?.dropoff_lat ?? trip?.originalData?.dropoffLat ?? trip?.originalData?.dropoff_lat)
  );
  const longitude = Number(
    pointName === 'pickup'
      ? (
        trip?.pickupLng ??
        trip?.pickup_lon ??
        trip?.pickup_lng ??
        trip?.originalData?.pickupLng ??
        trip?.originalData?.pickup_lon ??
        trip?.originalData?.pickup_lng
      )
      : (
        trip?.dropoffLng ??
        trip?.dropoff_lon ??
        trip?.dropoff_lng ??
        trip?.originalData?.dropoffLng ??
        trip?.originalData?.dropoff_lon ??
        trip?.originalData?.dropoff_lng
      )
  );

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  return null;
};

const parseTripDriverLocation = (trip) => (
  parseCoordinates(trip?.driverLocation)
  || parseCoordinates(trip?.driver_location)
  || parseCoordinates(trip?.originalData?.driverLocation)
  || parseCoordinates(trip?.originalData?.driver_location)
  || null
);

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

const NAVIGATION_DESTINATION_HYDRATION_ATTEMPTS = 3;
const NAVIGATION_DESTINATION_HYDRATION_DELAY_MS = 450;
const MIN_ROUTE_PROGRESS_LOCATION_DELTA_METERS = 3;
const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const resolveNavigationStageFromTrip = (trip, preferredStage = 'pickup') => {
  const normalizedStatus = normalizeTripStatus(trip?.status);
  if (DROPOFF_PHASE_STATUSES.includes(normalizedStatus)) {
    return 'dropoff';
  }

  if (PICKUP_PHASE_STATUSES.includes(normalizedStatus)) {
    return 'pickup';
  }

  return preferredStage === 'dropoff' ? 'dropoff' : 'pickup';
};

const resolveTripDestinationByStage = (trip, preferredStage = 'pickup') => {
  const stageByStatus = resolveNavigationStageFromTrip(trip, preferredStage);
  const alternateStage = stageByStatus === 'dropoff' ? 'pickup' : 'dropoff';
  const candidateStages = [
    stageByStatus,
    preferredStage,
    alternateStage,
  ].filter((stage, index, list) => list.indexOf(stage) === index);

  for (const stage of candidateStages) {
    const destination = parseTripPoint(trip, stage);
    if (destination) {
      return { stage, destination };
    }
  }

  return {
    stage: stageByStatus,
    destination: null,
  };
};

const resolvePickupToDropoffFallbackRoute = (trip) => {
  const pickup = parseTripPoint(trip, 'pickup');
  const dropoff = parseTripPoint(trip, 'dropoff');
  if (!pickup || !dropoff) {
    return null;
  }

  return {
    origin: pickup,
    destination: dropoff,
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

const mergeTripForNavigation = ({ previousTrip, updatedTrip, fallbackStatus = null, fallbackDriverLocation = null }) => {
  const safePreviousTrip = previousTrip && typeof previousTrip === 'object' ? previousTrip : {};
  const safeUpdatedTrip = updatedTrip && typeof updatedTrip === 'object' ? updatedTrip : {};

  const mergedTrip = {
    ...safePreviousTrip,
    ...safeUpdatedTrip,
  };

  if (!mergedTrip.status && fallbackStatus) {
    mergedTrip.status = fallbackStatus;
  }

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
    parseTripPoint(safeUpdatedTrip, 'pickup')
    || parseTripPoint(safePreviousTrip, 'pickup')
  );
  const fallbackDropoffCoordinates = (
    parseTripPoint(safeUpdatedTrip, 'dropoff')
    || parseTripPoint(safePreviousTrip, 'dropoff')
  );
  applyTripPointFallback(mergedTrip, 'pickup', fallbackPickupCoordinates);
  applyTripPointFallback(mergedTrip, 'dropoff', fallbackDropoffCoordinates);

  return mergedTrip;
};

const RECENTLY_HANDLED_REQUEST_TTL_MS = 2 * 60 * 1000;

export default function DriverHomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const { userType, currentUser } = useAuthIdentity();
  const { getUserProfile } = useProfileActions();
  const {
    getUserPickupRequests,
    getAvailableRequests,
    declineRequestOffer,
    acceptRequest,
    getRequestById,
    startDriving,
    arriveAtPickup,
    arriveAtDropoff,
    checkExpiredRequests,
    cancelOrder,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    updateDriverLocation,
  } = useTripActions();
  const {
    getDriverProfile,
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat,
  } = useDriverActions();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const [isOnline, setIsOnline] = useState(false);
  const [activeRequestPool, setActiveRequestPool] = useState(REQUEST_POOLS.ASAP);
  const [activeJob, setActiveJob] = useState(null);

  // Request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestModalMode, setRequestModalMode] = useState('available');

  // New incoming request modal state
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);

  // Offline dashboard expansion state
  const [, setDashboardExpanded] = useState(false);

  // Route for incoming request (Mapbox Directions)
  const cameraRef = useRef(null);

  // Minimize + timer state for incoming request
  const [isMinimized, setIsMinimized] = useState(false);
  const handleOfferTimeoutRef = useRef(null);
  const isAcceptingRequestRef = useRef(false);
  const incomingRequestIdRef = useRef(null);
  const recentlyHandledRequestIdsRef = useRef(new Map());
  const reopenRequestModalOnFocusRef = useRef(false);
  const reopenRequestModalModeRef = useRef('all');
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
  const [isArriveActionLoading, setIsArriveActionLoading] = useState(false);
  const [isCancelActiveTripLoading, setIsCancelActiveTripLoading] = useState(false);
  const [driverReadinessState, setDriverReadinessState] = useState({
    checked: false,
    loading: true,
    ready: false,
    issues: [],
  });
  const hasActiveTrip = Boolean(acceptedRequestId && activeJob?.id);
  const markRequestHandled = useCallback((requestId) => {
    const normalizedId = String(requestId || '').trim();
    if (!normalizedId) {
      return;
    }
    recentlyHandledRequestIdsRef.current.set(normalizedId, Date.now());
  }, []);
  const shouldSuppressRequest = useCallback((request) => {
    const requestId = String(request?.id || '').trim();
    if (!requestId) {
      return false;
    }

    const handledAtMs = Number(recentlyHandledRequestIdsRef.current.get(requestId));
    if (!Number.isFinite(handledAtMs)) {
      return false;
    }

    const ageMs = Date.now() - handledAtMs;
    if (ageMs >= RECENTLY_HANDLED_REQUEST_TTL_MS) {
      recentlyHandledRequestIdsRef.current.delete(requestId);
      return false;
    }

    return true;
  }, []);

  const mapRef = useRef(null);
  const refreshDriverReadiness = useCallback(async () => {
    if (!currentUserId) {
      setDriverReadinessState({
        checked: false,
        loading: false,
        ready: false,
        issues: ['Not authenticated'],
      });
      return;
    }

    setDriverReadinessState((previous) => ({
      ...previous,
      loading: true,
    }));

    try {
      const readiness = await getDriverReadinessProfile(currentUserId);
      const issues = Array.isArray(readiness?.issues) ? readiness.issues : [];
      setDriverReadinessState({
        checked: true,
        loading: false,
        ready: Boolean(readiness?.ready),
        issues,
      });
    } catch (error) {
      logger.warn('DriverHomeScreen', 'Failed to refresh driver readiness state', error);
      setDriverReadinessState({
        checked: true,
        loading: false,
        ready: false,
        issues: ['Could not load profile'],
      });
    }
  }, [currentUserId]);

  useEffect(() => {
    void refreshDriverReadiness();
  }, [refreshDriverReadiness]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void refreshDriverReadiness();
  }, [isFocused, refreshDriverReadiness]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    return subscribeToDriverProfileUpdates(currentUserId, () => {
      void refreshDriverReadiness();
    });
  }, [currentUserId, refreshDriverReadiness]);

  const { showOnboardingRequiredBanner: showOnboardingRequiredBannerFromProfile } =
    resolveDriverOnboardingUiState(currentUser);
  const hasReadinessBlockingIssue = useMemo(() => {
    if (!driverReadinessState.checked) {
      return false;
    }

    const issues = Array.isArray(driverReadinessState.issues)
      ? driverReadinessState.issues
      : [];
    return issues.some((issue) => (
      issue === 'vehicle' ||
      issue === 'identity' ||
      issue === 'payment' ||
      issue === 'Could not load profile' ||
      issue === 'Not authenticated'
    ));
  }, [driverReadinessState.checked, driverReadinessState.issues]);
  const showOnboardingRequiredBanner = (
    showOnboardingRequiredBannerFromProfile ||
    hasReadinessBlockingIssue
  );
  const shouldLockAvailabilityForReadinessCheck = (
    !hasActiveTrip &&
    !isOnline &&
    !driverReadinessState.checked &&
    driverReadinessState.loading
  );
  const isAvailabilityLocked = (
    showOnboardingRequiredBanner ||
    shouldLockAvailabilityForReadinessCheck
  );
  const {
    driverLocation,
    driverLocationStateCode,
    hasResolvedDriverLocationState,
    region,
    setDriverLocation,
  } = useDriverHomeLocationTracking({
    currentUser,
    isOnline,
    activeJobId: activeJob?.id,
    updateDriverHeartbeat,
    updateDriverLocation,
  });
  const isDriverGeoRestricted = resolveDriverGeoRestriction({
    hasResolvedDriverLocationState,
    driverLocationStateCode,
    supportedStateCodes: SUPPORTED_ORDER_STATE_CODES,
    isSupportedStateCode: isSupportedOrderStateCode,
  });
  const activeJobStatus = useMemo(
    () => normalizeTripStatus(activeJob?.status),
    [activeJob?.status]
  );
  const isPickupNavigationStage = useMemo(
    () => PICKUP_PHASE_STATUSES.includes(activeJobStatus),
    [activeJobStatus]
  );
  const isDropoffNavigationStage = useMemo(
    () => DROPOFF_PHASE_STATUSES.includes(activeJobStatus),
    [activeJobStatus]
  );
  const pickupLocation = useMemo(() => parseTripPoint(activeJob, 'pickup'), [activeJob]);
  const dropoffLocation = useMemo(() => parseTripPoint(activeJob, 'dropoff'), [activeJob]);
  const navigationOrigin = useMemo(
    () => driverLocation || parseTripDriverLocation(activeJob),
    [activeJob, driverLocation]
  );
  const navigationDestination = useMemo(() => {
    if (!hasActiveTrip) {
      return null;
    }
    if (isDropoffNavigationStage) {
      return dropoffLocation;
    }
    if (isPickupNavigationStage) {
      return pickupLocation;
    }
    return null;
  }, [
    dropoffLocation,
    hasActiveTrip,
    isDropoffNavigationStage,
    isPickupNavigationStage,
    pickupLocation,
  ]);
  const activeNavigationStage = isDropoffNavigationStage ? 'dropoff' : 'pickup';
  const isFutureScheduledActiveJob = useMemo(
    () => isFutureScheduledTrip(activeJob),
    [activeJob]
  );
  const activeTripNavigationOptions = useMemo(() => {
    if (!hasActiveTrip) {
      return {};
    }
    return {
      simulate: appConfig.navigation.mapboxSimulationEnabled,
      allowSystemCancel: true,
      actionCard: {
        enabled: false,
      },
    };
  }, [
    hasActiveTrip,
  ]);
  const pickupProgressSyncInFlightRef = useRef(false);
  const destinationHydrationInFlightRef = useRef(false);
  const destinationHydrationAttemptRef = useRef(null);
  const {
    startNavigation,
    stopNavigation,
    isNavigating,
  } = useMapboxNavigation({
    origin: navigationOrigin,
    destination: navigationDestination,
    navigationOptions: activeTripNavigationOptions,
    onRouteProgress: (progress) => {
      const progressLocation = parseCoordinates(progress?.location || progress?.rawLocation);
      if (progressLocation) {
        setDriverLocation((previousLocation) => {
          if (previousLocation) {
            const distanceMeters = getDistanceFromLatLonInKm(
              previousLocation.latitude,
              previousLocation.longitude,
              progressLocation.latitude,
              progressLocation.longitude
            ) * 1000;
            if (Number.isFinite(distanceMeters) && distanceMeters < MIN_ROUTE_PROGRESS_LOCATION_DELTA_METERS) {
              return previousLocation;
            }
          }

          return {
            latitude: progressLocation.latitude,
            longitude: progressLocation.longitude,
            stateCode: previousLocation?.stateCode || null,
          };
        });
      }

      if (Number.isFinite(progress?.distanceRemaining)) {
        logger.info('DriverHomeScreen', 'Native navigation progress', {
          requestId: activeJob?.id,
          stage: activeNavigationStage,
          distanceRemainingMeters: progress.distanceRemaining,
          distanceRemainingText: formatDistance(progress.distanceRemaining),
        });
      }
    },
    onArrival: (payload) => {
      logger.info('DriverHomeScreen', 'Native navigation arrived at destination', {
        requestId: activeJob?.id,
        stage: activeNavigationStage,
        payload: payload || null,
      });
    },
    onCancel: (payload) => {
      logger.info('DriverHomeScreen', 'Native navigation cancelled by user', payload || {});
    },
  });
  const stopNativeNavigationSilently = useCallback(async () => {
    await stopNavigation({ showAlert: false });
  }, [stopNavigation]);
  const activeTripArrivalUnlockDistanceMeters = (
    activeNavigationStage === 'dropoff'
      ? DROPOFF_ARRIVAL_UNLOCK_RADIUS_METERS
      : ARRIVAL_UNLOCK_RADIUS_METERS
  );
  const activeTripDistanceToDestinationMeters = useMemo(() => {
    if (!driverLocation || !navigationDestination) {
      return null;
    }

    const distanceKm = getDistanceFromLatLonInKm(
      driverLocation.latitude,
      driverLocation.longitude,
      navigationDestination.latitude,
      navigationDestination.longitude
    );
    const distanceMeters = distanceKm * 1000;
    return Number.isFinite(distanceMeters) ? distanceMeters : null;
  }, [driverLocation, navigationDestination]);
  const isArriveActionEnabled = useMemo(() => {
    if (!hasActiveTrip || !driverLocation || !navigationDestination) {
      return false;
    }

    if (!Number.isFinite(activeTripDistanceToDestinationMeters)) {
      return false;
    }

    return activeTripDistanceToDestinationMeters <= activeTripArrivalUnlockDistanceMeters;
  }, [
    activeTripArrivalUnlockDistanceMeters,
    activeTripDistanceToDestinationMeters,
    driverLocation,
    hasActiveTrip,
    navigationDestination,
  ]);
  const arriveActionLabel = (
    activeNavigationStage === 'dropoff'
      ? "I've Arrived at Dropoff"
      : "I've Arrived"
  );
  const arriveActionHint = useMemo(() => {
    if (!hasActiveTrip) {
      return '';
    }

    if (!Number.isFinite(activeTripDistanceToDestinationMeters)) {
      return 'Waiting for live location to enable arrival.';
    }

    if (isArriveActionEnabled) {
      return `You are ${formatDistance(activeTripDistanceToDestinationMeters)} away from the stop.`;
    }

    return (
      `Arrival unlocks within ${formatDistance(activeTripArrivalUnlockDistanceMeters)} `
      + `(currently ${formatDistance(activeTripDistanceToDestinationMeters)} away).`
    );
  }, [
    activeTripArrivalUnlockDistanceMeters,
    activeTripDistanceToDestinationMeters,
    hasActiveTrip,
    isArriveActionEnabled,
  ]);
  const openNativeNavigationFromHome = useCallback((trip) => {
    const openNavigation = async () => {
      const mergedCandidateTrip = mergeTripForNavigation({
        previousTrip: activeJob,
        updatedTrip: trip,
        fallbackDriverLocation: navigationOrigin || driverLocation || null,
      });

      if (!mergedCandidateTrip?.id) {
        return false;
      }

      const preferredNavigationStage = activeNavigationStage === 'dropoff' ? 'dropoff' : 'pickup';

      let resolvedTrip = mergedCandidateTrip;
      let resolvedOrigin = (
        parseTripDriverLocation(mergedCandidateTrip)
        || navigationOrigin
        || driverLocation
        || null
      );
      let { stage: resolvedNavigationStage, destination: resolvedDestination } = resolveTripDestinationByStage(
        mergedCandidateTrip,
        preferredNavigationStage
      );

      if (!resolvedDestination && typeof getRequestById === 'function') {
        for (let attempt = 0; attempt < NAVIGATION_DESTINATION_HYDRATION_ATTEMPTS; attempt += 1) {
          try {
            const refreshedTrip = await getRequestById(mergedCandidateTrip.id);
            if (refreshedTrip?.id === mergedCandidateTrip.id) {
              resolvedTrip = mergeTripForNavigation({
                previousTrip: resolvedTrip,
                updatedTrip: refreshedTrip,
                fallbackDriverLocation: resolvedOrigin,
              });
              resolvedOrigin = resolvedOrigin || parseTripDriverLocation(resolvedTrip);
              const resolvedStageResult = resolveTripDestinationByStage(
                resolvedTrip,
                preferredNavigationStage
              );
              resolvedNavigationStage = resolvedStageResult.stage;
              resolvedDestination = resolvedStageResult.destination;
              if (resolvedDestination) {
                break;
              }
            }
          } catch (error) {
            logger.warn('DriverHomeScreen', 'Failed to refresh trip before opening navigation', {
              requestId: mergedCandidateTrip.id,
              stage: preferredNavigationStage,
              attempt: attempt + 1,
              error,
            });
          }

          if (attempt < NAVIGATION_DESTINATION_HYDRATION_ATTEMPTS - 1) {
            await wait(NAVIGATION_DESTINATION_HYDRATION_DELAY_MS);
          }
        }
      }

      if (!resolvedOrigin || !resolvedDestination) {
        if (resolvedNavigationStage === 'dropoff') {
          const pickupToDropoffFallbackRoute = resolvePickupToDropoffFallbackRoute(resolvedTrip);
          if (pickupToDropoffFallbackRoute) {
            resolvedOrigin = resolvedOrigin || pickupToDropoffFallbackRoute.origin;
            resolvedDestination = resolvedDestination || pickupToDropoffFallbackRoute.destination;
            logger.warn('DriverHomeScreen', 'Using pickup-to-dropoff fallback route for native navigation', {
              requestId: resolvedTrip?.id || mergedCandidateTrip.id,
              preferredStage: preferredNavigationStage,
            });
          }
        }
      }

      if (!resolvedOrigin || !resolvedDestination) {
        logger.warn('DriverHomeScreen', 'Cannot open navigation because route coordinates are missing', {
          requestId: resolvedTrip?.id || mergedCandidateTrip.id,
          stage: resolvedNavigationStage,
          preferredStage: preferredNavigationStage,
          hasOrigin: Boolean(resolvedOrigin),
          hasDestination: Boolean(resolvedDestination),
        });
        Alert.alert(
          'Navigation Error',
          'Route is still loading. Please try again in a moment.'
        );
        return false;
      }

      setAcceptedRequestId(resolvedTrip.id);
      setActiveJob((previousTrip) => mergeTripForNavigation({
        previousTrip,
        updatedTrip: resolvedTrip,
        fallbackDriverLocation: resolvedOrigin,
      }));

      return startNavigation({
        showAlert: true,
        origin: resolvedOrigin,
        destination: resolvedDestination,
      });
    };

    void openNavigation();
    return true;
  }, [activeJob, activeNavigationStage, driverLocation, getRequestById, navigationOrigin, startNavigation]);
  const handleArriveAtStopFromHome = useCallback(async () => {
    if (!activeJob?.id || isArriveActionLoading) {
      return;
    }

    if (!isArriveActionEnabled) {
      Alert.alert(
        'Too far from stop',
        'Move closer to the stop and try again.'
      );
      return;
    }

    setIsArriveActionLoading(true);
    try {
      const requestId = activeJob.id;
      const currentLocation = navigationOrigin || driverLocation || parseTripDriverLocation(activeJob);

      if (activeNavigationStage === 'dropoff') {
        const updatedTrip = await arriveAtDropoff(requestId, currentLocation);
        const resolvedDropoffTrip = mergeTripForNavigation({
          previousTrip: activeJob,
          updatedTrip,
          fallbackStatus: TRIP_STATUS.ARRIVED_AT_DROPOFF,
          fallbackDriverLocation: currentLocation,
        });
        setActiveJob(resolvedDropoffTrip);
        navigation.navigate('DeliveryConfirmationScreen', {
          request: resolvedDropoffTrip,
          pickupPhotos: resolvedDropoffTrip?.pickupPhotos || resolvedDropoffTrip?.pickup_photos || [],
          driverLocation: currentLocation,
        });
        return;
      }

      const updatedTrip = await arriveAtPickup(requestId, currentLocation);
      const resolvedPickupTrip = mergeTripForNavigation({
        previousTrip: activeJob,
        updatedTrip,
        fallbackStatus: TRIP_STATUS.ARRIVED_AT_PICKUP,
        fallbackDriverLocation: currentLocation,
      });
      setActiveJob(resolvedPickupTrip);
      navigation.navigate('PickupConfirmationScreen', {
        request: resolvedPickupTrip,
        driverLocation: currentLocation,
      });
    } catch (error) {
      logger.error('DriverHomeScreen', 'Failed to mark arrival from home controls', error);
      Alert.alert('Action Failed', 'Could not update trip status. Please try again.');
    } finally {
      setIsArriveActionLoading(false);
    }
  }, [
    activeJob,
    activeNavigationStage,
    arriveAtDropoff,
    arriveAtPickup,
    driverLocation,
    isArriveActionEnabled,
    isArriveActionLoading,
    navigation,
    navigationOrigin,
  ]);
  useEffect(() => {
    if (!hasActiveTrip || !activeJob?.id) {
      destinationHydrationAttemptRef.current = null;
      return;
    }

    const needsPickupDestination = isPickupNavigationStage && !pickupLocation;
    const needsDropoffDestination = isDropoffNavigationStage && !dropoffLocation;
    if (!needsPickupDestination && !needsDropoffDestination) {
      destinationHydrationAttemptRef.current = null;
      return;
    }

    const stageKey = needsDropoffDestination ? 'dropoff' : 'pickup';
    const hydrationKey = `${activeJob.id}:${stageKey}`;
    if (destinationHydrationInFlightRef.current || destinationHydrationAttemptRef.current === hydrationKey) {
      return;
    }

    destinationHydrationAttemptRef.current = hydrationKey;
    destinationHydrationInFlightRef.current = true;

    let isDisposed = false;
    const hydrateMissingDestination = async () => {
      try {
        const refreshedTrip = await getRequestById(activeJob.id);
        if (isDisposed || !refreshedTrip?.id || refreshedTrip.id !== activeJob.id) {
          return;
        }

        setActiveJob((previousTrip) => {
          if (!previousTrip || previousTrip.id !== refreshedTrip.id) {
            return previousTrip;
          }
          return mergeTripForNavigation({
            previousTrip,
            updatedTrip: refreshedTrip,
          });
        });
      } catch (error) {
        logger.warn('DriverHomeScreen', 'Failed to hydrate trip destination for navigation', {
          requestId: activeJob.id,
          stage: stageKey,
          error,
        });
      } finally {
        destinationHydrationInFlightRef.current = false;
      }
    };

    void hydrateMissingDestination();

    return () => {
      isDisposed = true;
    };
  }, [
    activeJob?.id,
    dropoffLocation,
    getRequestById,
    hasActiveTrip,
    isDropoffNavigationStage,
    isPickupNavigationStage,
    pickupLocation,
  ]);
  useEffect(() => {
    const activeRequestId = activeJob?.id || null;
    if (!activeRequestId || !isPickupNavigationStage) {
      return;
    }

    if (activeJobStatus !== TRIP_STATUS.ACCEPTED || isFutureScheduledActiveJob) {
      return;
    }

    let isDisposed = false;
    const syncTripInProgress = async () => {
      if (isDisposed || pickupProgressSyncInFlightRef.current) {
        return;
      }

      pickupProgressSyncInFlightRef.current = true;
      try {
        const currentLocation = navigationOrigin || driverLocation || null;
        const updatedTrip = await startDriving(activeRequestId, currentLocation || null);
        if (isDisposed || !updatedTrip?.id) {
          return;
        }

        setActiveJob((previousTrip) => {
          if (!previousTrip || previousTrip.id !== updatedTrip.id) {
            return previousTrip;
          }
          return mergeTripForNavigation({
            previousTrip,
            updatedTrip,
            fallbackStatus: TRIP_STATUS.IN_PROGRESS,
            fallbackDriverLocation: currentLocation || null,
          });
        });
      } catch (error) {
        logger.warn('DriverHomeScreen', 'Failed to mark accepted trip as in progress', error);
      } finally {
        pickupProgressSyncInFlightRef.current = false;
      }
    };

    void syncTripInProgress();
    const retryTimer = setInterval(() => {
      void syncTripInProgress();
    }, 4000);

    return () => {
      isDisposed = true;
      clearInterval(retryTimer);
      pickupProgressSyncInFlightRef.current = false;
    };
  }, [
    activeJob?.id,
    activeJobStatus,
    driverLocation,
    isFutureScheduledActiveJob,
    isPickupNavigationStage,
    navigationOrigin,
    startDriving,
  ]);
  useEffect(() => {
    const activatedTripFromRoute = route?.params?.activatedTrip;
    if (!activatedTripFromRoute || typeof activatedTripFromRoute !== 'object') {
      return;
    }

    const activatedTripId = String(
      activatedTripFromRoute.id ||
      activatedTripFromRoute.requestId ||
      activatedTripFromRoute.originalData?.id ||
      ''
    ).trim();
    if (!activatedTripId) {
      return;
    }

    setAcceptedRequestId(activatedTripId);
    setActiveJob((previousTrip) => {
      if (!previousTrip || previousTrip.id !== activatedTripId) {
        return activatedTripFromRoute;
      }
      return mergeTripForNavigation({
        previousTrip,
        updatedTrip: activatedTripFromRoute,
      });
    });

    if (typeof navigation?.setParams === 'function') {
      navigation.setParams({
        activatedTrip: undefined,
      });
    }
  }, [navigation, route?.params?.activatedTrip]);

  const {
    incomingRoute,
    incomingMarkers,
    clearIncomingRoute,
  } = useIncomingRequestRoute({
    incomingRequest,
    showIncomingModal,
    isMinimized,
    mapboxToken: appConfig.mapbox.publicToken,
  });

  const {
    requestTimeRemaining,
    requestTimerTotal,
  } = useRequestOfferTimer({
    incomingRequest,
    offerTimeoutRef: handleOfferTimeoutRef,
  });

  const {
    availableRequests,
    setAvailableRequests,
    loading,
    setLoading,
    error,
    loadRequests,
  } = useDriverRequestsFeed({
    activeRequestPool,
    checkExpiredRequests,
    clearIncomingRoute,
    driverLocation,
    getAvailableRequests,
    hasActiveTrip,
    isOnline,
    shouldSuppressRequest,
    setIncomingRequest,
    setIsMinimized,
    setShowAllRequests,
    setShowIncomingModal,
  });
  const handleCancelActiveTripFromHome = useCallback(() => {
    if (!activeJob?.id || activeNavigationStage !== 'pickup' || isCancelActiveTripLoading) {
      return;
    }

    Alert.alert(
      'Cancel trip?',
      'This will cancel the trip for both you and the customer.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'Cancel trip',
          style: 'destructive',
          onPress: async () => {
            if (!activeJob?.id) {
              return;
            }

            setIsCancelActiveTripLoading(true);
            try {
              const result = await cancelOrder(activeJob.id, 'driver_request');
              if (!result?.success) {
                throw new Error(result?.error || 'Please try again in a moment.');
              }

              await stopNativeNavigationSilently();
              setAcceptedRequestId(null);
              setActiveJob(null);
              void loadRequests(false);
            } catch (error) {
              logger.error('DriverHomeScreen', 'Unable to cancel active trip from home controls', error);
              Alert.alert('Unable to cancel', error?.message || 'Please try again in a moment.');
            } finally {
              setIsCancelActiveTripLoading(false);
            }
          },
        },
      ]
    );
  }, [
    activeJob?.id,
    activeNavigationStage,
    cancelOrder,
    isCancelActiveTripLoading,
    loadRequests,
    stopNativeNavigationSilently,
  ]);
  const {
    acceptedScheduledRequests,
    acceptedScheduledLoading,
    acceptedScheduledError,
    appendAcceptedScheduledRequest,
    refreshAcceptedScheduledRequests,
  } = useAcceptedScheduledRequests({
    currentUserId,
    getUserPickupRequests,
    getUserProfile,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    isOnline,
    hasActiveTrip,
    setAcceptedRequestId,
    setActiveJob,
    setShowRequestModal,
    setShowAllRequests,
    setRequestModalMode,
    onTripActivated: (trip) => {
      if (!trip?.id) {
        return;
      }
      setAcceptedRequestId(trip.id);
      setActiveJob(trip);
    },
  });

  const requestModalRequests = requestModalMode === 'accepted'
    ? acceptedScheduledRequests
    : availableRequests;
  const requestModalLoading = requestModalMode === 'accepted'
    ? acceptedScheduledLoading
    : loading;
  const requestModalError = requestModalMode === 'accepted'
    ? acceptedScheduledError
    : error;
  const {
    activeJobDestinationAddress,
    activeJobSecondaryLabel,
    activeJobStatusLabel,
    isScheduledPoolActive,
    onlineDriverMarkerCoordinate,
    onlineDriverPulseOpacity,
    onlineDriverPulseSize,
    openActiveTrip,
    progressValue,
    shouldShowOnlineDriverMarker,
    waitTime,
  } = useDriverHomePresentation({
    acceptedRequestId,
    activeJob,
    activeRequestPool,
    driverLocation,
    hasActiveTrip,
    isOnline,
    navigation,
    onOpenNativeNavigation: openNativeNavigationFromHome,
    reopenRequestModalModeRef,
    reopenRequestModalOnFocusRef,
    route,
    setSelectedRequest,
    setShowAllRequests,
    setShowRequestModal,
  });

  const { isRestoringActiveTrip } = useDriverActiveTripRestore({
    currentUserId,
    userType,
    getUserPickupRequests,
    clearIncomingRoute,
    setAcceptedRequestId,
    setActiveJob,
    setIncomingRequest,
    setShowIncomingModal,
    setIsMinimized,
    setAvailableRequests,
    setIsOnline,
  });

  // Monitor order status for accepted requests
  useOrderStatusMonitor(acceptedRequestId, navigation, {
    currentScreen: 'DriverHomeScreen',
    enabled: !!acceptedRequestId,
    onCancel: () => {
      // Reset state when order is cancelled
      setAcceptedRequestId(null);
      setActiveJob(null);
      void stopNativeNavigationSilently();
      // Reload requests to refresh the list
      loadRequests(false);
    }
  });

  useEffect(() => {
    const normalizedIncomingRequestId = String(incomingRequest?.id || '').trim();
    incomingRequestIdRef.current = normalizedIncomingRequestId || null;
  }, [incomingRequest?.id]);

  useDriverRequestPoolRealtime({
    currentUserId,
    isOnline,
    hasActiveTrip,
    incomingRequestIdRef,
    setAvailableRequests,
    setSelectedRequest,
    setShowIncomingModal,
    setIsMinimized,
    setIncomingRequest,
    isDriverGeoRestricted,
  });

  const {
    handleGoOnline,
    handleGoOnlineScheduled,
    handleGoOffline,
  } = useDriverAvailabilityActions({
    currentUser,
    currentUserId,
    navigation,
    isOnline,
    hasActiveTrip,
    activeJob,
    activeRequestPool,
    openActiveTrip,
    loadRequests,
    setLoading,
    setDriverOnline,
    setDriverOffline,
    setDriverLocation,
    setActiveRequestPool,
    setShowRequestModal,
    setShowAllRequests,
    setSelectedRequest,
    setIsOnline,
    setShowIncomingModal,
    setIsMinimized,
    setIncomingRequest,
    isDriverGeoRestricted,
  });

  const {
    handleAcceptRequest,
    handleCloseRequestModal,
    handleMessageCustomer,
    handleRequestMarkerPress,
    handleViewRequestDetails,
  } = useDriverHomeRequestActions({
    acceptRequest,
    appendAcceptedScheduledRequest,
    clearIncomingRoute,
    driverLocation,
    isAcceptingRequestRef,
    loadRequests,
    navigation,
    onTripAccepted: (trip) => {
      if (!trip?.id) {
        return;
      }
      setAcceptedRequestId(trip.id);
      setActiveJob(trip);
    },
    refreshAcceptedScheduledRequests,
    reopenRequestModalModeRef,
    reopenRequestModalOnFocusRef,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setSelectedRequest,
    setShowAllRequests,
    setShowIncomingModal,
    setShowRequestModal,
    setRequestModalMode,
    startDriving,
    showRequestModal,
  });

  const {
    miniBarPulse,
    handleIncomingRequestAccept,
    handleIncomingRequestDecline,
    handleIncomingRequestMinimize,
    handleIncomingSnapChange,
    handleExpandFromMiniBar,
  } = useDriverIncomingRequestHandlers({
    acceptRequest,
    activeRequestPool,
    availableRequests,
    cameraRef,
    clearIncomingRoute,
    declineRequestOffer,
    handleOfferTimeoutRef,
    hasActiveTrip,
    incomingMarkers,
    incomingRequest,
    isAcceptingRequestRef,
    isMinimized,
    isOnline,
    isScheduledPoolActive,
    loadRequests,
    markRequestHandled,
    onTripAccepted: (trip) => {
      if (!trip?.id) {
        return;
      }
      setAcceptedRequestId(trip.id);
      setActiveJob(trip);
    },
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
    startDriving,
    showIncomingModal,
  });

  const handleOpenOnboarding = React.useCallback(async () => {
    const destination = await resolveDriverOnboardingDestination({
      currentUser,
      currentUserId,
      getDriverProfile,
    });
    navigation.navigate(destination.screen, destination.params);
  }, [currentUser, currentUserId, getDriverProfile, navigation]);

  const contentProps = buildDriverHomeContentProps({
    styles, region, tabBarHeight, shouldShowOnlineDriverMarker, onlineDriverMarkerCoordinate,
    onlineDriverPulseOpacity, onlineDriverPulseSize, isOnline, hasActiveTrip, showIncomingModal,
    isMinimized, availableRequests, selectedRequest, incomingRoute, incomingMarkers, mapRef,
    cameraRef, isRestoringActiveTrip, activeJob, activeJobStatusLabel,
    activeJobDestinationAddress, activeJobSecondaryLabel, isScheduledPoolActive, waitTime,
    progressValue, incomingRequest, requestTimeRemaining, miniBarPulse, formatRequestTime,
    requestModalMode, requestModalRequests,
    driverLocation, loading: requestModalLoading, error: requestModalError, requestTimerTotal, navigation,
    activeTripOriginLocation: navigationOrigin,
    activeTripDestinationLocation: navigationDestination,
    activeTripPickupLocation: pickupLocation,
    activeTripDropoffLocation: dropoffLocation,
    isNavigationActiveInBackground: Boolean(hasActiveTrip && isNavigating),
    insetsTop: insets.top,
    onRequestMarkerPress: handleRequestMarkerPress,
    onOpenNavigator: () => openActiveTrip(activeJob),
    onArriveAtStop: handleArriveAtStopFromHome,
    arriveActionLabel,
    isArriveActionEnabled,
    isArriveActionLoading,
    arriveActionHint,
    onCancelActiveTrip: handleCancelActiveTripFromHome,
    showCancelActiveTripAction: activeNavigationStage === 'pickup',
    isCancelActiveTripLoading,
    onGoOffline: handleGoOffline,
    onGoOnline: handleGoOnline,
    onGoOnlineScheduled: handleGoOnlineScheduled,
    onViewScheduledRequests: () => {
      setRequestModalMode('scheduled');
      setShowAllRequests(true);
    },
    onViewAcceptedRequests: () => {
      setRequestModalMode('accepted');
      setShowAllRequests(true);
      void refreshAcceptedScheduledRequests({ silent: false });
    },
    onExpandMiniBar: handleExpandFromMiniBar,
    requestModalVisible: showRequestModal || showAllRequests,
    onCloseRequestModal: handleCloseRequestModal,
    onAcceptRequest: handleAcceptRequest,
    onViewRequestDetails: handleViewRequestDetails,
    onMessageCustomer: handleMessageCustomer,
    onRefreshRequests: () => (
      requestModalMode === 'accepted'
        ? refreshAcceptedScheduledRequests({ silent: false })
        : loadRequests()
    ),
    onIncomingRequestAccept: handleIncomingRequestAccept,
    onIncomingRequestDecline: handleIncomingRequestDecline,
    onIncomingRequestMinimize: handleIncomingRequestMinimize,
    onIncomingSnapChange: handleIncomingSnapChange,
    onDashboardExpandedChange: setDashboardExpanded,
    showOnboardingRequiredBanner,
    onOpenOnboarding: handleOpenOnboarding,
    isAvailabilityLocked,
    isDriverGeoRestricted,
    driverAvailabilityComingSoonTitle: DRIVER_AVAILABILITY_COMING_SOON_TITLE,
    driverAvailabilityComingSoonMessage: DRIVER_AVAILABILITY_COMING_SOON_MESSAGE,
  });

  return <DriverHomeScreenContent {...contentProps} />;
}
