import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useAuthIdentity,
  useDriverActions,
  useMessagingActions,
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
import useDriverTripChat from '../../hooks/useDriverTripChat';
import useTripConversationUnread from '../../hooks/useTripConversationUnread';
import useAutoMapboxNavigationStart from '../../hooks/useAutoMapboxNavigationStart';
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
import { resolveRequestCustomerId } from './requestConversationContext.utils';

const parseTripPoint = (trip, pointName) => {
  if (!trip || typeof trip !== 'object') {
    return null;
  }

  const points = pointName === 'pickup'
    ? [
      trip?.pickup?.coordinates,
      trip?.pickupCoordinates,
      trip?.pickup_location?.coordinates,
      trip?.pickup_location,
      trip?.originalData?.pickup?.coordinates,
      trip?.originalData?.pickupCoordinates,
      trip?.originalData?.pickup_location?.coordinates,
      trip?.originalData?.pickup_location,
    ]
    : [
      trip?.dropoff?.coordinates,
      trip?.dropoffCoordinates,
      trip?.dropoff_location?.coordinates,
      trip?.dropoff_location,
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
      ? (trip?.pickupLat ?? trip?.pickup_lat)
      : (trip?.dropoffLat ?? trip?.dropoff_lat)
  );
  const longitude = Number(
    pointName === 'pickup'
      ? (trip?.pickupLng ?? trip?.pickup_lon ?? trip?.pickup_lng)
      : (trip?.dropoffLng ?? trip?.dropoff_lon ?? trip?.dropoff_lng)
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

export default function DriverHomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;
  const tabBarHeight = useBottomTabBarHeight();
  const { userType, currentUser, refreshProfile } = useAuthIdentity();
  const {
    createConversation,
    getConversations,
    subscribeToConversations,
  } = useMessagingActions();
  const { getUserProfile } = useProfileActions();
  const {
    getUserPickupRequests,
    getAvailableRequests,
    declineRequestOffer,
    acceptRequest,
    startDriving,
    arriveAtPickup,
    arriveAtDropoff,
    checkExpiredRequests,
    cancelOrder,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    getRequestById,
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

  // Phone verification modal
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);

  // Offline dashboard expansion state
  const [, setDashboardExpanded] = useState(false);

  // Route for incoming request (Mapbox Directions)
  const cameraRef = useRef(null);

  // Minimize + timer state for incoming request
  const [isMinimized, setIsMinimized] = useState(false);
  const handleOfferTimeoutRef = useRef(null);
  const isAcceptingRequestRef = useRef(false);
  const incomingRequestIdRef = useRef(null);
  const reopenRequestModalOnFocusRef = useRef(false);
  const reopenRequestModalModeRef = useRef('all');
  const resumeNativeNavigationOnFocusRef = useRef(false);
  const nativeActionInFlightRef = useRef(false);
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const hasActiveTrip = Boolean(acceptedRequestId && activeJob?.id);

  const mapRef = useRef(null);
  const { showOnboardingRequiredBanner } = resolveDriverOnboardingUiState(currentUser);
  const {
    driverLocation,
    driverLocationStateCode,
    hasResolvedDriverLocationState,
    region,
    setDriverLocation,
  } = useDriverHomeLocationTracking({
    currentUser,
    isOnline,
    hasActiveTrip,
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
  const activeRequestCustomerId = useMemo(
    () => resolveRequestCustomerId({ requestData: activeJob, routeRequest: activeJob }),
    [activeJob]
  );
  const {
    hasUnreadChat: hasUnreadActiveTripChat,
    setHasUnreadChat: setHasUnreadActiveTripChat,
  } = useTripConversationUnread({
    currentUserId,
    getConversations,
    subscribeToConversations,
    conversationUserType: 'driver',
    activeRequestId: activeJob?.id || null,
    activeRequestCustomerId,
    activeRequestDriverId: currentUserId,
  });
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
  const pickupAddressLabel = useMemo(
    () => resolveTripAddress(activeJob, 'pickup') || 'Pickup location',
    [activeJob]
  );
  const dropoffAddressLabel = useMemo(
    () => resolveTripAddress(activeJob, 'dropoff') || 'Dropoff location',
    [activeJob]
  );
  const activeNavigationStage = isDropoffNavigationStage ? 'dropoff' : 'pickup';
  const isFutureScheduledActiveJob = useMemo(
    () => isFutureScheduledTrip(activeJob),
    [activeJob]
  );
  const shouldUseNativeNavigator = Boolean(
    hasActiveTrip &&
    navigationOrigin &&
    navigationDestination &&
    (isPickupNavigationStage || isDropoffNavigationStage)
  );
  const activeTripNavigationOptions = useMemo(() => {
    if (!hasActiveTrip) {
      return {};
    }

    if (activeNavigationStage === 'dropoff') {
      return {
        simulate: appConfig.navigation.mapboxSimulationEnabled,
        allowSystemCancel: false,
        actionCard: {
          enabled: true,
          title: 'Dropoff Location',
          subtitle: dropoffAddressLabel,
          primaryActionLabel: "I've Arrived at Dropoff",
          chatActionLabel: hasUnreadActiveTripChat ? 'Chat •' : 'Chat',
          chatHasUnread: hasUnreadActiveTripChat,
          unlockDistanceMeters: DROPOFF_ARRIVAL_UNLOCK_RADIUS_METERS,
          payload: {
            stage: 'dropoff',
            requestId: activeJob?.id || null,
          },
        },
      };
    }

    return {
      simulate: appConfig.navigation.mapboxSimulationEnabled,
      allowSystemCancel: false,
      actionCard: {
        enabled: true,
        title: 'Pickup Location',
        subtitle: pickupAddressLabel,
        primaryActionLabel: "I've Arrived",
        chatActionLabel: hasUnreadActiveTripChat ? 'Chat •' : 'Chat',
        chatHasUnread: hasUnreadActiveTripChat,
        secondaryActionLabel: 'Cancel Trip',
        unlockDistanceMeters: ARRIVAL_UNLOCK_RADIUS_METERS,
        payload: {
          stage: 'pickup',
          requestId: activeJob?.id || null,
        },
      },
    };
  }, [
    activeJob,
    activeNavigationStage,
    dropoffAddressLabel,
    hasUnreadActiveTripChat,
    hasActiveTrip,
    pickupAddressLabel,
  ]);
  const { openChat } = useDriverTripChat({
    requestData: activeJob,
    routeRequest: activeJob,
    getRequestById,
    getUserProfile,
    currentUserId,
    createConversation,
    navigation,
    clearUnread: () => setHasUnreadActiveTripChat(false),
    errorMessage: 'Could not open chat right now. Please try again.',
  });
  const primaryActionRef = useRef(async () => {});
  const secondaryActionRef = useRef(async () => {});
  const chatActionRef = useRef(async () => {});
  const cancelActionRef = useRef(async () => {});
  const nativeCancellationInFlightRef = useRef(false);
  const handledStageTransitionKeyRef = useRef(null);
  const pickupProgressSyncInFlightRef = useRef(false);
  const {
    startNavigation,
    stopNavigation,
    updateNavigationOptions,
    isNavigating,
    isSupported: isNativeNavigationSupported,
  } = useMapboxNavigation({
    origin: navigationOrigin,
    destination: navigationDestination,
    navigationOptions: activeTripNavigationOptions,
    onRouteProgress: (progress) => {
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
    onPrimaryAction: () => {
      void primaryActionRef.current();
    },
    onSecondaryAction: (payload) => {
      void secondaryActionRef.current(payload);
    },
    onChatAction: () => {
      void chatActionRef.current();
    },
    onCancel: (payload) => {
      logger.info('DriverHomeScreen', 'Native navigation cancelled by user', payload || {});
      void cancelActionRef.current(payload);
    },
  });
  const stopNativeNavigationSilently = useCallback(async () => {
    await stopNavigation({ showAlert: false });
  }, [stopNavigation]);
  const cancelActiveTrip = useCallback(async (requestId) => {
    if (!requestId) {
      return;
    }

    if (nativeCancellationInFlightRef.current) {
      return;
    }
    nativeCancellationInFlightRef.current = true;

    try {
      await stopNativeNavigationSilently();
    } catch (stopError) {
      logger.warn('DriverHomeScreen', 'Failed to stop native navigation before cancellation', stopError);
    }

    try {
      const result = await cancelOrder(requestId, 'driver_request');
      if (!result?.success) {
        throw new Error(result?.error || 'Please try again in a moment.');
      }

      setAcceptedRequestId(null);
      setActiveJob(null);
    } catch (error) {
      logger.error('DriverHomeScreen', 'Unable to cancel active trip from native action', error);
      Alert.alert('Unable to cancel', error?.message || 'Please try again in a moment.');
    } finally {
      nativeCancellationInFlightRef.current = false;
    }
  }, [cancelOrder, stopNativeNavigationSilently]);
  const handleNativePrimaryAction = useCallback(async () => {
    if (nativeActionInFlightRef.current || !activeJob?.id) {
      return;
    }

    const transitionKey = `${activeJob.id}:${activeNavigationStage}`;
    if (handledStageTransitionKeyRef.current === transitionKey) {
      return;
    }

    nativeActionInFlightRef.current = true;
    try {
      const requestId = activeJob.id;
      const currentLocation = navigationOrigin || driverLocation || parseTripDriverLocation(activeJob);

      if (activeNavigationStage === 'dropoff') {
        const updatedTrip = await arriveAtDropoff(requestId, currentLocation);
        const resolvedDropoffTrip = updatedTrip || {
          ...(activeJob || {}),
          status: TRIP_STATUS.ARRIVED_AT_DROPOFF,
        };
        handledStageTransitionKeyRef.current = transitionKey;
        setActiveJob(updatedTrip || {
          ...(activeJob || {}),
          status: TRIP_STATUS.ARRIVED_AT_DROPOFF,
        });
        await stopNativeNavigationSilently();
        navigation.navigate('DeliveryConfirmationScreen', {
          request: resolvedDropoffTrip,
          pickupPhotos: resolvedDropoffTrip?.pickupPhotos || resolvedDropoffTrip?.pickup_photos || [],
          driverLocation: currentLocation,
        });
        return;
      }

      const updatedTrip = await arriveAtPickup(requestId, currentLocation);
      const resolvedPickupTrip = updatedTrip || {
        ...(activeJob || {}),
        status: TRIP_STATUS.ARRIVED_AT_PICKUP,
      };
      handledStageTransitionKeyRef.current = transitionKey;
      setActiveJob(updatedTrip || {
        ...(activeJob || {}),
        status: TRIP_STATUS.ARRIVED_AT_PICKUP,
      });
      await stopNativeNavigationSilently();
      navigation.navigate('PickupConfirmationScreen', {
        request: resolvedPickupTrip,
        driverLocation: currentLocation,
      });
    } catch (error) {
      logger.error('DriverHomeScreen', 'Failed to handle native primary action', error);
      Alert.alert('Error', 'Could not complete this action. Please try again.');
    } finally {
      nativeActionInFlightRef.current = false;
    }
  }, [
    activeJob,
    activeNavigationStage,
    arriveAtDropoff,
    arriveAtPickup,
    driverLocation,
    navigation,
    navigationOrigin,
    stopNativeNavigationSilently,
  ]);
  const handleNativeSecondaryAction = useCallback((payload) => {
    if (activeNavigationStage !== 'pickup' || !activeJob?.id) {
      return;
    }

    if (payload && payload.confirmed === false) {
      return;
    }

    void cancelActiveTrip(activeJob.id);
  }, [activeJob?.id, activeNavigationStage, cancelActiveTrip]);
  const handleNativeCancelEvent = useCallback((payload) => {
    if (payload?.reason !== 'secondary_action_confirmed') {
      return;
    }

    if (activeNavigationStage !== 'pickup' || !activeJob?.id) {
      return;
    }

    void cancelActiveTrip(activeJob.id);
  }, [activeJob?.id, activeNavigationStage, cancelActiveTrip]);
  const handleNativeChatAction = useCallback(async () => {
    try {
      await stopNativeNavigationSilently();
    } catch (error) {
      logger.warn('DriverHomeScreen', 'Failed to stop native navigation before opening chat', error);
    }

    const didOpenChat = await openChat();
    if (didOpenChat) {
      resumeNativeNavigationOnFocusRef.current = true;
      return;
    }

    setNavigationAttempted(false);
  }, [openChat, stopNativeNavigationSilently]);
  useEffect(() => {
    primaryActionRef.current = handleNativePrimaryAction;
    secondaryActionRef.current = handleNativeSecondaryAction;
    chatActionRef.current = handleNativeChatAction;
    cancelActionRef.current = handleNativeCancelEvent;
  }, [
    handleNativeCancelEvent,
    handleNativeChatAction,
    handleNativePrimaryAction,
    handleNativeSecondaryAction,
  ]);
  useEffect(() => {
    handledStageTransitionKeyRef.current = null;
  }, [activeJob?.id, activeNavigationStage]);
  useEffect(() => {
    if (!hasActiveTrip || !isNavigating) {
      return;
    }

    void updateNavigationOptions({
      actionCard: {
        chatActionLabel: hasUnreadActiveTripChat ? 'Chat •' : 'Chat',
        chatHasUnread: hasUnreadActiveTripChat,
      },
    });
  }, [
    hasActiveTrip,
    hasUnreadActiveTripChat,
    isNavigating,
    updateNavigationOptions,
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
          return {
            ...previousTrip,
            ...updatedTrip,
          };
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
  const activeNavigationKey = useMemo(() => {
    if (!shouldUseNativeNavigator) {
      return null;
    }
    return [
      activeJob?.id || 'none',
      activeNavigationStage,
      navigationOrigin?.latitude || '',
      navigationOrigin?.longitude || '',
      navigationDestination?.latitude || '',
      navigationDestination?.longitude || '',
    ].join(':');
  }, [
    activeJob?.id,
    activeNavigationStage,
    navigationDestination?.latitude,
    navigationDestination?.longitude,
    navigationOrigin?.latitude,
    navigationOrigin?.longitude,
    shouldUseNativeNavigator,
  ]);
  const lastNavigationKeyRef = useRef(null);
  useEffect(() => {
    if (!activeNavigationKey) {
      lastNavigationKeyRef.current = null;
      setNavigationAttempted(false);
      return;
    }

    if (lastNavigationKeyRef.current !== activeNavigationKey) {
      lastNavigationKeyRef.current = activeNavigationKey;
      setNavigationAttempted(false);
    }
  }, [activeNavigationKey]);
  useEffect(() => {
    if (!isFocused || !resumeNativeNavigationOnFocusRef.current) {
      return;
    }
    resumeNativeNavigationOnFocusRef.current = false;
    setNavigationAttempted(false);
  }, [isFocused]);
  useAutoMapboxNavigationStart({
    enabled: Boolean(isFocused && shouldUseNativeNavigator),
    isSupported: isNativeNavigationSupported,
    isNavigating,
    navigationAttempted,
    setNavigationAttempted,
    startNavigation,
    logScope: 'DriverHomeScreen',
    fallbackLogMessage: 'Mapbox navigation unavailable on home',
    maxRetries: 2,
    retryDelayMs: 1200,
  });
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
      return {
        ...previousTrip,
        ...activatedTripFromRoute,
      };
    });
    setNavigationAttempted(false);

    if (typeof navigation?.setParams === 'function') {
      navigation.setParams({
        activatedTrip: undefined,
      });
    }
  }, [navigation, route?.params?.activatedTrip]);
  const openNativeNavigationFromHome = useCallback((trip) => {
    if (trip?.id && trip.id !== activeJob?.id) {
      setAcceptedRequestId(trip.id);
      setActiveJob(trip);
      return true;
    }

    setNavigationAttempted(false);
    void startNavigation({ showAlert: true });
    return true;
  }, [activeJob?.id, startNavigation]);

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
    setIncomingRequest,
    setIsMinimized,
    setShowAllRequests,
    setShowIncomingModal,
  });
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
      setNavigationAttempted(false);
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
    setPhoneVerifyVisible,
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
    handleClosePhoneVerify,
    handleCloseRequestModal,
    handleMessageCustomer,
    handlePhoneVerified,
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
      setNavigationAttempted(false);
    },
    refreshAcceptedScheduledRequests,
    refreshProfile,
    reopenRequestModalModeRef,
    reopenRequestModalOnFocusRef,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setPhoneVerifyVisible,
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
    onTripAccepted: (trip) => {
      if (!trip?.id) {
        return;
      }
      setAcceptedRequestId(trip.id);
      setActiveJob(trip);
      setNavigationAttempted(false);
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
    cameraRef, isCompact, isRestoringActiveTrip, activeJob, activeJobStatusLabel,
    activeJobDestinationAddress, activeJobSecondaryLabel, isScheduledPoolActive, waitTime,
    progressValue, incomingRequest, requestTimeRemaining, miniBarPulse, formatRequestTime,
    requestModalMode, requestModalRequests,
    driverLocation, loading: requestModalLoading, error: requestModalError, requestTimerTotal, navigation,
    activeTripPickupLocation: pickupLocation,
    activeTripDropoffLocation: dropoffLocation,
    phoneVerifyVisible,
    isNavigationActiveInBackground: Boolean(hasActiveTrip && isNavigating),
    insetsTop: insets.top,
    onRequestMarkerPress: handleRequestMarkerPress,
    onResumeTrip: () => openActiveTrip(activeJob),
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
    onClosePhoneVerify: handleClosePhoneVerify,
    onPhoneVerified: handlePhoneVerified,
    phoneVerifyUserId: currentUser?.uid || currentUser?.id,
    showOnboardingRequiredBanner,
    onOpenOnboarding: handleOpenOnboarding,
    isAvailabilityLocked: showOnboardingRequiredBanner,
    isDriverGeoRestricted,
    driverAvailabilityComingSoonTitle: DRIVER_AVAILABILITY_COMING_SOON_TITLE,
    driverAvailabilityComingSoonMessage: DRIVER_AVAILABILITY_COMING_SOON_MESSAGE,
  });

  return <DriverHomeScreenContent {...contentProps} />;
}
