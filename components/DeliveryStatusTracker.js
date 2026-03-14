import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import DeliveryPhotosModal from './DeliveryPhotosModal';
import { TRIP_STATUS } from '../constants/tripStatus';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../styles/theme';

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
  const { getRequestById } = useAuth();

  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPhotosModal, setShowPhotosModal] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState('pickup');
  const [isExpanded, setIsExpanded] = useState(expanded);
  const refreshIntervalRef = useRef(null);
  const isSheetVariant = variant === 'sheet';
  const DRAG_THRESHOLD = 28;
  const DEFAULT_COLLAPSED_HEIGHT = 76;
  const [collapsedSheetHeight, setCollapsedSheetHeight] = useState(DEFAULT_COLLAPSED_HEIGHT);
  const [isSheetClosing, setIsSheetClosing] = useState(false);
  const isExpandedRef = useRef(Boolean(expanded));
  const sheetAnimationRef = useRef(null);
  const sheetHeightAnim = useRef(
    new Animated.Value(Boolean(expanded) ? maxExpandedHeight : DEFAULT_COLLAPSED_HEIGHT)
  ).current;

  const animateSheetHeight = useCallback((toValue, options = {}) => {
    const { type = 'expand', onComplete } = options;

    if (!isSheetVariant) {
      onComplete?.(true);
      return;
    }

    if (sheetAnimationRef.current) {
      sheetAnimationRef.current.stop();
    }

    const animation =
      type === 'collapse'
        ? Animated.timing(sheetHeightAnim, {
          toValue,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
        : Animated.spring(sheetHeightAnim, {
          toValue,
          useNativeDriver: false,
          tension: 100,
          friction: 12,
        });

    sheetAnimationRef.current = animation;
    animation.start(({ finished }) => {
      if (sheetAnimationRef.current === animation) {
        sheetAnimationRef.current = null;
      }
      onComplete?.(finished);
    });
  }, [isSheetVariant, sheetHeightAnim]);

  // Status steps in order with modern labels
  const statusSteps = [
    { key: TRIP_STATUS.ACCEPTED, label: 'Driver Confirmed', icon: 'checkmark-circle', description: 'Driver is preparing for your pickup' },
    { key: TRIP_STATUS.IN_PROGRESS, label: 'On the way to you', icon: 'car-sport', description: 'Driver is heading to your location' },
    { key: TRIP_STATUS.ARRIVED_AT_PICKUP, label: 'Driver arrived', icon: 'location', description: 'Driver has arrived at pickup location' },
    { key: TRIP_STATUS.PICKED_UP, label: 'Package collected', icon: 'cube', description: 'Your items are secured for transport' },
    { key: TRIP_STATUS.EN_ROUTE_TO_DROPOFF, label: 'On the way to destination', icon: 'navigate', description: 'Your package is in transit' },
    { key: TRIP_STATUS.ARRIVED_AT_DROPOFF, label: 'Arrived at destination', icon: 'home', description: 'Driver has arrived at delivery location' },
    { key: TRIP_STATUS.COMPLETED, label: 'Delivered', icon: 'checkmark-circle', description: 'Your delivery is complete' },
  ];

  const fetchRequestData = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const data = await getRequestById(requestId);
      setRequestData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching request data:', err);
      setError('Unable to load delivery status');
    } finally {
      setLoading(false);
    }
  }, [getRequestById, requestId]);

  useEffect(() => {
    if (requestId) {
      fetchRequestData();

      // Set up polling for updates every 15 seconds
      const interval = setInterval(() => {
        fetchRequestData(false); // Don't show loading indicator for refreshes
      }, 15000);

      refreshIntervalRef.current = interval;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchRequestData, requestId]);

  useEffect(() => {
    const normalizedExpanded = Boolean(expanded);
    if (normalizedExpanded === isExpanded) {
      return;
    }

    if (normalizedExpanded) {
      setIsSheetClosing(false);
    } else if (isSheetVariant) {
      setIsSheetClosing(true);
    }
    setIsExpanded(normalizedExpanded);
  }, [expanded, isExpanded, isSheetVariant, requestId]);

  useEffect(() => {
    isExpandedRef.current = Boolean(isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    if (!isSheetVariant) {
      return undefined;
    }

    const expandedHeight = Math.max(maxExpandedHeight, collapsedSheetHeight);

    if (isExpanded) {
      setIsSheetClosing(false);
      animateSheetHeight(expandedHeight, { type: 'expand' });
      return undefined;
    }

    setIsSheetClosing(true);
    animateSheetHeight(collapsedSheetHeight, {
      type: 'collapse',
      onComplete: (finished) => {
        if (!finished) return;
        if (!isExpandedRef.current) {
          setIsSheetClosing(false);
        }
      },
    });

    return undefined;
  }, [
    animateSheetHeight,
    collapsedSheetHeight,
    isExpanded,
    isSheetVariant,
    maxExpandedHeight,
  ]);

  useEffect(() => {
    if (!isSheetVariant) {
      return undefined;
    }

    return () => {
      if (sheetAnimationRef.current) {
        sheetAnimationRef.current.stop();
        sheetAnimationRef.current = null;
      }
    };
  }, [isSheetVariant]);

  const setExpandedState = useCallback((nextExpanded) => {
    const normalizedValue = Boolean(nextExpanded);
    if (normalizedValue === isExpanded) {
      return;
    }

    if (normalizedValue) {
      setIsSheetClosing(false);
    } else if (isSheetVariant) {
      setIsSheetClosing(true);
    }
    setIsExpanded(normalizedValue);
    if (typeof onExpandedChange === 'function') {
      onExpandedChange(normalizedValue);
    }
  }, [isExpanded, isSheetVariant, onExpandedChange]);

  const toggleExpanded = useCallback(() => {
    if (onViewFullTracker) {
      onViewFullTracker();
      return;
    }
    setExpandedState(!isExpanded);
  }, [isExpanded, onViewFullTracker, setExpandedState]);

  const handleCollapse = useCallback(() => {
    setExpandedState(false);
  }, [setExpandedState]);

  const sheetPanHandlers = useMemo(() => {
    if (!isSheetVariant) {
      return {};
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy <= -DRAG_THRESHOLD) {
          setExpandedState(true);
          return;
        }

        if (gestureState.dy >= DRAG_THRESHOLD) {
          setExpandedState(false);
        }
      },
    }).panHandlers;
  }, [isSheetVariant, setExpandedState]);

  // When delivery is completed, notify parent component
  useEffect(() => {
    if (requestData && requestData.status === TRIP_STATUS.COMPLETED && onDeliveryComplete) {
      onDeliveryComplete(requestData);

      // Stop polling when delivery is complete
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, [requestData, onDeliveryComplete]);

  const handleRefresh = () => {
    fetchRequestData();
  };

  const handleViewPhotos = (type) => {
    setActivePhotoType(type);
    setShowPhotosModal(true);
  };

  const getCurrentStatusIndex = () => {
    if (!requestData || !requestData.status) return 0;

    const currentStatus = requestData.status;
    const index = statusSteps.findIndex(step => step.key === currentStatus);
    return index >= 0 ? index : 0;
  };

  const formatETA = () => {
    if (!requestData) return '-- min';

    // Calculate ETA based on status
    const currentStatus = getCurrentStatusIndex();

    if (currentStatus === 0) return '10-15 min';
    if (currentStatus === 1) return '5-10 min';
    if (currentStatus === 2) return 'Arrived';
    if (currentStatus === 3) return '15-20 min';
    if (currentStatus === 4) return '5-10 min';
    if (currentStatus === 5) return 'Arrived';
    return 'Delivered';
  };

  const isScheduledDelivery = Boolean(
    requestData?.scheduledTime ||
    requestData?.scheduled_time ||
    requestData?.scheduleType === 'scheduled' ||
    requestData?.dispatchRequirements?.scheduleType === 'scheduled' ||
    requestData?.dispatch_requirements?.scheduleType === 'scheduled'
  );

  const renderCompactView = () => {
    if (!requestData) return null;

    const currentIndex = getCurrentStatusIndex();
    const currentStep = statusSteps[currentIndex] || statusSteps[0];
    const shortDeliveryLabel = requestData.item?.description || requestData.vehicleType || 'Delivery in progress';

    if (isSheetVariant) {
      const handleCompactLayout = (event) => {
        const measuredHeight = Math.ceil(event?.nativeEvent?.layout?.height || 0);
        if (!measuredHeight || measuredHeight === collapsedSheetHeight) {
          return;
        }

        setCollapsedSheetHeight(measuredHeight);
        if (!isExpanded && !isSheetClosing) {
          sheetHeightAnim.setValue(measuredHeight);
        }
      };

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
                onPress={onViewFullTracker || toggleExpanded}
                activeOpacity={0.9}
              >
                <View style={styles.compactContent}>
                  <View style={styles.compactIconContainer}>
                    <Ionicons name={currentStep.icon} size={16} color={colors.white} />
                  </View>
                  <View style={[styles.compactTextContainer, styles.sheetCompactTextContainer]}>
                    <Text style={styles.compactStatus}>{currentStep.label}</Text>
                    <Text style={styles.compactInfo}>
                      {shortDeliveryLabel} • ETA: {formatETA()}
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
      <TouchableOpacity style={styles.compactContainer} onPress={onViewFullTracker || toggleExpanded} activeOpacity={0.9}>
        <View style={styles.compactContent}>
          <View style={styles.compactIconContainer}>
            <Ionicons name={currentStep.icon} size={16} color={colors.white} />
          </View>
          <View style={styles.compactTextContainer}>
            <Text style={styles.compactStatus}>{currentStep.label}</Text>
            <Text style={styles.compactInfo}>
              {shortDeliveryLabel} • ETA: {formatETA()}
            </Text>
          </View>
        </View>
        <View style={styles.tapIndicator}>
          <Ionicons name="chevron-up" size={16} color={colors.text.secondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusStep = (step, index) => {
    const currentIndex = getCurrentStatusIndex();
    const isActive = index <= currentIndex;
    const isCurrent = index === currentIndex;

    return (
      <View key={step.key} style={styles.statusStep}>
        <View style={styles.statusIconContainer}>
          <View style={[
            styles.statusDot,
            isActive ? styles.activeDot : styles.inactiveDot,
            isCurrent ? styles.currentDot : null
          ]}>
            <Ionicons
              name={step.icon}
              size={16}
              color={isActive ? colors.white : colors.text.subtle}
            />
          </View>

          {index < statusSteps.length - 1 && (
            <View style={[
              styles.statusLine,
              index < currentIndex ? styles.activeLine : styles.inactiveLine
            ]} />
          )}
        </View>

        <View style={styles.statusTextContainer}>
          <Text style={[
            styles.statusLabel,
            isActive ? styles.activeLabel : styles.inactiveLabel,
            isCurrent ? styles.currentLabel : null
          ]}>
            {step.label}
          </Text>

          {isCurrent && (
            <Text style={styles.statusDescription}>{step.description}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderPhotoButtons = () => {
    const hasPickupPhotos = requestData?.pickupPhotos && requestData.pickupPhotos.length > 0;
    const hasDeliveryPhotos = requestData?.dropoffPhotos && requestData.dropoffPhotos.length > 0;
    const currentIndex = getCurrentStatusIndex();

    if (currentIndex < 3 || (!hasPickupPhotos && !hasDeliveryPhotos)) {
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
    if (!requestData || !requestData.assignedDriverEmail) {
      return null;
    }

    const driverName = requestData.assignedDriverEmail.split('@')[0];

    return (
      <View style={styles.driverInfoContainer}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Ionicons name="person" size={18} color={colors.white} />
          </View>
          <View style={styles.driverTextInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
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
          {statusSteps.map(renderStatusStep)}
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
    ...shadows.lg,
  },
  compactContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    minHeight: 56,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.lg,
  },
  sheetCompactContainer: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    ...shadows.lg,
  },
  sheetAnimatedWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  sheetAnimatedWrapperCompact: {
    justifyContent: 'flex-end',
  },
  sheetAnimatedWrapperClosing: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  sheetCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetCompactMain: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border.strong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 2,
  },
  compactTextContainer: {
    flex: 1,
  },
  sheetCompactTextContainer: {
    marginTop: 5,
  },
  compactStatus: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.base,
  },
  compactInfo: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  chatHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'relative',
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  chatActionButton: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  chatUnreadDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.background.secondary,
  },
  chatUnreadDotCompact: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.background.secondary,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  collapseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyScroll: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: spacing.xs,
  },
  driverInfoContainer: {
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverTextInfo: {
    flex: 1,
    marginLeft: 10,
  },
  driverName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  vehicleInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  tapIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    width: 30,
    height: 30,
  },
  sheetContainer: {
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
  },
  statusContainer: {
    marginBottom: spacing.base,
  },
  statusStep: {
    flexDirection: 'row',
    marginBottom: spacing.base,
  },
  statusIconContainer: {
    alignItems: 'center',
    marginRight: spacing.base,
  },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  inactiveDot: {
    backgroundColor: colors.border.strong,
  },
  currentDot: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  activeLabel: {
    color: colors.text.primary,
  },
  inactiveLabel: {
    color: colors.text.subtle,
  },
  currentLabel: {
    fontWeight: typography.fontWeight.bold,
  },
  statusDescription: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  statusLine: {
    width: 2,
    height: 24,
  },
  activeLine: {
    backgroundColor: colors.primary,
  },
  inactiveLine: {
    backgroundColor: colors.border.strong,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.full,
  },
  photoButtonText: {
    color: colors.text.primary,
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  loadingContainer: {
    minHeight: 56,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    flexDirection: 'row',
    ...shadows.lg,
  },
  loadingText: {
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  errorContainer: {
    minHeight: 56,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    flexDirection: 'row',
    ...shadows.lg,
  },
  errorText: {
    color: colors.error,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
  },
});
