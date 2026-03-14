import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const FULL_HEIGHT = SCREEN_HEIGHT * 0.92;
const HALF_HEIGHT = SCREEN_HEIGHT * 0.55;

const SNAP_FULL = 0;
const SNAP_HALF = FULL_HEIGHT - HALF_HEIGHT;
const SNAP_HIDDEN = FULL_HEIGHT + 50;
const SNAP_POINTS = [SNAP_FULL, SNAP_HALF];

export default function IncomingRequestModal({
  visible,
  request,
  timeRemaining = 0,
  timerTotal = 180,
  onAccept,
  onDecline,
  onMinimize,
  onSnapChange,
}) {
  const insets = useSafeAreaInsets();
  const [currentSnap, setCurrentSnap] = useState(1);
  const translateY = useRef(new Animated.Value(SNAP_HIDDEN)).current;
  const snapIndexRef = useRef(1);
  const onMinimizeRef = useRef(onMinimize);
  const onDeclineRef = useRef(onDecline);

  useEffect(() => { onMinimizeRef.current = onMinimize; }, [onMinimize]);
  useEffect(() => { onDeclineRef.current = onDecline; }, [onDecline]);

  // Entry animation
  useEffect(() => {
    if (visible && request) {
      snapIndexRef.current = 1;
      setCurrentSnap(1);
      translateY.setValue(SNAP_HIDDEN);
      Animated.spring(translateY, {
        toValue: SNAP_HALF,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
      onSnapChange?.(1);
    }
  }, [visible, request]);

  const handleAccept = useCallback(() => {
    onAccept(request);
  }, [request, onAccept]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SNAP_HIDDEN,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDeclineRef.current?.());
  }, []);

  // PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        translateY.setOffset(translateY._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gs) => {
        translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        translateY.flattenOffset();
        const currentY = translateY._value;
        const velocity = gs.vy;
        const idx = snapIndexRef.current;

        // Fast swipe down from half → minimize
        if (velocity > 1.5 && idx >= 1) {
          Animated.timing(translateY, {
            toValue: SNAP_HIDDEN, duration: 250, useNativeDriver: true,
          }).start(() => onMinimizeRef.current?.());
          return;
        }

        // Dragged far below half → minimize
        if (currentY > SNAP_HALF + (SNAP_HIDDEN - SNAP_HALF) * 0.3) {
          Animated.timing(translateY, {
            toValue: SNAP_HIDDEN, duration: 250, useNativeDriver: true,
          }).start(() => onMinimizeRef.current?.());
          return;
        }

        let target;
        if (velocity > 1.5) {
          target = Math.min(idx + 1, SNAP_POINTS.length - 1);
        } else if (velocity < -1.5) {
          target = Math.max(idx - 1, 0);
        } else {
          let minDist = Infinity;
          target = 1;
          SNAP_POINTS.forEach((pt, i) => {
            const d = Math.abs(currentY - pt);
            if (d < minDist) { minDist = d; target = i; }
          });
        }

        snapIndexRef.current = target;
        setCurrentSnap(target);
        Animated.spring(translateY, {
          toValue: SNAP_POINTS[target],
          useNativeDriver: true,
          tension: 100,
          friction: 14,
        }).start();
        onSnapChange?.(target);
      },
    })
  ).current;

  // Backdrop opacity
  const backdropOpacity = translateY.interpolate({
    inputRange: [SNAP_FULL, SNAP_HALF, SNAP_HIDDEN],
    outputRange: [0.6, 0.4, 0],
    extrapolate: 'clamp',
  });

  const formatTime = (s) => {
    const sec = Math.max(0, s);
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  // Photo viewer state (must be before early return to satisfy Rules of Hooks)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  const openPhotoViewer = useCallback((photos, index) => {
    const resolved = photos.map(p => {
      if (typeof p === 'string') return p;
      if (p?.url) return p.url;
      if (p?.uri) return p.uri;
      return null;
    }).filter(Boolean);
    if (resolved.length === 0) return;
    setPhotoViewerPhotos(resolved);
    setPhotoViewerIndex(Math.min(index, resolved.length - 1));
    setPhotoViewerVisible(true);
  }, []);

  const closePhotoViewer = useCallback(() => {
    setPhotoViewerVisible(false);
  }, []);

  if (!request) return null;

  // --- Data extraction ---
  const allItems = Array.isArray(request.items) && request.items.length > 0
    ? request.items
    : request.item ? [request.item] : [];
  const allPhotos = allItems.flatMap(i => Array.isArray(i.photos) ? i.photos : []);
  const displayPhotos = allPhotos.length > 0 ? allPhotos : Array.isArray(request.photos) ? request.photos : [];
  const earnings = request.driverPayout || request.earnings || request.price || '$0.00';
  const pricing = request.pricing || {};
  const vehicleType = request.vehicle?.type || 'Standard';
  const scheduledTime = request.scheduledTime;
  const pickupDetails = request.pickup?.details || {};
  const dropoffDetails = request.dropoff?.details || {};
  const needsHelp = pickupDetails.driverHelpsLoading || dropoffDetails.driverHelpsUnloading;
  const helpText = pickupDetails.driverHelpsLoading && dropoffDetails.driverHelpsUnloading
    ? 'Loading & Unloading'
    : pickupDetails.driverHelpsLoading ? 'Loading' : 'Unloading';
  const timerColor = timeRemaining <= 30 ? colors.error : colors.primary;
  const timerPercent = timerTotal > 0 ? (Math.max(0, timeRemaining) / timerTotal) * 100 : 0;

  // --- Render helpers ---
  const renderPhotoSource = (photo) => {
    if (typeof photo === 'string') return { uri: photo };
    if (photo?.url) return { uri: photo.url };
    if (photo?.uri) return { uri: photo.uri };
    return null;
  };

  const renderLocationDetail = (label, value) => {
    if (!value) return null;
    return <Text style={styles.locDetailText}>{label}: {value}</Text>;
  };

  const renderItemCard = (item, index, photoOffset = 0) => {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    return (
      <View key={index} style={styles.itemCard}>
        <View style={styles.itemCardHeader}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.description || item.name || item.type || `Item ${index + 1}`}
          </Text>
          {item.weightEstimate > 0 && (
            <Text style={styles.itemWeight}>{item.weightEstimate} lbs</Text>
          )}
        </View>
        {item.dimensions && <Text style={styles.itemDims}>{item.dimensions}</Text>}
        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
            {photos.map((p, i) => {
              const src = renderPhotoSource(p);
              if (!src) return null;
              return (
                <TouchableOpacity key={i} onPress={() => openPhotoViewer(allPhotos, photoOffset + i)} activeOpacity={0.8}>
                  <Image source={src} style={styles.itemPhoto} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderLocationCard = (label, location, details, dotColor) => (
    <View style={styles.locCard}>
      <View style={styles.locCardHeader}>
        <View style={[styles.locDot, { backgroundColor: dotColor }]} />
        <Text style={styles.locLabel}>{label}</Text>
      </View>
      <Text style={styles.locAddress} numberOfLines={2}>
        {location?.address || `${label} location`}
      </Text>
      {(details.locationType || details.floor || details.unitNumber) && (
        <View style={styles.locDetailsRow}>
          {renderLocationDetail('Type', details.locationType)}
          {renderLocationDetail('Unit', details.unitNumber)}
          {renderLocationDetail('Floor', details.floor)}
          {details.hasElevator === true && <Text style={styles.locDetailText}>Elevator: Yes</Text>}
          {details.hasElevator === false && (
            <Text style={[styles.locDetailText, { color: colors.warning }]}>No elevator</Text>
          )}
        </View>
      )}
      {details.notes && (
        <Text style={styles.locNotes} numberOfLines={2}>Note: {details.notes}</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: FULL_HEIGHT,
            top: SCREEN_HEIGHT - FULL_HEIGHT,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* ===== DRAG AREA ===== */}
        <View {...panResponder.panHandlers}>
          <View style={styles.handleArea}>
            <View style={styles.handleBar} />
          </View>

          {/* Timer */}
          <View style={styles.timerSection}>
            <View style={styles.timerRow}>
              <Ionicons name="timer-outline" size={22} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>
                {formatTime(timeRemaining)}
              </Text>
            </View>
            <View style={styles.timerBar}>
              <View style={[styles.timerFill, {
                width: `${timerPercent}%`,
                backgroundColor: timerColor,
              }]} />
            </View>
          </View>

          {/* Earnings + Vehicle */}
          <View style={styles.earningsRow}>
            <View>
              <Text style={styles.earningsAmount}>{earnings}</Text>
              {pricing.laborFee > 0 && (
                <Text style={styles.earningsNote}>
                  incl. ${Number(pricing.laborFee).toFixed(2)} labor
                </Text>
              )}
            </View>
            <View style={styles.vehicleBadge}>
              <Ionicons name="car-outline" size={16} color={colors.warning} />
              <Text style={styles.vehicleText}>{vehicleType}</Text>
            </View>
          </View>

          {/* Addresses (compact) */}
          <View style={styles.addressesSection}>
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {request.pickup?.address || 'Pickup location'}
              </Text>
            </View>
            <View style={styles.addressConnector} />
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: colors.success }]} />
              <Text style={styles.addressText} numberOfLines={1}>
                {request.dropoff?.address || 'Dropoff location'}
              </Text>
            </View>
          </View>

          {/* Driver help */}
          {needsHelp && (
            <View style={styles.helpBadge}>
              <Ionicons name="hand-left-outline" size={16} color={colors.warning} />
              <Text style={styles.helpText}>Help needed: {helpText}</Text>
            </View>
          )}
        </View>

        {/* ===== BUTTONS ===== */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.declineBtn} onPress={dismiss} activeOpacity={0.8}>
            <Text style={styles.declineTxt}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.acceptGrad}
            >
              <Text style={styles.acceptTxt}>Accept</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ===== SCROLLABLE DETAILS (visible at full) ===== */}
        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={currentSnap === 0}
          nestedScrollEnabled={true}
        >
          <View style={styles.detailsHint}>
            <View style={styles.hintLine} />
            <Text style={styles.hintText}>Order Details</Text>
            <View style={styles.hintLine} />
          </View>

          {scheduledTime && (
            <View style={styles.scheduledBadge}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.scheduledText}>
                {new Date(scheduledTime).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          {renderLocationCard('Pickup', request.pickup, pickupDetails, colors.primary)}
          {renderLocationCard('Drop-off', request.dropoff, dropoffDetails, colors.success)}

          {allItems.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Items ({allItems.length})</Text>
              {allItems.map((item, idx) => {
                const offset = allItems.slice(0, idx).reduce(
                  (sum, prev) => sum + (Array.isArray(prev.photos) ? prev.photos.length : 0), 0
                );
                return renderItemCard(item, idx, offset);
              })}
            </View>
          )}

          {allPhotos.length === 0 && displayPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
              {displayPhotos.map((p, i) => {
                const src = renderPhotoSource(p);
                if (!src) return null;
                return (
                  <TouchableOpacity key={i} onPress={() => openPhotoViewer(displayPhotos, i)} activeOpacity={0.8}>
                    <Image source={src} style={styles.fallbackPhoto} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.customerCard}>
            <Image
              source={
                request.customer?.photo
                  ? { uri: request.customer.photo }
                  : require('../assets/profile.png')
              }
              style={styles.customerPhoto}
            />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {request.customerName || (request.customerEmail ? request.customerEmail.split('@')[0] : 'Customer')}
              </Text>
              <View style={styles.ratingRow}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name="star"
                    size={12}
                    color={i < Math.floor(request.customer?.rating || 5) ? colors.gold : colors.border.default}
                  />
                ))}
                <Text style={styles.ratingText}>{request.customer?.rating || '5.0'}</Text>
              </View>
            </View>
          </View>

          {(pricing.basePrice || pricing.serviceFee || pricing.tax) && (
            <View style={styles.priceCard}>
              <Text style={styles.detailTitle}>Price Breakdown</Text>
              {pricing.basePrice > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Base price</Text>
                  <Text style={styles.priceVal}>${Number(pricing.basePrice).toFixed(2)}</Text>
                </View>
              )}
              {pricing.laborFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Labor fee</Text>
                  <Text style={styles.priceVal}>${Number(pricing.laborFee).toFixed(2)}</Text>
                </View>
              )}
              {pricing.serviceFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Service fee</Text>
                  <Text style={styles.priceVal}>${Number(pricing.serviceFee).toFixed(2)}</Text>
                </View>
              )}
              {pricing.tax > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Tax</Text>
                  <Text style={styles.priceVal}>${Number(pricing.tax).toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.priceRow, styles.priceTotalRow]}>
                <Text style={styles.priceTotalLabel}>Total</Text>
                <Text style={styles.priceTotalVal}>{earnings}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Full-screen photo viewer */}
      {photoViewerVisible && (
        <TouchableWithoutFeedback onPress={closePhotoViewer}>
          <View style={styles.photoViewerOverlay}>
            <FlatList
              data={photoViewerPhotos}
              horizontal
              pagingEnabled
              initialScrollIndex={photoViewerIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setPhotoViewerIndex(page);
              }}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableWithoutFeedback onPress={closePhotoViewer}>
                  <View style={styles.photoViewerPage}>
                    <TouchableWithoutFeedback>
                      <Image source={{ uri: item }} style={styles.photoViewerImage} resizeMode="contain" />
                    </TouchableWithoutFeedback>
                  </View>
                </TouchableWithoutFeedback>
              )}
            />
            {photoViewerPhotos.length > 1 && (
              <View style={styles.photoViewerDots}>
                {photoViewerPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.photoViewerDot,
                      i === photoViewerIndex && styles.photoViewerDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.photoViewerClose} onPress={closePhotoViewer}>
              <Ionicons name="close" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: spacing.md,
    elevation: 10,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  handleBar: {
    width: spacing.xxxl - spacing.sm,
    height: spacing.xs,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.border.inverse,
  },
  timerSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timerText: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
    letterSpacing: 1,
  },
  timerBar: {
    height: spacing.sm - 2,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: borderRadius.xs,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  earningsAmount: {
    fontSize: typography.fontSize.xxxl + 4,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  earningsNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs / 2,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
  },
  vehicleText: {
    color: colors.warning,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  addressesSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm - 2,
  },
  addressDot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: spacing.md / 2,
    marginRight: spacing.md,
  },
  addressText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  addressConnector: {
    width: 2,
    height: spacing.base,
    backgroundColor: colors.border.strong,
    marginLeft: spacing.xs + 1,
  },
  helpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  helpText: {
    color: colors.warning,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  declineBtn: {
    flex: 1,
    height: spacing.xxxl + spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  declineTxt: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  acceptBtn: {
    flex: 1,
    height: spacing.xxxl + spacing.base,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  acceptGrad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptTxt: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  detailsScroll: {
    flex: 1,
  },
  detailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hintLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.strong,
  },
  hintText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginHorizontal: spacing.md,
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  scheduledText: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  locCard: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  locCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  locLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locAddress: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  locDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  locDetailText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  locNotes: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  detailSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  detailTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  itemWeight: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  itemDims: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  itemPhoto: {
    width: spacing.xxxl + spacing.md,
    height: spacing.xxxl + spacing.md,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.background.elevated,
  },
  fallbackPhoto: {
    width: spacing.xxxl + spacing.xl,
    height: spacing.xxxl + spacing.xl,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    marginLeft: spacing.lg,
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  customerPhoto: {
    width: spacing.xxxl - spacing.sm,
    height: spacing.xxxl - spacing.sm,
    borderRadius: (spacing.xxxl - spacing.sm) / 2,
    backgroundColor: colors.background.elevated,
  },
  customerInfo: {
    marginLeft: spacing.md,
  },
  customerName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
  },
  priceCard: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  priceLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  priceVal: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  priceTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    paddingTop: spacing.sm,
    marginBottom: 0,
  },
  priceTotalLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  priceTotalVal: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  photoViewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    zIndex: 1000,
    justifyContent: 'center',
  },
  photoViewerPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: SCREEN_WIDTH - spacing.xxl * 2,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: borderRadius.md,
  },
  photoViewerDots: {
    position: 'absolute',
    bottom: spacing.xxxl + spacing.xxl,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoViewerDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: borderRadius.xs,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  photoViewerDotActive: {
    backgroundColor: colors.white,
    width: spacing.xl,
  },
  photoViewerClose: {
    position: 'absolute',
    top: spacing.xxxl + spacing.md,
    right: spacing.lg,
    width: spacing.xxxl + spacing.sm,
    height: spacing.xxxl + spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
