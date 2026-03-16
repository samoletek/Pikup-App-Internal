import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
  useTripActions,
} from '../../contexts/AuthContext';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import useMapboxNavigation from '../../components/mapbox/useMapboxNavigation';
import DeliveryNavigationDriverView from '../../components/navigation/DeliveryNavigationDriverView';
import NavigationScreenState from '../../components/navigation/NavigationScreenState';
import useTripConversationUnread from '../../hooks/useTripConversationUnread';
import useGpsRouteProgress from '../../hooks/useGpsRouteProgress';
import useCustomerAvatarFromTripRequest from './useCustomerAvatarFromTripRequest';
import useDeliveryNavigationData from './useDeliveryNavigationData';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import useNavigationCardAnimation from '../../hooks/useNavigationCardAnimation';
import useAutoMapboxNavigationStart from '../../hooks/useAutoMapboxNavigationStart';
import styles from './DeliveryNavigationScreen.styles';
import { colors } from '../../styles/theme';
import { logger } from '../../services/logger';
import { resolveRequestConversationContext } from './requestConversationContext.utils';

export default function DeliveryNavigationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { request, pickupPhotos, driverLocation: initialDriverLocation } = route.params;
  const { currentUser, userType } = useAuthIdentity();
  const { arriveAtDropoff, getRequestById, updateDriverStatus } = useTripActions();
  const { getConversations, createConversation, subscribeToConversations } = useMessagingActions();
  const { getUserProfile } = useProfileActions();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const mapRef = useRef(null);

  const {
    routeSteps,
    currentStepIndex,
    nextInstruction,
    distanceToTurn,
    currentManeuverIcon,
    applyRouteSteps,
    updateNavigationProgress,
  } = useGpsRouteProgress();
  const {
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
  } = useDeliveryNavigationData({
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
  });

  const cardGradientColors = [colors.background.primary, colors.background.secondary];
  const {
    activeRequestId,
    activeRequestCustomerId,
    activeRequestDriverId,
    conversationUserType,
  } = resolveRequestConversationContext({
    requestData,
    routeRequest: request,
    userType,
  });
  const { hasUnreadChat, setHasUnreadChat } = useTripConversationUnread({
    currentUserId,
    getConversations,
    subscribeToConversations,
    conversationUserType,
    activeRequestId,
    activeRequestCustomerId,
    activeRequestDriverId,
  });
  
  const { cardAnimation } = useNavigationCardAnimation({ isLoading });
  const {
    customerAvatarUrl,
    setCustomerAvatarUrl,
  } = useCustomerAvatarFromTripRequest({
    requestData,
    routeRequest: request,
    activeRequestCustomerId,
    getUserProfile,
  });
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(requestData?.id, navigation, {
    currentScreen: 'DeliveryNavigationScreen',
    enabled: !!requestData?.id,
    onCancel: () => {
      stopLocationTracking();
      // Stop Mapbox navigation if active
      if (isNavigating) {
        stopNavigation();
      }
    }
  });

  // Mapbox Navigation Integration
  const { startNavigation, stopNavigation, isNavigating, isSupported } = useMapboxNavigation({
    origin: driverLocation,
    destination: dropoffLocation,
    onRouteProgress: (progress) => {
      // Update ETA and distance from navigation progress
      if (progress.durationRemaining) {
        const minutes = Math.round(progress.durationRemaining / 60);
        setEstimatedTime(minutes < 1 ? '<1' : minutes.toString());
      }
    },
    onArrival: () => {
      Alert.alert('Navigation', 'You have arrived at your destination!');
      stopNavigation();
      handleArriveAtDropoff();
    },
    onCancel: () => {
      logger.info('DeliveryNavigationScreen', 'Delivery navigation cancelled by user');
    },
  });

  useEffect(() => {
    return () => {
      if (isNavigating) {
        stopNavigation();
      }
    };
  }, [isNavigating, stopNavigation]);

  useAutoMapboxNavigationStart({
    enabled: Boolean(driverLocation && dropoffLocation),
    isSupported,
    isNavigating,
    navigationAttempted,
    setNavigationAttempted: setNavigationAttempted,
    startNavigation,
    logScope: 'DeliveryNavigationScreen',
    fallbackLogMessage: 'Mapbox navigation not available for delivery, using fallback map',
  });

  const {
    isCreatingChat,
    openChat,
  } = useDriverTripChat({
    requestData,
    routeRequest: route.params?.request,
    getRequestById,
    currentUserId,
    createConversation,
    navigation,
    clearUnread: () => setHasUnreadChat(false),
  });

  if (isLoading || locationError) {
    return (
      <NavigationScreenState
        isLoading={isLoading}
        locationError={locationError}
        ui={styles}
        onRetry={() => {
          setLocationError(null);
          setIsLoading(true);
          initializeDeliveryTracking();
        }}
      />
    );
  }

  return (
    <DeliveryNavigationDriverView
      styles={styles}
      mapRef={mapRef}
      driverLocation={driverLocation}
      dropoffLocation={dropoffLocation}
      routeCoordinates={routeCoordinates}
      currentHeading={currentHeading}
      insetsTop={insets.top}
      isNavigating={isNavigating}
      isSupported={isSupported}
      startNavigation={startNavigation}
      stopNavigation={stopNavigation}
      cardAnimation={cardAnimation}
      cardGradientColors={cardGradientColors}
      estimatedTime={estimatedTime}
      requestData={requestData}
      customerAvatarUrl={customerAvatarUrl}
      onCustomerAvatarError={() => setCustomerAvatarUrl(null)}
      openChat={openChat}
      isCreatingChat={isCreatingChat}
      hasUnreadChat={hasUnreadChat}
      handleArriveAtDropoff={handleArriveAtDropoff}
      nextInstruction={nextInstruction}
      currentManeuverIcon={currentManeuverIcon}
      distanceToTurn={distanceToTurn}
      onBack={() => {
        if (isNavigating) {
          stopNavigation();
        }
        navigation.goBack();
      }}
    />
  );
}
