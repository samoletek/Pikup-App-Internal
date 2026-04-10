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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from './IncomingRequestModal.styles';
import { colors, spacing } from '../styles/theme';
import useIncomingRequestSheet from '../hooks/useIncomingRequestSheet';
import IncomingRequestPhotoViewer from './incomingRequestModal/IncomingRequestPhotoViewer';
import IncomingRequestLocationCard from './incomingRequestModal/IncomingRequestLocationCard';
import IncomingRequestItemCard from './incomingRequestModal/IncomingRequestItemCard';
import IncomingRequestCustomerCard from './incomingRequestModal/IncomingRequestCustomerCard';
import {
  FULL_HEIGHT,
  SCREEN_HEIGHT,
  formatOfferTimer,
  getItemPhotoOffset,
  resolveIncomingRequestData,
  resolvePhotoUrisAsync,
  resolvePhotoSource,
} from './incomingRequestModal/incomingRequestModal.utils';

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

  const [pendingAction, setPendingAction] = useState(null);
  const isAccepting = pendingAction === 'accept';
  const isDeclining = pendingAction === 'decline';
  const isActionPending = Boolean(pendingAction);

  useEffect(() => {
    if (!visible || !request?.id) {
      setPendingAction(null);
    }
  }, [request?.id, visible]);

  const handleAccept = useCallback(async () => {
    if (isActionPending || !request) {
      return;
    }

    setPendingAction('accept');
    try {
      await Promise.resolve(onAccept?.(request));
    } finally {
      setPendingAction(null);
    }
  }, [isActionPending, onAccept, request]);

  const handleDecline = useCallback(() => {
    if (isActionPending) {
      return;
    }

    setPendingAction('decline');
    dismiss();
  }, [dismiss, isActionPending]);

  // Photo viewer state (must be before early return to satisfy Rules of Hooks)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [resolvedItems, setResolvedItems] = useState([]);
  const [resolvedAllPhotos, setResolvedAllPhotos] = useState([]);
  const [resolvedDisplayPhotos, setResolvedDisplayPhotos] = useState([]);
  const [photosResolved, setPhotosResolved] = useState(false);

  const openPhotoViewer = useCallback(async (photos, index) => {
    const resolved = await resolvePhotoUrisAsync(photos);
    if (resolved.length === 0) {
      return;
    }
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

  useEffect(() => {
    if (!request) {
      setResolvedItems([]);
      setResolvedAllPhotos([]);
      setResolvedDisplayPhotos([]);
      setPhotosResolved(true);
      return undefined;
    }

    let isCancelled = false;
    setPhotosResolved(false);

    const loadResolvedPhotos = async () => {
      try {
        const sourceData = resolveIncomingRequestData(request);
        const sourceItems = Array.isArray(sourceData.allItems) ? sourceData.allItems : [];
        const sourceDisplayPhotos = Array.isArray(sourceData.displayPhotos)
          ? sourceData.displayPhotos
          : [];

        const signedItemPhotos = await Promise.all(
          sourceItems.map((item) => resolvePhotoUrisAsync(item?.photos || []))
        );
        const nextItems = sourceItems.map((item, index) => ({
          ...item,
          photos: signedItemPhotos[index] || [],
        }));
        const nextAllPhotos = nextItems.flatMap((item) => item.photos);
        const nextDisplayPhotos = nextAllPhotos.length > 0
          ? nextAllPhotos
          : await resolvePhotoUrisAsync(sourceDisplayPhotos);

        if (isCancelled) {
          return;
        }

        setResolvedItems(nextItems);
        setResolvedAllPhotos(nextAllPhotos);
        setResolvedDisplayPhotos(nextDisplayPhotos);
      } finally {
        if (!isCancelled) {
          setPhotosResolved(true);
        }
      }
    };

    void loadResolvedPhotos();

    return () => {
      isCancelled = true;
    };
  }, [request]);

  if (!request) return null;

  const modalItems = photosResolved ? resolvedItems : allItems;
  const modalAllPhotos = photosResolved ? resolvedAllPhotos : allPhotos;
  const modalDisplayPhotos = photosResolved ? resolvedDisplayPhotos : displayPhotos;

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
          <TouchableOpacity
            style={[styles.declineBtn, isActionPending && styles.actionBtnDisabled]}
            onPress={handleDecline}
            activeOpacity={0.85}
            disabled={isActionPending}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.declineTxt}>Decline</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, isActionPending && styles.actionBtnDisabled]}
            onPress={handleAccept}
            activeOpacity={0.85}
            disabled={isActionPending}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.acceptTxt}>Accept</Text>
            )}
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

          {modalItems.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Items ({modalItems.length})</Text>
              {modalItems.map((item, idx) => {
                const offset = getItemPhotoOffset(modalItems, idx);
                return (
                  <IncomingRequestItemCard
                    key={item?.id || idx}
                    item={item}
                    index={idx}
                    photoOffset={offset}
                    allPhotos={modalAllPhotos}
                    onOpenPhotoViewer={openPhotoViewer}
                    styles={styles}
                  />
                );
              })}
            </View>
          )}

          {modalAllPhotos.length === 0 && modalDisplayPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
              {modalDisplayPhotos.map((p, i) => {
                const src = resolvePhotoSource(p);
                if (!src) return null;
                return (
                  <TouchableOpacity key={i} onPress={() => openPhotoViewer(modalDisplayPhotos, i)} activeOpacity={0.8}>
                    <Image source={src} style={styles.fallbackPhoto} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <IncomingRequestCustomerCard request={request} styles={styles} />

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
