import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

const MAX_VERIFICATION_PHOTOS = 10;

export default function DeliveryConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, pickupPhotos, driverLocation } = route.params;
  const { finishDelivery, submitTripRating, refreshProfile } = useAuth();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [deliveryPhotos, setDeliveryPhotos] = useState([]);
  const [customerRating, setCustomerRating] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  const scrollViewRef = useRef(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take delivery verification photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() }
        ]
      );
      return false;
    }
    return true;
  };

  const showMaxPhotosAlert = () => {
    Alert.alert(
      'Photo Limit Reached',
      `You can add up to ${MAX_VERIFICATION_PHOTOS} verification photos.`
    );
  };

  const mapAssetsToPhotos = (assets = [], startIndex = 0) => {
    const timestamp = new Date().toISOString();
    return (assets || [])
      .filter((asset) => asset?.uri)
      .map((asset, index) => ({
        uri: asset.uri,
        id: `${Date.now()}-${startIndex + index}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp,
      }));
  };

  const appendPhotos = (newPhotos = []) => {
    if (!Array.isArray(newPhotos) || newPhotos.length === 0) return;
    setDeliveryPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_VERIFICATION_PHOTOS));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const takePhotoBatch = async () => {
    try {
      if (deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS) {
        showMaxPhotosAlert();
        return;
      }

      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      let remaining = MAX_VERIFICATION_PHOTOS - deliveryPhotos.length;
      const capturedPhotos = [];

      while (remaining > 0) {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          exif: false,
        });

        if (result.canceled || !result.assets?.length) {
          break;
        }

        const mappedPhotos = mapAssetsToPhotos(result.assets, capturedPhotos.length).slice(0, remaining);
        if (mappedPhotos.length === 0) {
          break;
        }

        capturedPhotos.push(...mappedPhotos);
        remaining -= mappedPhotos.length;
      }

      if (capturedPhotos.length > 0) {
        appendPhotos(capturedPhotos);
      }

      if (remaining <= 0) {
        showMaxPhotosAlert();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const selectFromGallery = async () => {
    try {
      if (deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS) {
        showMaxPhotosAlert();
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        selectionLimit: MAX_VERIFICATION_PHOTOS - deliveryPhotos.length,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const remaining = MAX_VERIFICATION_PHOTOS - deliveryPhotos.length;
        const selectedPhotos = mapAssetsToPhotos(result.assets).slice(0, remaining);
        appendPhotos(selectedPhotos);

        if (deliveryPhotos.length + selectedPhotos.length >= MAX_VERIFICATION_PHOTOS) {
          showMaxPhotosAlert();
        }
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const removePhoto = (photoId) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDeliveryPhotos(prev => prev.filter(photo => photo.id !== photoId));
          }
        }
      ]
    );
  };

  const showPhotoOptions = () => {
    if (deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = MAX_VERIFICATION_PHOTOS - deliveryPhotos.length;

    Alert.alert(
      'Add Delivery Photo',
      `Add up to ${remaining} photos`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photos (Camera)', onPress: takePhotoBatch },
        { text: `Choose from Gallery (${remaining})`, onPress: selectFromGallery }
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setCustomerRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= customerRating ? 'star' : 'star-outline'}
              size={32}
              color={star <= customerRating ? colors.gold : colors.text.muted}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingLabel = (rating) => {
    if (rating === 5) return 'Excellent';
    if (rating === 4) return 'Very Good';
    if (rating === 3) return 'Good';
    if (rating === 2) return 'Fair';
    if (rating === 1) return 'Poor';
    return '';
  };

  const completeDelivery = async () => {
    if (deliveryPhotos.length === 0) {
      Alert.alert(
        'Photos Required',
        'Please take at least one photo to verify the delivery.',
        [{ text: 'OK' }]
      );
      return;
    }
    await handleCompleteDelivery();
  };

  const handleCompleteDelivery = async () => {
    setIsCompleting(true);
    setIsUploadingPhotos(true);

    try {
      console.log(`Completing delivery with ${deliveryPhotos.length} photos...`);

      // Complete delivery with photos, location, and rating (photos are uploaded to Supabase Storage)
      await finishDelivery(
        request.id,
        deliveryPhotos,
        driverLocation,
        customerRating
      );

      console.log('Delivery completed with photos uploaded to Supabase Storage');
      setIsUploadingPhotos(false);

      const customerId = request?.customerId || request?.customer_id || null;
      if (customerId && customerRating > 0) {
        try {
          await submitTripRating({
            requestId: request?.id,
            toUserId: customerId,
            toUserType: 'customer',
            rating: customerRating,
            badges: [],
          });
          await refreshProfile?.();
        } catch (ratingError) {
          console.warn('Failed to save driver rating after delivery completion:', ratingError);
        }
      } else if (customerId) {
        console.log('Skipping customer rating save: rating was not selected');
      } else {
        console.warn('Skipping customer rating save: customer id is missing');
      }

      console.log('Delivery completed successfully');
      navigateToDriverTabs();

    } catch (error) {
      console.error('Error completing delivery:', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to complete delivery and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const navigateToDriverTabs = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'DriverTabs' }],
    });
  };

  const customerName = request?.customerEmail?.split('@')[0] || 'Customer';
  const isMaxPhotosReached = deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Complete Delivery"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 124 }}
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          {/* Success Header */}
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Arrived at Dropoff</Text>
            <Text style={styles.successSubtitle}>Complete the delivery process</Text>
          </View>

          {/* Delivery Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Delivery Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Request ID:</Text>
              <Text style={styles.summaryValue}>#{request?.id?.slice(-8)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer:</Text>
              <Text style={styles.summaryValue}>{customerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{request?.item?.description || 'Delivery items'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pickup Photos:</Text>
              <Text style={styles.summaryValue}>{pickupPhotos?.length || 0} photos</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={[styles.summaryValue, styles.priceValue]}>${request?.pricing?.total || '0.00'}</Text>
            </View>
          </View>

          {/* Photo Section */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Text style={styles.cardTitle}>Delivery Verification Photos</Text>
              <Text style={styles.photoCount}>{deliveryPhotos.length}/{MAX_VERIFICATION_PHOTOS}</Text>
            </View>
            <Text style={styles.photoSubtitle}>
              Take photos to confirm successful delivery
            </Text>

            {/* Photo Grid */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              style={styles.photoScrollView}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoContainer}
            >
              {/* Add Photo Button */}
              <TouchableOpacity
                style={[
                  styles.addPhotoButton,
                  isMaxPhotosReached && styles.addPhotoButtonDisabled,
                ]}
                onPress={showPhotoOptions}
                disabled={isMaxPhotosReached}
              >
                <Ionicons name="camera" size={32} color={colors.success} />
                <Text style={styles.addPhotoText}>
                  {isMaxPhotosReached ? 'Max Reached' : 'Add Photo'}
                </Text>
              </TouchableOpacity>

              {/* Photo Items */}
              {deliveryPhotos.map((photo, index) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(photo.id)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Ionicons name="close-circle" size={30} color={colors.error} />
                  </TouchableOpacity>
                  <View style={styles.photoIndex}>
                    <Text style={styles.photoIndexText}>{index + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Customer Rating */}
          <View style={styles.ratingCard}>
            <Text style={styles.cardTitle}>Rate Your Experience</Text>
            <Text style={styles.ratingSubtitle}>How was your interaction with {customerName}?</Text>
            {renderStars()}
            {customerRating > 0 ? (
              <Text style={styles.ratingText}>{getRatingLabel(customerRating)}</Text>
            ) : null}
          </View>

          {/* Final Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.cardTitle}>Final Steps</Text>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>1.</Text>
              <Text style={styles.instructionText}>Ensure all items are delivered safely</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>2.</Text>
              <Text style={styles.instructionText}>Take photos showing successful delivery</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>3.</Text>
              <Text style={styles.instructionText}>Rate your customer experience</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>4.</Text>
              <Text style={styles.instructionText}>Complete delivery to finish the request</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { opacity: (deliveryPhotos.length === 0 || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={completeDelivery}
          disabled={deliveryPhotos.length === 0 || isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={colors.white} style={{ marginRight: spacing.sm }} />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
          )}
          <Text style={styles.completeButtonText}>
            {isUploadingPhotos ? 'Uploading Photos...' :
              isCompleting ? 'Completing Delivery...' :
                'Complete Delivery'}
          </Text>
        </TouchableOpacity>

        {deliveryPhotos.length === 0 && (
          <Text style={styles.warningText}>⚠️ At least 1 delivery photo required</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  successCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  successTitle: {
    color: colors.success,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  summaryCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  summaryValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
    textAlign: 'right',
  },
  priceValue: {
    color: colors.success,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  ratingCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  ratingSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  starButton: {
    padding: spacing.xs,
  },
  ratingText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  photoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoCount: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  photoSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.base,
  },
  photoScrollView: {
    overflow: 'hidden',
  },
  photoContainer: {
    paddingHorizontal: 0,
    paddingTop: 8,
    gap: spacing.md,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.success,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButtonDisabled: {
    opacity: 0.5,
  },
  addPhotoText: {
    color: colors.success,
    fontSize: typography.fontSize.xs + 1,
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  photoItem: {
    position: 'relative',
    width: 120,
    height: 120,
    overflow: 'visible',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.circle,
    zIndex: 10,
  },
  photoIndex: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIndexText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
  },
  noPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noPhotosText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
  },
  noPhotosSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs + 1,
    marginTop: spacing.xs,
  },
  instructionsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  instructionNumber: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    width: 20,
  },
  instructionText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  completeButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completeButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  warningText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs + 1,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
