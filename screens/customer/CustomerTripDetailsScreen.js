import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../../components/ScreenHeader';
import MediaViewer from '../../components/MediaViewer';
import AppButton from '../../components/ui/AppButton';
import PhotoGallerySection from '../../components/trip/PhotoGallerySection';
import TripHeroCard from '../../components/trip/TripHeroCard';
import TripProgressSection from '../../components/trip/TripProgressSection';
import TripDriverRatingSection from '../../components/trip/TripDriverRatingSection';
import TripInfoSection from '../../components/trip/TripInfoSection';
import TripCancellationSection from '../../components/trip/TripCancellationSection';
import styles from './CustomerTripDetailsScreen.styles';
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
  useTripActions,
} from '../../contexts/AuthContext';
import { TRIP_STATUS } from '../../constants/tripStatus';
import { colors, spacing } from '../../styles/theme';
import useCustomerTripDetailsData from '../../hooks/useCustomerTripDetailsData';
import useCustomerTripRating from '../../hooks/useCustomerTripRating';
import useTripConversationUnread from '../../hooks/useTripConversationUnread';
import { logger } from '../../services/logger';
import {
  resolveDisplayNameFromUser,
  resolveDriverNameFromRequest,
} from '../../utils/participantIdentity';

export default function CustomerTripDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser, refreshProfile } = useAuthIdentity();
  const { cancelOrder, getRequestById } = useTripActions();
  const {
    createConversation,
    getConversations,
    subscribeToConversations,
    markMessageAsRead,
  } = useMessagingActions();
  const { getUserProfile, submitTripRating } = useProfileActions();

  const tripSummary = route?.params?.tripSummary || null;
  const initialSnapshot = route?.params?.tripSnapshot || tripSummary || null;
  const tripId = route?.params?.tripId || initialSnapshot?.id || null;
  const isMockTrip = String(tripId || '').startsWith('mock-');

  const {
    tripData,
    loading,
    refreshing,
    displayTrip,
    pickupPhotoUris,
    dropoffPhotoUris,
    loadTrip,
  } = useCustomerTripDetailsData({
    currentUser,
    getRequestById,
    getUserProfile,
    initialSnapshot,
    isMockTrip,
    tripId,
    tripSummary,
  });

  const currentUserId = currentUser?.uid || currentUser?.id || null;
  const isTripCompleted = displayTrip.status === TRIP_STATUS.COMPLETED;
  const isChatAvailable =
    Boolean(displayTrip.id) &&
    Boolean(displayTrip.driverId) &&
    displayTrip.status !== TRIP_STATUS.CANCELLED;

  const {
    rating,
    setRating,
    selectedBadges,
    isSubmittingRating,
    isRatingReadOnly,
    canSubmitRating,
    toggleBadge,
    submitDriverRating,
    tip,
    customTip,
    showCustomTip,
    selectTipPreset,
    openCustomTip,
    updateCustomTip,
    tipPresets,
    maxTipAmount,
  } = useCustomerTripRating({
    currentUserId,
    driverId: displayTrip.driverId,
    isTripCompleted,
    refreshProfile,
    submitTripRating,
    tripId: displayTrip.id,
    orderTotal: displayTrip.priceWithoutInsurance,
  });
  const { hasUnreadChat, setHasUnreadChat } = useTripConversationUnread({
    currentUserId,
    getConversations,
    subscribeToConversations,
    conversationUserType: 'customer',
    activeRequestId: displayTrip.id,
    activeRequestCustomerId: currentUserId,
    activeRequestDriverId: displayTrip.driverId,
  });

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [isCancellingTrip, setIsCancellingTrip] = useState(false);

  const handleOpenPhotoViewer = useCallback((photos, index = 0) => {
    if (!Array.isArray(photos) || photos.length === 0) {
      return;
    }

    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), photos.length - 1);
    setViewerPhotos(photos);
    setViewerStartIndex(safeIndex);
    setViewerVisible(true);
  }, []);

  const handleClosePhotoViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerPhotos([]);
    setViewerStartIndex(0);
  }, []);
  const handleOpenDriverChat = useCallback(async () => {
    if (isOpeningChat) {
      return;
    }

    if (!currentUserId || !displayTrip.id) {
      Alert.alert('Unable to open chat', 'Trip details are still syncing. Please try again.');
      return;
    }

    setIsOpeningChat(true);

    try {
      setHasUnreadChat(false);

      let latestTrip = null;
      try {
        latestTrip = await getRequestById(displayTrip.id);
      } catch (loadError) {
        logger.warn('CustomerTripDetailsScreen', 'Failed to refresh trip before opening chat', loadError);
      }

      const driverId =
        latestTrip?.assignedDriverId ||
        latestTrip?.assigned_driver_id ||
        latestTrip?.driverId ||
        latestTrip?.driver_id ||
        displayTrip.driverId ||
        null;
      const driverEmail =
        latestTrip?.assignedDriverEmail ||
        latestTrip?.driverEmail ||
        latestTrip?.driver_email ||
        null;
      const driverName = resolveDriverNameFromRequest(
        {
          ...(displayTrip || {}),
          ...(latestTrip || {}),
          assignedDriverEmail: latestTrip?.assignedDriverEmail || driverEmail,
          driver: latestTrip?.driver,
          originalData: latestTrip?.originalData,
        },
        displayTrip.driverName || 'Driver'
      );
      const shouldResolveDriverProfileName =
        Boolean(driverId) &&
        (!driverName || driverName === 'Driver' || driverName === 'Not assigned');
      let resolvedDriverName = driverName;
      if (shouldResolveDriverProfileName && typeof getUserProfile === 'function') {
        try {
          const driverProfile = await getUserProfile(driverId, {
            requestId: displayTrip.id || undefined,
          });
          resolvedDriverName = resolveDisplayNameFromUser(driverProfile, driverName || 'Driver');
        } catch (profileLoadError) {
          logger.warn('CustomerTripDetailsScreen', 'Failed to resolve driver profile name for chat', profileLoadError);
        }
      }
      const customerName = resolveDisplayNameFromUser(currentUser, 'Customer');

      const conversationId = await createConversation(
        displayTrip.id,
        currentUserId,
        driverId,
        customerName,
        resolvedDriverName
      );

      if (!conversationId) {
        throw new Error('Could not create conversation');
      }

      await markMessageAsRead?.(conversationId, 'customer');

      navigation.navigate('MessageScreen', {
        conversationId,
        customerId: currentUserId,
        driverId,
        peerId: driverId,
        peerName: resolvedDriverName,
        driverName: resolvedDriverName,
        requestId: displayTrip.id,
      });
    } catch (error) {
      logger.error('CustomerTripDetailsScreen', 'Error opening driver chat', error);
      Alert.alert('Unable to open chat', 'Please try again in a moment.');
    } finally {
      setIsOpeningChat(false);
    }
  }, [
    createConversation,
    currentUser,
    currentUserId,
    displayTrip,
    getUserProfile,
    getRequestById,
    isOpeningChat,
    markMessageAsRead,
    navigation,
    setHasUnreadChat,
  ]);

  const isPreArrivalCancellableByCustomer = (
    displayTrip.status === TRIP_STATUS.PENDING ||
    displayTrip.status === TRIP_STATUS.ACCEPTED ||
    displayTrip.status === TRIP_STATUS.IN_PROGRESS
  );

  const handleCancelTrip = useCallback(() => {
    if (!displayTrip.id || isCancellingTrip) {
      return;
    }

    Alert.alert(
      'Cancel trip?',
      'This will cancel the trip for both you and the driver.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'Cancel trip',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCancellingTrip(true);
              const cancellationResult = await cancelOrder(displayTrip.id, 'customer_request');
              if (!cancellationResult?.success) {
                throw new Error(cancellationResult?.error || 'Please try again in a moment.');
              }
              await loadTrip({ refresh: true });
            } catch (error) {
              logger.error('CustomerTripDetailsScreen', 'Error cancelling trip', error);
              Alert.alert(
                'Unable to cancel',
                error?.message || 'Please try again in a moment.'
              );
            } finally {
              setIsCancellingTrip(false);
            }
          },
        },
      ]
    );
  }, [cancelOrder, displayTrip.id, isCancellingTrip, loadTrip]);

  if (loading && !tripData && !tripSummary) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Trip Details"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      </View>
    );
  }

  const infoRows = [
    {
      label: 'Vehicle',
      value: `${displayTrip.driverVehicleLabel} • ${displayTrip.driverPlateLabel}`,
    },
    {
      label: 'Items',
      value: `${displayTrip.itemsCount} item${displayTrip.itemsCount === 1 ? '' : 's'}`,
    },
    { label: 'Scheduled', value: displayTrip.scheduleLabel },
    { label: 'Driver', value: displayTrip.driverName },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Trip Details"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTrip({ refresh: true })}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentColumn}>
          <TripHeroCard
            displayTrip={displayTrip}
            ui={styles}
            onOpenChat={isChatAvailable ? handleOpenDriverChat : null}
            hasUnreadChat={isChatAvailable && hasUnreadChat}
            isOpeningChat={isOpeningChat}
          />

          {isPreArrivalCancellableByCustomer ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Need to cancel?</Text>
              <Text style={styles.sectionHint}>
                You can cancel this trip until the driver arrives at pickup.
              </Text>
              <AppButton
                title="Cancel Trip"
                variant="danger"
                onPress={handleCancelTrip}
                loading={isCancellingTrip}
                disabled={isCancellingTrip}
                style={styles.cancelTripButton}
              />
            </View>
          ) : null}

          {!isTripCompleted ? (
            <TripProgressSection displayTrip={displayTrip} ui={styles} />
          ) : (
            <TripDriverRatingSection
              displayTrip={displayTrip}
              rating={rating}
              setRating={setRating}
              selectedBadges={selectedBadges}
              isRatingReadOnly={isRatingReadOnly}
              isSubmittingRating={isSubmittingRating}
              canSubmitRating={canSubmitRating}
              toggleBadge={toggleBadge}
              onSubmit={submitDriverRating}
              ui={styles}
              tip={tip}
              customTip={customTip}
              showCustomTip={showCustomTip}
              selectTipPreset={selectTipPreset}
              openCustomTip={openCustomTip}
              updateCustomTip={updateCustomTip}
              tipPresets={tipPresets}
              maxTipAmount={maxTipAmount}
            />
          )}

          <TripInfoSection rows={infoRows} ui={styles} />

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Primary Item</Text>
            <Text style={styles.itemDescription}>{displayTrip.itemDescription}</Text>
          </View>

          <PhotoGallerySection
            title={`Pickup Photos (${pickupPhotoUris.length})`}
            photos={pickupPhotoUris}
            emptyLabel="Driver has not uploaded pickup photos yet."
            onOpenPhoto={handleOpenPhotoViewer}
            ui={styles}
          />

          <PhotoGallerySection
            title={`Delivery Photos (${dropoffPhotoUris.length})`}
            photos={dropoffPhotoUris}
            emptyLabel="Driver has not uploaded delivery photos yet."
            onOpenPhoto={handleOpenPhotoViewer}
            ui={styles}
          />

          {displayTrip.status === TRIP_STATUS.CANCELLED ? (
            <TripCancellationSection displayTrip={displayTrip} ui={styles} />
          ) : null}
        </View>
      </ScrollView>

      <MediaViewer
        visible={viewerVisible}
        mediaItems={viewerPhotos}
        initialIndex={viewerStartIndex}
        mediaType="image"
        onClose={handleClosePhotoViewer}
      />
    </View>
  );
}
