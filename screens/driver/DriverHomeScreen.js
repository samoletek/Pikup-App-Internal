import React, { useEffect, useState, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
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
import {
  DRIVER_AVAILABILITY_COMING_SOON_MESSAGE,
  DRIVER_AVAILABILITY_COMING_SOON_TITLE,
  SUPPORTED_ORDER_STATE_CODES,
} from '../../constants/orderAvailability';
import {
  isSupportedOrderStateCode,
} from '../../utils/locationState';

export default function DriverHomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;
  const tabBarHeight = useBottomTabBarHeight();
  const { userType, currentUser, refreshProfile } = useAuthIdentity();
  const { getUserProfile } = useProfileActions();
  const {
    getUserPickupRequests,
    getAvailableRequests,
    declineRequestOffer,
    acceptRequest,
    checkExpiredRequests,
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
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
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
    incomingRequestIdRef,
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
    refreshAcceptedScheduledRequests,
  } = useAcceptedScheduledRequests({
    currentUserId,
    getUserPickupRequests,
    getUserProfile,
    confirmScheduledTripCheckin,
    declineScheduledTripCheckin,
    isOnline,
    hasActiveTrip,
    navigation,
    setAcceptedRequestId,
    setActiveJob,
    setShowRequestModal,
    setShowAllRequests,
    setRequestModalMode,
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
      // Reload requests to refresh the list
      loadRequests(false);
    }
  });

  useEffect(() => {
    incomingRequestIdRef.current = incomingRequest?.id || null;
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
    clearIncomingRoute,
    isAcceptingRequestRef,
    loadRequests,
    navigation,
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
    navigation,
    setAcceptedRequestId,
    setActiveJob,
    setAvailableRequests,
    setIncomingRequest,
    setIsMinimized,
    setShowIncomingModal,
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
    phoneVerifyVisible,
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
