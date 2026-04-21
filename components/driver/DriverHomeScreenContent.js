// Driver Home Screen Content component: renders its UI and handles related interactions.
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import OfflineDashboard from '../OfflineDashboard';
import DriverHomeBottomPanel from './DriverHomeBottomPanel';
import DriverHomeMapLayer from './DriverHomeMapLayer';
import IncomingRequestMiniBar from './IncomingRequestMiniBar';
import RequestModal from '../RequestModal';
import IncomingRequestModal from '../IncomingRequestModal';

export default function DriverHomeScreenContent({
  styles,
  region,
  tabBarHeight,
  shouldShowOnlineDriverMarker,
  onlineDriverMarkerCoordinate,
  onlineDriverPulseOpacity,
  onlineDriverPulseSize,
  isOnline,
  hasActiveTrip,
  showIncomingModal,
  isMinimized,
  availableRequests,
  selectedRequest,
  onRequestMarkerPress,
  incomingRoute,
  incomingMarkers,
  insetsTop,
  mapRef,
  cameraRef,
  isRestoringActiveTrip,
  activeJob,
  activeJobStatusLabel,
  activeJobDestinationAddress,
  activeJobSecondaryLabel,
  onOpenNavigator,
  isNavigationActiveInBackground,
  onArriveAtStop,
  arriveActionLabel,
  isArriveActionEnabled,
  isArriveActionLoading,
  arriveActionHint,
  onCancelActiveTrip,
  showCancelActiveTripAction,
  isCancelActiveTripLoading,
  isScheduledPoolActive,
  waitTime,
  progressValue,
  onGoOffline,
  onGoOnline,
  onGoOnlineScheduled,
  onViewScheduledRequests,
  onViewAcceptedRequests,
  incomingRequest,
  requestTimeRemaining,
  miniBarPulse,
  onExpandMiniBar,
  formatRequestTime,
  requestModalVisible,
  requestModalMode,
  requestModalRequests,
  driverLocation,
  activeTripOriginLocation,
  activeTripDestinationLocation,
  activeTripPickupLocation,
  activeTripDropoffLocation,
  loading,
  error,
  onCloseRequestModal,
  onAcceptRequest,
  onViewRequestDetails,
  onMessageCustomer,
  onRefreshRequests,
  requestTimerTotal,
  onIncomingRequestAccept,
  onIncomingRequestDecline,
  onIncomingRequestMinimize,
  onIncomingSnapChange,
  navigation,
  onDashboardExpandedChange,
  showOnboardingRequiredBanner,
  onOpenOnboarding,
  isAvailabilityLocked,
  isDriverGeoRestricted,
  driverAvailabilityComingSoonTitle,
  driverAvailabilityComingSoonMessage,
}) {
  const showGeoRestrictedBanner = isDriverGeoRestricted && !isOnline && !hasActiveTrip;
  const shouldShowTopNotices = (
    !showIncomingModal &&
    !isMinimized &&
    (showOnboardingRequiredBanner || showGeoRestrictedBanner)
  );

  return (
    <View style={styles.container}>
      <DriverHomeMapLayer
        region={region}
        tabBarHeight={tabBarHeight}
        shouldShowOnlineDriverMarker={shouldShowOnlineDriverMarker}
        onlineDriverMarkerCoordinate={onlineDriverMarkerCoordinate}
        onlineDriverPulseOpacity={onlineDriverPulseOpacity}
        onlineDriverPulseSize={onlineDriverPulseSize}
        isOnline={isOnline}
        hasActiveTrip={hasActiveTrip}
        showIncomingModal={showIncomingModal}
        isMinimized={isMinimized}
        availableRequests={availableRequests}
        selectedRequest={selectedRequest}
        onRequestMarkerPress={onRequestMarkerPress}
        incomingRoute={incomingRoute}
        incomingMarkers={incomingMarkers}
        activeTripOriginLocation={activeTripOriginLocation}
        activeTripDestinationLocation={activeTripDestinationLocation}
        activeTripPickupLocation={activeTripPickupLocation}
        activeTripDropoffLocation={activeTripDropoffLocation}
        insetsTop={insetsTop}
        mapRef={mapRef}
        cameraRef={cameraRef}
        styles={styles}
      />

      {!showIncomingModal && !isMinimized && (
        <DriverHomeBottomPanel
          isRestoringActiveTrip={isRestoringActiveTrip}
          hasActiveTrip={hasActiveTrip}
          activeJob={activeJob}
          activeJobStatusLabel={activeJobStatusLabel}
          activeJobDestinationAddress={activeJobDestinationAddress}
          activeJobSecondaryLabel={activeJobSecondaryLabel}
          onOpenNavigator={onOpenNavigator}
          isNavigationActiveInBackground={isNavigationActiveInBackground}
          onArriveAtStop={onArriveAtStop}
          arriveActionLabel={arriveActionLabel}
          isArriveActionEnabled={isArriveActionEnabled}
          isArriveActionLoading={isArriveActionLoading}
          arriveActionHint={arriveActionHint}
          onCancelActiveTrip={onCancelActiveTrip}
          showCancelActiveTripAction={showCancelActiveTripAction}
          isCancelActiveTripLoading={isCancelActiveTripLoading}
          isOnline={isOnline}
          isScheduledPoolActive={isScheduledPoolActive}
          waitTime={waitTime}
          progressValue={progressValue}
          onGoOffline={onGoOffline}
          onGoOnline={onGoOnline}
          onGoOnlineScheduled={onGoOnlineScheduled}
          onViewScheduledRequests={onViewScheduledRequests}
          isAvailabilityLocked={isAvailabilityLocked}
          isDriverGeoRestricted={isDriverGeoRestricted}
          onViewAcceptedRequests={onViewAcceptedRequests}
        />
      )}

      {shouldShowTopNotices ? (
        <View style={[styles.topNoticeStack, { top: insetsTop + 40 }]}>
          {showOnboardingRequiredBanner ? (
            <TouchableOpacity
              style={styles.identityDeclinedBanner}
              onPress={onOpenOnboarding}
              activeOpacity={0.9}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
              <Text style={styles.identityDeclinedBannerText}>
                Account setup requires attention. Tap to view the current status.
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </TouchableOpacity>
          ) : null}

          {showGeoRestrictedBanner ? (
            <View style={styles.comingSoonTopBanner}>
              <Ionicons name="time-outline" size={16} color={colors.white} />
              <Text style={styles.comingSoonTopBannerText}>
                {(driverAvailabilityComingSoonTitle || 'Coming Soon')}: {' '}
                {driverAvailabilityComingSoonMessage || 'Driver mode is not available in your current area yet.'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <IncomingRequestMiniBar
        visible={isMinimized && incomingRequest}
        incomingRequest={incomingRequest}
        requestTimeRemaining={requestTimeRemaining}
        miniBarPulse={miniBarPulse}
        onExpand={onExpandMiniBar}
        formatRequestTime={formatRequestTime}
        styles={styles}
      />

      <RequestModal
        visible={requestModalVisible}
        mode={requestModalMode}
        requests={requestModalRequests}
        selectedRequest={selectedRequest}
        currentLocation={driverLocation}
        loading={loading}
        error={error}
        onClose={onCloseRequestModal}
        onAccept={onAcceptRequest}
        onViewDetails={onViewRequestDetails}
        onMessage={onMessageCustomer}
        onRefresh={onRefreshRequests}
      />

      <IncomingRequestModal
        visible={showIncomingModal}
        request={incomingRequest}
        timeRemaining={requestTimeRemaining}
        timerTotal={requestTimerTotal}
        onAccept={onIncomingRequestAccept}
        onDecline={onIncomingRequestDecline}
        onMinimize={onIncomingRequestMinimize}
        onSnapChange={onIncomingSnapChange}
      />

      {!isOnline && !hasActiveTrip && !isRestoringActiveTrip && (
        <OfflineDashboard
          onGoOnline={onGoOnline}
          onGoOnlineScheduled={onGoOnlineScheduled}
          navigation={navigation}
          onExpandedChange={onDashboardExpandedChange}
          isAvailabilityLocked={isAvailabilityLocked}
          isDriverGeoRestricted={isDriverGeoRestricted}
        />
      )}

    </View>
  );
}
