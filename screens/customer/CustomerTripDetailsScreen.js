import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenHeader from '../../components/ScreenHeader';
import MediaViewer from '../../components/MediaViewer';
import PhotoGallerySection from '../../components/trip/PhotoGallerySection';
import TripHeroCard from '../../components/trip/TripHeroCard';
import TripProgressSection from '../../components/trip/TripProgressSection';
import TripDriverRatingSection from '../../components/trip/TripDriverRatingSection';
import TripRouteSection from '../../components/trip/TripRouteSection';
import TripInfoSection from '../../components/trip/TripInfoSection';
import TripCancellationSection from '../../components/trip/TripCancellationSection';
import styles from './CustomerTripDetailsScreen.styles';
import { useAuthIdentity, useProfileActions, useTripActions } from '../../contexts/AuthContext';
import { TRIP_STATUS } from '../../constants/tripStatus';
import { colors, spacing } from '../../styles/theme';
import useCustomerTripDetailsData from '../../hooks/useCustomerTripDetailsData';
import useCustomerTripRating from '../../hooks/useCustomerTripRating';

export default function CustomerTripDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser, refreshProfile } = useAuthIdentity();
  const { getRequestById } = useTripActions();
  const { submitTripRating } = useProfileActions();

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
    getRequestById,
    initialSnapshot,
    isMockTrip,
    tripId,
    tripSummary,
  });

  const currentUserId = currentUser?.uid || currentUser?.id || null;
  const isTripCompleted = displayTrip.status === TRIP_STATUS.COMPLETED;

  const {
    rating,
    setRating,
    selectedBadges,
    isSubmittingRating,
    isRatingReadOnly,
    canSubmitRating,
    toggleBadge,
    submitDriverRating,
  } = useCustomerTripRating({
    currentUserId,
    driverId: displayTrip.driverId,
    isTripCompleted,
    refreshProfile,
    submitTripRating,
    tripId: displayTrip.id,
  });

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);

  const handleOpenPhotoViewer = useCallback((uri) => {
    if (!uri) {
      return;
    }
    setViewerUri(uri);
    setViewerVisible(true);
  }, []);

  const handleClosePhotoViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerUri(null);
  }, []);

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
    { label: 'Vehicle', value: displayTrip.vehicleType },
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
          <TripHeroCard displayTrip={displayTrip} ui={styles} />

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
            />
          )}

          <TripRouteSection displayTrip={displayTrip} ui={styles} />

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
        mediaUri={viewerUri}
        mediaType="image"
        onClose={handleClosePhotoViewer}
      />
    </View>
  );
}
