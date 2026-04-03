import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import useDeliveryNavigationData from './useDeliveryNavigationData';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import useNavigationCardAnimation from '../../hooks/useNavigationCardAnimation';
import useAutoMapboxNavigationStart from '../../hooks/useAutoMapboxNavigationStart';
import styles from './DeliveryNavigationScreen.styles';
import { colors } from '../../styles/theme';
import { navigateDriverToHome } from './navigationRoute.utils';
import { ARRIVAL_UNLOCK_RADIUS_METERS, formatDistance, getDistanceFromLatLonInKm } from './navigationMath.utils';
import { logger } from '../../services/logger';
import { resolveRequestConversationContext } from './requestConversationContext.utils';
import { resolveCustomerDisplayFromRequest } from '../../utils/profileDisplay';

const FEET_PER_METER = 3.28084;

export default function DeliveryNavigationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { request, pickupPhotos, driverLocation: initialDriverLocation } = route.params;
  const { currentUser, userType } = useAuthIdentity();
  const { arriveAtDropoff, getRequestById, updateDriverStatus } = useTripActions();
  const { getConversations, createConversation, subscribeToConversations } = useMessagingActions();
  const { getUserProfile } = useProfileActions();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const cancellationHandledRef = useRef(false);

  const mapRef = useRef(null);

  const {
    routeSteps,
    currentStepIndex,
    nextInstruction,
    distanceToTurn,
    currentStreetName,
    currentManeuverIcon,
    applyRouteSteps,
    updateNavigationProgress,
  } = useGpsRouteProgress();
  const {
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
  const customerDisplayName = resolveCustomerDisplayFromRequest(requestData || request, {
    fallbackName: 'Customer',
  }).name;
  const distanceToDropoffMeters = useMemo(() => {
    if (!driverLocation || !dropoffLocation) {
      return null;
    }

    const distanceKm = getDistanceFromLatLonInKm(
      driverLocation.latitude,
      driverLocation.longitude,
      dropoffLocation.latitude,
      dropoffLocation.longitude
    );
    const distanceMeters = distanceKm * 1000;
    return Number.isFinite(distanceMeters) ? distanceMeters : null;
  }, [driverLocation, dropoffLocation]);
  const canArriveAtDropoff =
    Number.isFinite(distanceToDropoffMeters) &&
    distanceToDropoffMeters <= ARRIVAL_UNLOCK_RADIUS_METERS;
  
  const { cardAnimation } = useNavigationCardAnimation({ isLoading });
  
  // Monitor order status for cancellations
  useOrderStatusMonitor(requestData?.id || request?.id, navigation, {
    currentScreen: 'DeliveryNavigationScreen',
    enabled: !!(requestData?.id || request?.id),
    onCancel: () => {
      if (cancellationHandledRef.current) {
        return;
      }
      cancellationHandledRef.current = true;
      stopLocationTracking();
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
      if (progress.distanceRemaining) {
        setRemainingDistance(formatDistance(progress.distanceRemaining));
        setRemainingDistanceMeters(progress.distanceRemaining);
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
        stopNavigation({ showAlert: false });
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
    getUserProfile,
    currentUserId,
    customerIdHint: activeRequestCustomerId,
    driverIdHint: activeRequestDriverId,
    customerNameHint: customerDisplayName,
    createConversation,
    navigation,
    clearUnread: () => setHasUnreadChat(false),
  });
  const handleArriveAtDropoffPress = useCallback(() => {
    if (!canArriveAtDropoff) {
      Alert.alert(
        'Not close enough yet',
        `Get within ${Math.round(ARRIVAL_UNLOCK_RADIUS_METERS * FEET_PER_METER)} ft of dropoff to confirm arrival.`
      );
      return;
    }

    void handleArriveAtDropoff();
  }, [canArriveAtDropoff, handleArriveAtDropoff]);

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
      openChat={openChat}
      isCreatingChat={isCreatingChat}
      hasUnreadChat={hasUnreadChat}
      handleArriveAtDropoff={handleArriveAtDropoffPress}
      nextInstruction={nextInstruction}
      currentManeuverIcon={currentManeuverIcon}
      distanceToTurn={distanceToTurn}
      currentStreetName={currentStreetName}
      distanceToDestination={remainingDistanceMeters ?? remainingDistance}
      canArrive={canArriveAtDropoff}
      onBack={() => {
        if (isNavigating) {
          stopNavigation();
        }
        navigation.goBack();
      }}
    />
  );
}
