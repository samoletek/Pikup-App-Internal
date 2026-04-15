import React, { useCallback, useEffect } from 'react';
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthIdentity, useProfileActions, useTripActions } from '../../contexts/AuthContext';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/ui/AppButton';
import CameraScreen from '../../components/CustomerOrderModal/CameraScreen';
import useDeliveryConfirmationFlow from './useDeliveryConfirmationFlow';
import { MIN_VERIFICATION_PHOTOS } from '../../hooks/usePickupVerificationPhotos';
import { resolveDriverPayoutAmount } from '../../services/PricingService';
import styles from './DeliveryConfirmationScreen.styles';
import { resolveCustomerDisplayFromRequest } from '../../utils/profileDisplay';
import {
  colors,
  layout,
  spacing,
} from '../../styles/theme';

const resolveDriverPayoutLabel = (tripRequest) => {
  return `$${resolveDriverPayoutAmount(tripRequest).toFixed(2)}`;
};

export default function DeliveryConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, pickupPhotos, driverLocation } = route.params;
  const { refreshProfile } = useAuthIdentity();
  const { finishDelivery } = useTripActions();
  const { submitTripRating } = useProfileActions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    completeDelivery,
    customerRating,
    deliveryPhotos,
    getRatingLabel,
    isCompleting,
    isUploadingPhotos,
    isMaxPhotosReached,
    maxVerificationPhotos,
    isCameraVisible,
    closeCamera,
    handleCameraCapture,
    removePhoto,
    scrollViewRef,
    setCustomerRating,
    showPhotoOptions,
  } = useDeliveryConfirmationFlow({
    driverLocation,
    finishDelivery,
    navigation,
    pickupPhotos,
    refreshProfile,
    request,
    submitTripRating,
  });

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

  const customerDisplay = resolveCustomerDisplayFromRequest(request, {
    fallbackName: 'Customer',
  });
  const customerName = customerDisplay.name;
  const driverPayoutLabel = resolveDriverPayoutLabel(request);
  useFocusEffect(
    useCallback(() => {
      const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => {
        backSubscription.remove();
      };
    }, [])
  );
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = event?.data?.action?.type;
      if (actionType === 'GO_BACK' || actionType === 'POP' || actionType === 'POP_TO_TOP') {
        event.preventDefault();
      }
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Complete Delivery"
        showBack={false}
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
              <Text style={styles.summaryLabel}>Payout Amount:</Text>
              <Text style={[styles.summaryValue, styles.priceValue]}>{driverPayoutLabel}</Text>
            </View>
          </View>

          {/* Photo Section */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Text style={styles.cardTitle}>Delivery Verification Photos</Text>
              <Text style={styles.photoCount}>{deliveryPhotos.length}/{maxVerificationPhotos}</Text>
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
            <Text style={styles.cardTitle}>How was your experience?</Text>
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
        <AppButton
          title={
            isUploadingPhotos
              ? 'Uploading Photos...'
              : isCompleting
                ? 'Completing Delivery...'
                : 'Complete Delivery'
          }
          style={[
            styles.completeButton,
            { opacity: (deliveryPhotos.length < MIN_VERIFICATION_PHOTOS || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={completeDelivery}
          disabled={deliveryPhotos.length < MIN_VERIFICATION_PHOTOS || isCompleting}
          loading={isCompleting}
          labelStyle={styles.completeButtonText}
          leftIcon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />}
        />

        {deliveryPhotos.length < MIN_VERIFICATION_PHOTOS && (
          <Text style={styles.warningText}>At least {MIN_VERIFICATION_PHOTOS} delivery photos required ({deliveryPhotos.length}/{MIN_VERIFICATION_PHOTOS})</Text>
        )}
      </View>

      <CameraScreen
        visible={isCameraVisible}
        onCapture={handleCameraCapture}
        onClose={closeCamera}
        alreadyCount={deliveryPhotos.length}
        maxPhotos={maxVerificationPhotos}
        minPhotosRequired={Math.max(0, MIN_VERIFICATION_PHOTOS - deliveryPhotos.length)}
        showGuideOverlay={false}
        enableGuideFrameCrop={false}
      />
    </View>
  );
}
