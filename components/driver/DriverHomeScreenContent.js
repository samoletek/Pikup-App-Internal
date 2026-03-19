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
import PhoneVerificationModal from '../PhoneVerificationModal';
import RecentTripsModal from '../RecentTripsModal';

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
  isCompact,
  isRestoringActiveTrip,
  activeJob,
  activeJobStatusLabel,
  activeJobDestinationAddress,
  activeJobSecondaryLabel,
  onResumeTrip,
  isScheduledPoolActive,
  waitTime,
  progressValue,
  onGoOffline,
  onGoOnline,
  onGoOnlineScheduled,
  onViewScheduledRequests,
  incomingRequest,
  requestTimeRemaining,
  miniBarPulse,
  onExpandMiniBar,
  formatRequestTime,
  requestModalVisible,
  driverLocation,
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
  dashboardExpanded,
  onOpenRecentTrips,
  navigation,
  onDashboardExpandedChange,
  phoneVerifyVisible,
  onClosePhoneVerify,
  onPhoneVerified,
  phoneVerifyUserId,
  showRecentTrips,
  onCloseRecentTrips,
  recentTrips,
  recentTripsLoading,
  showDeclinedSupportBanner,
  onOpenDeclinedSupport,
}) {
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
        insetsTop={insetsTop}
        mapRef={mapRef}
        cameraRef={cameraRef}
        styles={styles}
      />

      {!showIncomingModal && !isMinimized && (
        <DriverHomeBottomPanel
          isCompact={isCompact}
          isRestoringActiveTrip={isRestoringActiveTrip}
          hasActiveTrip={hasActiveTrip}
          activeJob={activeJob}
          activeJobStatusLabel={activeJobStatusLabel}
          activeJobDestinationAddress={activeJobDestinationAddress}
          activeJobSecondaryLabel={activeJobSecondaryLabel}
          onResumeTrip={onResumeTrip}
          isOnline={isOnline}
          isScheduledPoolActive={isScheduledPoolActive}
          waitTime={waitTime}
          progressValue={progressValue}
          onGoOffline={onGoOffline}
          onGoOnline={onGoOnline}
          onGoOnlineScheduled={onGoOnlineScheduled}
          onViewScheduledRequests={onViewScheduledRequests}
        />
      )}

      {showDeclinedSupportBanner ? (
        <TouchableOpacity
          style={[styles.identityDeclinedBanner, { top: insetsTop + 40 }]}
          onPress={onOpenDeclinedSupport}
          activeOpacity={0.9}
        >
          <Ionicons name="alert-circle" size={18} color={colors.white} />
          <Text style={styles.identityDeclinedBannerText}>
            Onboarding was not approved. Tap to contact support.
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.white} />
        </TouchableOpacity>
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
        requests={availableRequests}
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

      {!isOnline && !hasActiveTrip && !isRestoringActiveTrip && !dashboardExpanded && (
        <TouchableOpacity
          style={styles.floatingRecentTripsBtn}
          onPress={onOpenRecentTrips}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      )}

      {!isOnline && !hasActiveTrip && !isRestoringActiveTrip && (
        <OfflineDashboard
          onGoOnline={onGoOnline}
          onGoOnlineScheduled={onGoOnlineScheduled}
          navigation={navigation}
          onExpandedChange={onDashboardExpandedChange}
        />
      )}

      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={onClosePhoneVerify}
        onVerified={onPhoneVerified}
        userId={phoneVerifyUserId}
        userTable="drivers"
      />

      <RecentTripsModal
        visible={showRecentTrips}
        onClose={onCloseRecentTrips}
        trips={recentTrips}
        loading={recentTripsLoading}
      />
    </View>
  );
}
