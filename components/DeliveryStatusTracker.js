// Delivery Status Tracker component: renders its UI and handles related interactions.
import React, { useState } from 'react';
import {
  Animated,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTripActions } from '../contexts/AuthContext';
import DeliveryPhotosModal from './DeliveryPhotosModal';
import styles from './DeliveryStatusTracker.styles';
import { colors, spacing } from '../styles/theme';
import DeliveryStatusStep from './deliveryTracker/DeliveryStatusStep';
import {
  DELIVERY_STATUS_STEPS,
  formatDeliveryEta,
  getCurrentStatusIndex,
  isScheduledDeliveryRequest,
} from './deliveryTracker/deliveryTracker.utils';
import useDeliveryTrackerRequestData from '../hooks/useDeliveryTrackerRequestData';
import useDeliveryTrackerSheet from '../hooks/useDeliveryTrackerSheet';
import { resolveDriverDisplayFromRequest } from '../utils/profileDisplay';

export default function DeliveryStatusTracker({
  requestId,
  onDeliveryComplete,
  onViewFullTracker,
  expanded = false,
  maxExpandedHeight = 460,
  onExpandedChange,
  onOpenChat,
  hasUnreadChat = false,
  variant = 'floating',
  bottomInset = 0,
}) {
  const { getRequestById } = useTripActions();
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState('pickup');
  const {
    requestData,
    loading,
    error,
    fetchRequestData,
  } = useDeliveryTrackerRequestData({
    requestId,
    getRequestById,
    onDeliveryComplete,
  });
  const {
    isExpanded,
    isSheetVariant,
    isSheetClosing,
    sheetHeightAnim,
    sheetPanHandlers,
    toggleExpanded,
    handleCollapse,
    handleCompactLayout,
  } = useDeliveryTrackerSheet({
    variant,
    expanded,
    maxExpandedHeight,
    onExpandedChange,
    onViewFullTracker,
    requestId,
  });

  const currentStatusIndex = getCurrentStatusIndex(requestData);
  const currentStep = DELIVERY_STATUS_STEPS[currentStatusIndex] || DELIVERY_STATUS_STEPS[0];
  const etaText = formatDeliveryEta(currentStatusIndex);
  const isScheduledDelivery = isScheduledDeliveryRequest(requestData);

  const handleRefresh = () => {
    fetchRequestData();
  };

  const handleViewPhotos = (type) => {
    setActivePhotoType(type);
    setShowPhotosModal(true);
  };

  const renderCompactView = () => {
    if (!requestData) return null;

    const shortDeliveryLabel = requestData.item?.description || requestData.vehicleType || 'Delivery in progress';

    if (isSheetVariant) {
      return (
        <Animated.View
          style={[
            styles.sheetAnimatedWrapper,
            styles.sheetAnimatedWrapperCompact,
            isSheetClosing ? styles.sheetAnimatedWrapperClosing : null,
            { height: sheetHeightAnim },
          ]}
        >
          <View
            style={styles.sheetCompactContainer}
            onLayout={handleCompactLayout}
            {...sheetPanHandlers}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetCompactRow}>
              <TouchableOpacity
                style={styles.sheetCompactMain}
                onPress={toggleExpanded}
                activeOpacity={0.9}
              >
                <View style={styles.compactContent}>
                  <View style={styles.compactIconContainer}>
                    <Ionicons name={currentStep.icon} size={16} color={colors.white} />
                  </View>
                  <View style={[styles.compactTextContainer, styles.sheetCompactTextContainer]}>
                    <Text style={styles.compactStatus}>{currentStep.label}</Text>
                    <Text style={styles.compactInfo}>
                      {shortDeliveryLabel} • ETA: {etaText}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {typeof onOpenChat === 'function' && !isScheduledDelivery && (
                <TouchableOpacity
                  style={styles.chatActionButton}
                  onPress={() => onOpenChat(requestData)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
                  {hasUnreadChat ? <View style={styles.chatUnreadDotCompact} /> : null}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.tapIndicator} onPress={toggleExpanded} activeOpacity={0.85}>
                <Ionicons name="chevron-up" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      );
    }

    return (
      <TouchableOpacity style={styles.compactContainer} onPress={toggleExpanded} activeOpacity={0.9}>
        <View style={styles.compactContent}>
          <View style={styles.compactIconContainer}>
            <Ionicons name={currentStep.icon} size={16} color={colors.white} />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactStatus}>{currentStep.label}</Text>
            <Text style={styles.compactInfo}>
              {shortDeliveryLabel} • ETA: {etaText}
            </Text>
          </View>
        </View>
        <View style={styles.tapIndicator}>
          <Ionicons name="chevron-up" size={16} color={colors.text.secondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPhotoButtons = () => {
    const hasPickupPhotos = requestData?.pickupPhotos && requestData.pickupPhotos.length > 0;
    const hasDeliveryPhotos = requestData?.dropoffPhotos && requestData.dropoffPhotos.length > 0;

    if (currentStatusIndex < 3 || (!hasPickupPhotos && !hasDeliveryPhotos)) {
      return null;
    }

    return (
      <View style={styles.photoButtonsContainer}>
        {hasPickupPhotos && (
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => handleViewPhotos('pickup')}
          >
            <Ionicons name="camera" size={16} color={colors.primary} />
            <Text style={styles.photoButtonText}>Pickup Photos</Text>
          </TouchableOpacity>
        )}

        {hasDeliveryPhotos && (
          <TouchableOpacity
            style={styles.photoButton}
            onPress={() => handleViewPhotos('delivery')}
          >
            <Ionicons name="images" size={16} color={colors.primary} />
            <Text style={styles.photoButtonText}>Delivery Photos</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDriverInfo = () => {
    if (!requestData) {
      return null;
    }
    const hasDriverIdentity = Boolean(
      requestData.assignedDriverId ||
      requestData.driverId ||
      requestData.assignedDriverEmail ||
      requestData.driverEmail ||
      requestData.driver?.name ||
      requestData.driverName
    );
    if (!hasDriverIdentity) {
      return null;
    }

    const driverDisplay = resolveDriverDisplayFromRequest(requestData, {
      fallbackName: 'Driver',
    });

    return (
      <View style={styles.driverInfoContainer}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            {driverDisplay.avatarUrl ? (
              <Image source={{ uri: driverDisplay.avatarUrl }} style={styles.driverAvatarImage} />
            ) : (
              <Text style={styles.driverAvatarInitials}>{driverDisplay.initials}</Text>
            )}
          </View>
          <View style={styles.driverTextInfo}>
            <Text style={styles.driverName}>{driverDisplay.name}</Text>
            <Text style={styles.vehicleInfo}>
              {requestData.vehicleType || 'Vehicle'} • {requestData.vehiclePlate || 'Plate'}
            </Text>
          </View>
          <View style={styles.driverRating}>
            <Ionicons name="star" size={14} color={colors.gold} />
            <Text style={styles.ratingText}>4.9</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !requestData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <TouchableOpacity style={styles.errorContainer} onPress={handleRefresh}>
        <Ionicons name="alert-circle" size={16} color={colors.error} />
        <Text style={styles.errorText}>Tap to retry</Text>
      </TouchableOpacity>
    );
  }

  if (!isExpanded) {
    return renderCompactView();
  }

  const expandedContent = (
    <View
      style={[
        styles.container,
        isSheetVariant ? styles.sheetContainer : null,
        {
          maxHeight: isSheetVariant ? undefined : maxExpandedHeight,
          height: isSheetVariant ? '100%' : undefined,
          paddingBottom: isSheetVariant
            ? Math.max(spacing.base, bottomInset + spacing.sm)
            : spacing.base,
        },
      ]}
      {...sheetPanHandlers}
    >
      {isSheetVariant && <View style={styles.sheetHandle} />}

      <View style={styles.header}>
        <Text style={styles.title}>Delivery Status</Text>
        <View style={styles.headerButtons}>
          {typeof onOpenChat === 'function' && !isScheduledDelivery && (
            <TouchableOpacity
              style={styles.chatHeaderButton}
              onPress={() => onOpenChat(requestData)}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
              {hasUnreadChat ? <View style={styles.chatUnreadDot} /> : null}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.collapseButton} onPress={handleCollapse}>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {renderDriverInfo()}

        <View style={styles.statusContainer}>
          {DELIVERY_STATUS_STEPS.map((step, index) => (
            <DeliveryStatusStep
              key={step.key}
              step={step}
              index={index}
              isLast={index === DELIVERY_STATUS_STEPS.length - 1}
              currentStatusIndex={currentStatusIndex}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>

        {renderPhotoButtons()}
      </ScrollView>

      {requestData && (
        <DeliveryPhotosModal
          visible={showPhotosModal}
          onClose={() => setShowPhotosModal(false)}
          pickupPhotos={requestData.pickupPhotos || []}
          deliveryPhotos={requestData.dropoffPhotos || []}
          requestDetails={requestData}
          initialTab={activePhotoType}
        />
      )}
    </View>
  );

  if (isSheetVariant) {
    return (
      <Animated.View style={[styles.sheetAnimatedWrapper, { height: sheetHeightAnim }]}>
        {expandedContent}
      </Animated.View>
    );
  }

  return expandedContent;
}
