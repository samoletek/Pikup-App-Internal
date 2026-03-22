// Incoming Request Modal component: renders its UI and handles related interactions.
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './IncomingRequestModal.styles';
import { colors, spacing } from '../styles/theme';
import useIncomingRequestSheet from '../hooks/useIncomingRequestSheet';
import IncomingRequestPhotoViewer from './incomingRequestModal/IncomingRequestPhotoViewer';
import IncomingRequestLocationCard from './incomingRequestModal/IncomingRequestLocationCard';
import IncomingRequestItemCard from './incomingRequestModal/IncomingRequestItemCard';
import {
  FULL_HEIGHT,
  SCREEN_HEIGHT,
  formatOfferTimer,
  getItemPhotoOffset,
  resolveIncomingRequestData,
  resolvePhotoSource,
  resolvePhotoUri,
} from './incomingRequestModal/incomingRequestModal.utils';
import { resolveCustomerDisplayFromRequest } from '../utils/profileDisplay';

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
  const {
    currentSnap,
    translateY,
    backdropOpacity,
    dismiss,
    panHandlers,
  } = useIncomingRequestSheet({
    visible,
    request,
    onDecline,
    onMinimize,
    onSnapChange,
  });

  const handleAccept = useCallback(() => {
    onAccept(request);
  }, [request, onAccept]);

  // Photo viewer state (must be before early return to satisfy Rules of Hooks)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  const openPhotoViewer = useCallback((photos, index) => {
    const resolved = photos.map((photo) => resolvePhotoUri(photo)).filter(Boolean);
    if (resolved.length === 0) return;
    setPhotoViewerPhotos(resolved);
    setPhotoViewerIndex(Math.min(index, resolved.length - 1));
    setPhotoViewerVisible(true);
  }, []);

  const closePhotoViewer = useCallback(() => {
    setPhotoViewerVisible(false);
  }, []);

  const {
    allItems,
    allPhotos,
    displayPhotos,
    earnings,
    vehicleType,
    scheduledTime,
    pickupDetails,
    dropoffDetails,
    needsHelp,
    helpText,
    timerColor,
    timerPercent,
  } = useMemo(
    () => resolveIncomingRequestData(request, timeRemaining, timerTotal),
    [request, timeRemaining, timerTotal]
  );
  const customerDisplay = useMemo(
    () => resolveCustomerDisplayFromRequest(request, { fallbackName: 'Customer' }),
    [request]
  );
  const [customerAvatarLoadError, setCustomerAvatarLoadError] = useState(false);
  const customerAvatarUrl = customerAvatarLoadError ? null : customerDisplay.avatarUrl;

  useEffect(() => {
    setCustomerAvatarLoadError(false);
  }, [customerDisplay.avatarUrl]);

  if (!request) return null;

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
        <View {...panHandlers}>
          <View style={styles.handleArea}>
            <View style={styles.handleBar} />
          </View>

          {/* Timer */}
          <View style={styles.timerSection}>
            <View style={styles.timerRow}>
              <Ionicons name="timer-outline" size={22} color={timerColor} />
              <Text style={[styles.timerText, { color: timerColor }]}>
                {formatOfferTimer(timeRemaining)}
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
          <TouchableOpacity style={styles.declineBtn} onPress={dismiss} activeOpacity={0.85}>
            <Text style={styles.declineTxt}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85}>
            <Text style={styles.acceptTxt}>Accept</Text>
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

          <IncomingRequestLocationCard
            label="Pickup"
            location={request.pickup}
            details={pickupDetails}
            dotColor={colors.primary}
            styles={styles}
          />
          <IncomingRequestLocationCard
            label="Drop-off"
            location={request.dropoff}
            details={dropoffDetails}
            dotColor={colors.success}
            styles={styles}
          />

          {allItems.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Items ({allItems.length})</Text>
              {allItems.map((item, idx) => {
                const offset = getItemPhotoOffset(allItems, idx);
                return (
                  <IncomingRequestItemCard
                    key={item?.id || idx}
                    item={item}
                    index={idx}
                    photoOffset={offset}
                    allPhotos={allPhotos}
                    onOpenPhotoViewer={openPhotoViewer}
                    styles={styles}
                  />
                );
              })}
            </View>
          )}

          {allPhotos.length === 0 && displayPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
              {displayPhotos.map((p, i) => {
                const src = resolvePhotoSource(p);
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
            {customerAvatarUrl ? (
              <Image
                source={{ uri: customerAvatarUrl }}
                style={styles.customerPhoto}
                onError={() => setCustomerAvatarLoadError(true)}
              />
            ) : (
              <View style={styles.customerPhotoFallback}>
                <Text style={styles.customerPhotoFallbackText}>{customerDisplay.initials}</Text>
              </View>
            )}
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {customerDisplay.name}
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

          {Boolean(earnings) && (
            <View style={styles.priceCard}>
              <Text style={styles.detailTitle}>Payout Summary</Text>
              <View style={[styles.priceRow, styles.priceTotalRow]}>
                <Text style={styles.priceTotalLabel}>Your payout</Text>
                <Text style={styles.priceTotalVal}>{earnings}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <IncomingRequestPhotoViewer
        visible={photoViewerVisible}
        photos={photoViewerPhotos}
        currentIndex={photoViewerIndex}
        onIndexChange={setPhotoViewerIndex}
        onClose={closePhotoViewer}
      />
    </Modal>
  );
}
