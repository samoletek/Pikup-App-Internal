import React, { useMemo } from "react";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Mapbox from "@rnmapbox/maps";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import {
  useAuthIdentity,
  useStorageActions,
  useTripActions,
} from "../../contexts/AuthContext";
import CustomerOrderModal from "../../components/CustomerOrderModal";
import PhoneVerificationModal from "../../components/PhoneVerificationModal";
import PendingBookingSearchSheet from "../../components/customer/PendingBookingSearchSheet";
import MapboxMap from "../../components/mapbox/MapboxMap";
import styles from "./CustomerHomeScreen.styles";
import {
  colors,
  spacing,
} from "../../styles/theme";
import useCustomerDeliveryTracking from "../../hooks/useCustomerDeliveryTracking";
import usePendingBookingSearchUi from "../../hooks/usePendingBookingSearchUi";
import useCustomerHomeFlow, { CUSTOMER_LOCATION_GATE_STATUS } from "./useCustomerHomeFlow";

export default function CustomerHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentUser, refreshProfile } = useAuthIdentity();
  const { getUserPickupRequests, createPickupRequest, cancelOrder } = useTripActions();
  const { uploadToSupabase } = useStorageActions();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const {
    activeDelivery,
    pendingBooking,
    setPendingBooking,
    recentCancellation,
    clearRecentCancellation,
    checkActiveDeliveries,
  } = useCustomerDeliveryTracking({
    currentUserId,
    getUserPickupRequests,
  });

  const {
    activeDeliveryStep,
    handleCancelPendingBooking,
    handleOpenActiveTripDetails,
    handleOrderConfirm,
    isCancellingPending,
    orderModalKey,
    phoneVerifyVisible,
    searchModalVisible,
    setPhoneVerifyVisible,
    setSearchModalVisible,
    locationGateNotice,
    phoneGateNotice,
    locationGateStatus,
    isPhoneVerificationRequiredForOrders,
    userLocation,
  } = useCustomerHomeFlow({
    activeDelivery,
    pendingBooking,
    currentUser,
    currentUserId,
    navigation,
    checkActiveDeliveries,
    recentCancellation,
    clearRecentCancellation,
    setPendingBooking,
    cancelOrder,
    uploadToSupabase,
    createPickupRequest,
  });

  const {
    isSearchSheetExpanded,
    setIsSearchSheetExpanded,
    searchTimerLabel,
    pendingBookingSummary,
    searchSheetDetailsHeight,
    searchSheetDetailsOpacity,
    searchingMarkerCoordinate,
    searchingPulseSize,
    searchingPulseRingOpacity,
  } = usePendingBookingSearchUi({
    pendingBooking,
    userLocation,
  });

  const floatingWidth = useMemo(
    () => Math.min(Math.max(width - spacing.lg * 2, 280), 560),
    [width]
  );

  const logoWidth = useMemo(
    () => Math.min(Math.max(width * 0.2, 76), 112),
    [width]
  );

  const floatingBottomOffset = useMemo(
    () => insets.bottom + spacing.lg,
    [insets.bottom]
  );

  const mapCenterCoordinate = useMemo(() => {
    if (pendingBooking && searchingMarkerCoordinate) {
      return searchingMarkerCoordinate;
    }

    if (userLocation?.longitude && userLocation?.latitude) {
      return [userLocation.longitude, userLocation.latitude];
    }

    return [-84.388, 33.749];
  }, [pendingBooking, searchingMarkerCoordinate, userLocation]);

  const showCreateOrderTrigger = !activeDelivery && !pendingBooking;
  const isCheckingLocationGate = (
    locationGateStatus === CUSTOMER_LOCATION_GATE_STATUS.CHECKING
  );
  const isCreateOrderLockedByLocation = (
    showCreateOrderTrigger &&
    locationGateStatus !== CUSTOMER_LOCATION_GATE_STATUS.ALLOWED
  );
  const isCreateOrderLockedByPhone = (
    showCreateOrderTrigger &&
    !isCreateOrderLockedByLocation &&
    isPhoneVerificationRequiredForOrders
  );
  const isCreateOrderLocked = isCreateOrderLockedByLocation || isCreateOrderLockedByPhone;
  const createOrderTriggerTitle = isCreateOrderLockedByLocation
    ? (isCheckingLocationGate ? "Checking location..." : "Service not available")
    : isCreateOrderLockedByPhone
      ? "Verify phone number"
    : "Where to?";
  const createOrderTriggerBadgeLabel = isCreateOrderLockedByLocation
    ? (isCheckingLocationGate ? "Please wait" : "Blocked")
    : isCreateOrderLockedByPhone
      ? "Required"
    : "Now";
  const createOrderTriggerIcon = isCreateOrderLockedByLocation
    ? (isCheckingLocationGate ? "time" : "lock-closed")
    : isCreateOrderLockedByPhone
      ? "call"
    : "search";
  const createOrderTriggerBadgeIcon = isCreateOrderLockedByPhone
    ? "alert-circle"
    : "time";
  const showGeoNotice = showCreateOrderTrigger && Boolean(locationGateNotice);
  const showPhoneNotice = (
    showCreateOrderTrigger &&
    !showGeoNotice &&
    isCreateOrderLockedByPhone &&
    Boolean(phoneGateNotice)
  );

  return (
    <View style={styles.container}>
      <MapboxMap
        style={[styles.map, { bottom: -tabBarHeight }]}
        centerCoordinate={mapCenterCoordinate}
        zoomLevel={14}
      >
        <Mapbox.UserLocation visible />

        {pendingBooking && searchingMarkerCoordinate ? (
          <Mapbox.MarkerView
            id="searching-driver-marker"
            coordinate={searchingMarkerCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
            allowOverlapWithPuck
          >
            <View style={styles.searchingMarkerContainer}>
              <Animated.View
                style={[
                  styles.searchingMarkerPulse,
                  {
                    opacity: searchingPulseRingOpacity,
                    width: searchingPulseSize,
                    height: searchingPulseSize,
                  },
                ]}
              />
              <View style={styles.searchingMarkerCore}>
                <Ionicons name="search" size={16} color={colors.white} />
              </View>
            </View>
          </Mapbox.MarkerView>
        ) : null}
      </MapboxMap>

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Image
          source={require("../../assets/pikup-logo.png")}
          style={[styles.headerLogo, { width: logoWidth }]}
          accessible
          accessibilityLabel="PikUp"
        />
      </View>

      {showGeoNotice ? (
        <View style={[styles.geoNoticeContainer, { top: insets.top + 40 }]}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <Text style={styles.geoNoticeText}>
            {locationGateNotice}
          </Text>
        </View>
      ) : null}

      {showPhoneNotice ? (
        <TouchableOpacity
          style={[styles.geoNoticeContainer, styles.phoneNoticeContainer, { top: insets.top + 40 }]}
          activeOpacity={0.9}
          onPress={() => setPhoneVerifyVisible(true)}
        >
          <Ionicons name="call" size={16} color={colors.warning} />
          <Text style={styles.geoNoticeText}>
            {phoneGateNotice}
          </Text>
          <View style={styles.phoneNoticeActionChip}>
            <Text style={styles.phoneNoticeActionText}>Verify</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {activeDelivery && activeDeliveryStep ? (
        <View
          style={[
            styles.floatingTriggerContainer,
            { paddingBottom: floatingBottomOffset, width: floatingWidth },
          ]}
        >
          <View style={styles.activeTripPulseWrap}>
            <TouchableOpacity
              style={styles.activeTripTrigger}
              onPress={handleOpenActiveTripDetails}
              activeOpacity={0.95}
            >
              <View style={[styles.activeTripSideSlot, styles.activeTripSideSlotLeft]}>
                <View style={styles.activeTripIconCircle}>
                  <Ionicons
                    name={activeDeliveryStep.icon}
                    size={20}
                    color={colors.background.primary}
                  />
                </View>
              </View>

              <Text style={styles.activeTripTriggerText} numberOfLines={1}>
                {activeDeliveryStep.label}
              </Text>

              <View style={[styles.activeTripSideSlot, styles.activeTripSideSlotRight]}>
                <View style={styles.activeTripOpenIndicator}>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.background.primary}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {showCreateOrderTrigger ? (
        <View
          style={[
            styles.floatingTriggerContainer,
            { paddingBottom: floatingBottomOffset, width: floatingWidth },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.floatingTrigger,
              isCreateOrderLocked ? styles.floatingTriggerDisabled : null,
            ]}
            onPress={isCreateOrderLocked ? undefined : () => setSearchModalVisible(true)}
            activeOpacity={isCreateOrderLocked ? 1 : 0.9}
            disabled={isCreateOrderLocked}
          >
            <View
              style={[
                styles.triggerIconCircle,
                isCreateOrderLocked ? styles.triggerIconCircleDisabled : null,
              ]}
            >
              <Ionicons
                name={createOrderTriggerIcon}
                size={20}
                color={colors.text.primary}
              />
            </View>

            <Text
              style={[
                styles.floatingTriggerText,
                isCreateOrderLocked ? styles.floatingTriggerTextDisabled : null,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {createOrderTriggerTitle}
            </Text>

            <View style={styles.triggerTimeBadge}>
              <Ionicons
                name={createOrderTriggerBadgeIcon}
                size={12}
                color={colors.text.secondary}
                style={styles.timeIconLeft}
              />
              <Text style={styles.triggerTimeText}>
                {createOrderTriggerBadgeLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.text.secondary}
                style={styles.timeIconRight}
              />
            </View>
          </TouchableOpacity>
        </View>
      ) : null}

      {Boolean(pendingBooking) && !activeDelivery ? (
        <PendingBookingSearchSheet
          isExpanded={isSearchSheetExpanded}
          onToggleExpand={() => setIsSearchSheetExpanded((prev) => !prev)}
          searchTimerLabel={searchTimerLabel}
          pendingBookingSummary={pendingBookingSummary}
          searchSheetDetailsHeight={searchSheetDetailsHeight}
          searchSheetDetailsOpacity={searchSheetDetailsOpacity}
          isCancellingPending={isCancellingPending}
          onCancelPendingBooking={handleCancelPendingBooking}
        />
      ) : null}

      <CustomerOrderModal
        key={orderModalKey}
        visible={searchModalVisible && !isCreateOrderLocked}
        onClose={() => setSearchModalVisible(false)}
        onConfirm={async (orderData) => {
          const result = await handleOrderConfirm(orderData);
          if (result?.success) {
            setIsSearchSheetExpanded(false);
          }
          return result;
        }}
        userLocation={userLocation}
        customerEmail={currentUser?.email}
        customerName={
          [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || undefined
        }
      />

      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={() => setPhoneVerifyVisible(false)}
        onVerified={async () => {
          setPhoneVerifyVisible(false);
          await refreshProfile();
          if (
            !activeDelivery &&
            !pendingBooking &&
            locationGateStatus === CUSTOMER_LOCATION_GATE_STATUS.ALLOWED
          ) {
            setSearchModalVisible(true);
          }
        }}
        userId={currentUser?.uid || currentUser?.id}
        userTable="customers"
      />
    </View>
  );
}
