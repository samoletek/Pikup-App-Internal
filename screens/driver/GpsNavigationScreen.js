import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
  useTripActions,
} from '../../contexts/AuthContext';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import useMapboxNavigation from '../../components/mapbox/useMapboxNavigation';
import GpsNavigationCustomerView from '../../components/navigation/GpsNavigationCustomerView';
import GpsNavigationDriverView from '../../components/navigation/GpsNavigationDriverView';
import NavigationScreenState from '../../components/navigation/NavigationScreenState';
import useTripConversationUnread from '../../hooks/useTripConversationUnread';
import useGpsRouteProgress from '../../hooks/useGpsRouteProgress';
import useCustomerAvatarFromTripRequest from './useCustomerAvatarFromTripRequest';
import useGpsNavigationData from './useGpsNavigationData';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import useNavigationCardAnimation from '../../hooks/useNavigationCardAnimation';
import useAutoMapboxNavigationStart from '../../hooks/useAutoMapboxNavigationStart';
import styles from './GpsNavigationScreen.styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../styles/theme';
import { formatDistance } from './navigationMath.utils';
import { navigateDriverToHome } from './navigationRoute.utils';
import { logger } from '../../services/logger';
import { resolveRequestConversationContext } from './requestConversationContext.utils';

export default function GpsNavigationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { request, isCustomerView = false, stage = 'pickup' } = route.params || {};
  const { currentUser, userType } = useAuthIdentity();
  const { startDriving, arriveAtPickup, getRequestById, updateDriverStatus, cancelOrder } = useTripActions();
  const { getConversations, createConversation, subscribeToConversations } = useMessagingActions();
  const { getUserProfile } = useProfileActions();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const cancellationHandledRef = useRef(false);
  
  const [navigationAttempted, setNavigationAttempted] = useState(false);
  const [isCancellingTrip, setIsCancellingTrip] = useState(false);

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
  } = useGpsNavigationData({
    isCustomerView,
    request,
    getRequestById,
    startDriving,
    updateDriverStatus,
    applyRouteSteps,
    routeSteps,
    currentStepIndex,
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
    isCustomerView,
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
  
  // Mapbox Navigation Integration
  const { startNavigation, stopNavigation, isNavigating, isSupported } = useMapboxNavigation({
    origin: driverLocation,
    destination: customerLocation,
    onRouteProgress: (progress) => {
      // Update ETA and distance from navigation progress
      if (progress.durationRemaining) {
        const minutes = Math.round(progress.durationRemaining / 60);
        setEstimatedTime(minutes < 1 ? '<1' : minutes.toString());
      }
      if (progress.distanceRemaining) {
        setRemainingDistance(formatDistance(progress.distanceRemaining));
      }
    },
    onArrival: () => {
      Alert.alert('Navigation', 'You have arrived at your destination!');
      stopNavigation();
      handleArrive();
    },
    onCancel: () => {
      logger.info('GpsNavigationScreen', 'Navigation cancelled by user');
    },
  });

  const handleTripCancelled = useCallback(() => {
    if (cancellationHandledRef.current) {
      return;
    }
    cancellationHandledRef.current = true;
    clearNavigationResources();
    stopNavigation({ showAlert: false });
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
  }, [clearNavigationResources, navigation, stopNavigation]);

  const { cardAnimation } = useNavigationCardAnimation({ isLoading });
  const {
    customerAvatarUrl,
    customerDisplayName,
    setCustomerAvatarUrl,
  } = useCustomerAvatarFromTripRequest({
    requestData,
    routeRequest: request,
    activeRequestCustomerId,
    getUserProfile,
    enabled: !isCustomerView,
  });
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(requestData?.id || request?.id, navigation, {
    currentScreen: 'GpsNavigationScreen',
    enabled: !!(requestData?.id || request?.id) && !isCustomerView,
    onCancel: handleTripCancelled,
  });

  useEffect(() => {
    if (isCustomerView) {
      initializeCustomerView();
    } else {
      initializeDriverNavigation();
    }

    return () => {
      clearNavigationResources();
      stopNavigation({ showAlert: false });
    };
    // Navigation mode bootstrap is intentionally one-time; retry action re-initializes explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoMapboxNavigationStart({
    enabled: Boolean(!isCustomerView && driverLocation && customerLocation),
    isSupported,
    isNavigating,
    navigationAttempted,
    setNavigationAttempted,
    startNavigation,
    logScope: 'GpsNavigationScreen',
    fallbackLogMessage: 'Mapbox navigation not available, using fallback map',
  });

  const handleArrive = async () => {
    try {
      if (requestData?.id) {
        await arriveAtPickup(requestData.id, driverLocation);
        navigation.navigate('PickupConfirmationScreen', { request: requestData, driverLocation });
      }
    } catch (error) {
      logger.error('GpsNavigationScreen', 'Error marking arrival', error);
      const errorMessage = String(error?.message || '').toLowerCase();
      if (errorMessage.includes('cancelled')) {
        handleTripCancelled();
        return;
      }
      Alert.alert('Error', 'Failed to update arrival status. Please try again.');
    }
  };

  const handleCancelTrip = useCallback(() => {
    const requestId = requestData?.id || request?.id;
    if (!requestId || isCancellingTrip) {
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
            try {
              setIsCancellingTrip(true);
              const cancellationResult = await cancelOrder(requestId, 'driver_request');
              if (!cancellationResult?.success) {
                throw new Error(cancellationResult?.error || 'Please try again in a moment.');
              }

              cancellationHandledRef.current = true;
              clearNavigationResources();
              await stopNavigation({ showAlert: false });
              navigateDriverToHome(navigation);
            } catch (error) {
              logger.error('GpsNavigationScreen', 'Error cancelling trip from driver view', error);
              Alert.alert(
                'Unable to cancel',
                error?.message || 'Please try again in a moment.'
              );
            } finally {
              setIsCancellingTrip(false);
            }
          },
        },
      ]
    );
  }, [
    cancelOrder,
    clearNavigationResources,
    isCancellingTrip,
    navigation,
    request?.id,
    requestData?.id,
    stopNavigation,
  ]);

  const {
    isCreatingChat,
    openChat,
  } = useDriverTripChat({
    requestData,
    routeRequest: route.params?.request,
    getRequestById,
    getUserProfile,
    currentUserId,
    customerIdHint: activeRequestCustomerId,
    driverIdHint: activeRequestDriverId,
    customerNameHint: customerDisplayName,
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
          if (isCustomerView) {
            initializeCustomerView();
          } else {
            initializeDriverNavigation();
          }
        }}
      />
    );
  }

  return isCustomerView ? (
    <GpsNavigationCustomerView
      styles={styles}
      mapRef={mapRef}
      driverLocation={driverLocation}
      customerLocation={customerLocation}
      routeCoordinates={routeCoordinates}
      currentHeading={currentHeading}
      insetsTop={insets.top}
      cardAnimation={cardAnimation}
      cardGradientColors={cardGradientColors}
      estimatedTime={estimatedTime}
      requestData={requestData}
      openChat={openChat}
      isCreatingChat={isCreatingChat}
      hasUnreadChat={hasUnreadChat}
      remainingDistance={remainingDistance}
      stage={stage}
      onBack={() => navigation.goBack()}
    />
  ) : (
    <GpsNavigationDriverView
      styles={styles}
      mapRef={mapRef}
      driverLocation={driverLocation}
      customerLocation={customerLocation}
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
      customerName={customerDisplayName}
      customerAvatarUrl={customerAvatarUrl}
      onCustomerAvatarError={() => setCustomerAvatarUrl(null)}
      openChat={openChat}
      isCreatingChat={isCreatingChat}
      hasUnreadChat={hasUnreadChat}
      handleArrive={handleArrive}
      handleCancelTrip={handleCancelTrip}
      isCancellingTrip={isCancellingTrip}
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
