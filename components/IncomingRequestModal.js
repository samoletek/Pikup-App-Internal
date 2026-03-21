// Incoming Request Modal component: renders its UI and handles related interactions.
import React, { useMemo, useState, useCallback } from 'react';
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
import IncomingRequestItemCard from './incomingRequestModal/IncomingRequestItemCard';
import IncomingRequestRouteCard from './incomingRequestModal/IncomingRequestRouteCard';
import IncomingRequestCustomerCard from './incomingRequestModal/IncomingRequestCustomerCard';
import {
  FULL_HEIGHT,
  SCREEN_HEIGHT,
  formatOfferTimer,
  getItemPhotoOffset,
  resolveIncomingRequestData,
  resolvePhotoUrisAsync,
  resolvePhotoSource,
  resolvePhotoUri,
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

  const handleAccept = useCallback(() => {
    onAccept(request);
  }, [request, onAccept]);

  // Photo viewer state (must be before early return to satisfy Rules of Hooks)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerPhotos, setPhotoViewerPhotos] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const [resolvedItems, setResolvedItems] = useState([]);
  const [resolvedAllPhotos, setResolvedAllPhotos] = useState([]);
  const [resolvedDisplayPhotos, setResolvedDisplayPhotos] = useState([]);

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
    earnings,
    pricing,
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

  React.useEffect(() => {
    let isCancelled = false;

    if (!request) {
      setResolvedItems([]);
      setResolvedAllPhotos([]);
      setResolvedDisplayPhotos([]);
      return undefined;
    }

    const sourceData = resolveIncomingRequestData(request, 0, 1);
    const sourceItems = sourceData.allItems;
    const sourceDisplayPhotos = sourceData.displayPhotos;

    const nextResolvedItems = sourceItems.map((item) => ({
      ...item,
      photos: (Array.isArray(item?.photos) ? item.photos : [])
        .map((photo) => resolvePhotoUri(photo))
        .filter(Boolean),
    }));
    const nextResolvedAllPhotos = nextResolvedItems.flatMap((item) => item.photos);
    const nextResolvedDisplayPhotos = nextResolvedAllPhotos.length > 0
      ? nextResolvedAllPhotos
      : (Array.isArray(sourceDisplayPhotos) ? sourceDisplayPhotos : [])
        .map((photo) => resolvePhotoUri(photo))
        .filter(Boolean);

    setResolvedItems(nextResolvedItems);
    setResolvedAllPhotos(nextResolvedAllPhotos);
    setResolvedDisplayPhotos(nextResolvedDisplayPhotos);

    const resolveSignedPhotos = async () => {
      const signedItems = await Promise.all(
        sourceItems.map(async (item) => ({
          ...item,
          photos: await resolvePhotoUrisAsync(item?.photos),
        }))
      );

      if (isCancelled) {
        return;
      }

      const signedAllPhotos = signedItems.flatMap((item) => item.photos);
      const signedDisplayPhotos = signedAllPhotos.length > 0
        ? signedAllPhotos
        : await resolvePhotoUrisAsync(sourceDisplayPhotos);

      if (isCancelled) {
        return;
      }

      setResolvedItems(signedItems);
      setResolvedAllPhotos(signedAllPhotos);
      setResolvedDisplayPhotos(signedDisplayPhotos);
    };

    void resolveSignedPhotos();

    return () => {
      isCancelled = true;
    };
  }, [request]);

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

          <IncomingRequestRouteCard
            pickup={request.pickup}
            dropoff={request.dropoff}
            pickupDetails={pickupDetails}
            dropoffDetails={dropoffDetails}
            styles={styles}
          />

          {resolvedItems.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Items ({resolvedItems.length})</Text>
              {resolvedItems.map((item, idx) => {
                const offset = getItemPhotoOffset(resolvedItems, idx);
                return (
                  <IncomingRequestItemCard
                    key={item?.id || idx}
                    item={item}
                    index={idx}
                    photoOffset={offset}
                    allPhotos={resolvedAllPhotos}
                    onOpenPhotoViewer={openPhotoViewer}
                    styles={styles}
                  />
                );
              })}
            </View>
          )}

          {resolvedAllPhotos.length === 0 && resolvedDisplayPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.base }}>
              {resolvedDisplayPhotos.map((p, i) => {
                const src = resolvePhotoSource(p);
                if (!src) return null;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => openPhotoViewer(resolvedDisplayPhotos, i)}
                    activeOpacity={0.8}
                  >
                    <Image source={src} style={styles.fallbackPhoto} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <IncomingRequestCustomerCard request={request} styles={styles} />

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
