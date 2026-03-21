import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import MediaViewer from '../../components/MediaViewer';
import AppButton from '../../components/ui/AppButton';
import { colors, spacing } from '../../styles/theme';
import styles from './DriverRequestDetailsScreen.styles';
import {
  buildRequestDetails,
  firstText,
  formatWeight,
  resolvePhotoUrisAsync,
} from './requestDetails.utils';
import { logger } from '../../services/logger';

export default function DriverRequestDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const request = route?.params?.request || null;
  const [photoUris, setPhotoUris] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  const details = useMemo(() => buildRequestDetails(request), [request]);

  useEffect(() => {
    if (!details || details.photoRows.length === 0) {
      setPhotoUris([]);
      setPhotosLoading(false);
      return;
    }

    let isCancelled = false;
    setPhotosLoading(true);

    const loadPhotoUris = async () => {
      try {
        const resolved = await resolvePhotoUrisAsync(details.photoRows);
        if (!isCancelled) {
          setPhotoUris(resolved);
        }
      } catch (error) {
        logger.warn('DriverRequestDetailsScreen', 'Failed to resolve request photos', error);
        if (!isCancelled) {
          setPhotoUris([]);
        }
      } finally {
        if (!isCancelled) {
          setPhotosLoading(false);
        }
      }
    };

    void loadPhotoUris();

    return () => {
      isCancelled = true;
    };
  }, [details]);

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

  if (!details) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Request Details"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.warning} />
          <Text style={styles.emptyTitle}>Request data is unavailable</Text>
          <AppButton
            title="Go Back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            labelStyle={styles.backButtonText}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Request Details"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.background.elevated, colors.background.panel]}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroPayout}>{details.payoutLabel}</Text>
            <View style={styles.heroTag}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={styles.heroTagText}>{details.scheduleLabel}</Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>Trip #{details.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.heroMetaText}>{details.vehicleType}</Text>
            <Text style={styles.heroMetaText}>Total {details.totalLabel}</Text>
          </View>
          {details.timeDistance ? <Text style={styles.heroSubText}>{details.timeDistance}</Text> : null}
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Route</Text>

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{details.pickupAddress}</Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <View style={styles.routeTextWrap}>
              <Text style={styles.routeLabel}>Drop-off</Text>
              <Text style={styles.routeText}>{details.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {details.pickupNotes || details.dropoffNotes ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {details.pickupNotes ? (
              <>
                <Text style={styles.noteLabel}>Pickup</Text>
                <Text style={styles.noteText}>{details.pickupNotes}</Text>
              </>
            ) : null}
            {details.dropoffNotes ? (
              <>
                <Text style={styles.noteLabel}>Drop-off</Text>
                <Text style={styles.noteText}>{details.dropoffNotes}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Items</Text>
          {details.itemRows.length > 0 ? (
            details.itemRows.map((item, index) => {
              const itemName = firstText(item?.name, item?.description, item?.category) || 'Item';
              const itemMeta = [
                firstText(item?.category),
                formatWeight(item),
                item?.isFragile ? 'Fragile' : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={`${details.id}-item-${index}`} style={styles.itemRow}>
                  <View style={styles.itemBadge}>
                    <Ionicons name="cube-outline" size={14} color={colors.primary} />
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemName}>{itemName}</Text>
                    {itemMeta ? <Text style={styles.itemMeta}>{itemMeta}</Text> : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No item details provided.</Text>
          )}
        </View>

        {details.photoRows.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Photos</Text>

            {photosLoading ? (
              <View style={styles.photoLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.photoLoadingText}>Loading photos...</Text>
              </View>
            ) : photoUris.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosRow}
              >
                {photoUris.map((uri, index) => (
                  <TouchableOpacity
                    key={`${details.id}-photo-${index}`}
                    activeOpacity={0.9}
                    onPress={() => handleOpenPhotoViewer(photoUris, index)}
                  >
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>Could not load photos for this request.</Text>
            )}
          </View>
        ) : null}
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
