import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BackHandler,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  useAuthIdentity,
  useMessagingActions,
  useProfileActions,
  useTripActions,
} from '../../contexts/AuthContext';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/ui/AppButton';
import CameraScreen from '../../components/CustomerOrderModal/CameraScreen';
import styles from './PickupConfirmationScreen.styles';
import usePickupVerificationPhotos, {
  DEFAULT_MAX_VERIFICATION_PHOTOS,
  MIN_VERIFICATION_PHOTOS,
} from '../../hooks/usePickupVerificationPhotos';
import useCustomerAvatarFromTripRequest from './useCustomerAvatarFromTripRequest';
import usePickupConfirmationFlow from './usePickupConfirmationFlow';
import { resolveRequestCustomerId } from './requestConversationContext.utils';
import { resolveCustomerDisplayFromRequest } from '../../utils/profileDisplay';
import {
  colors,
  layout,
  spacing,
} from '../../styles/theme';

export default function PickupConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, driverLocation } = route.params;
  const { currentUser } = useAuthIdentity();
  const { confirmPickup, startDelivery, getRequestById } = useTripActions();
  const { createConversation } = useMessagingActions();
  const { getUserProfile } = useProfileActions();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const activeRequestCustomerId = resolveRequestCustomerId({
    requestData: request,
    routeRequest: request,
  });

  const scrollViewRef = useRef(null);
  const {
    photos,
    isMaxPhotosReached,
    maxVerificationPhotos,
    isCameraVisible,
    closeCamera,
    handleCameraCapture,
    showPhotoOptions,
    removePhoto,
  } = usePickupVerificationPhotos({
    maxPhotos: DEFAULT_MAX_VERIFICATION_PHOTOS,
    scrollViewRef,
  });

  // Monitor order status for cancellations
  useOrderStatusMonitor(request?.id, navigation, {
    currentScreen: 'PickupConfirmationScreen',
    enabled: !!request?.id
  });
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

  const {
    customerAvatarUrl,
    setCustomerAvatarUrl,
  } = useCustomerAvatarFromTripRequest({
    requestData: request,
    routeRequest: request,
    activeRequestCustomerId,
    getUserProfile,
  });

  const {
    confirmPickupComplete,
    isCompleting,
    isCreatingChat,
    isUploadingPhotos,
    openChat,
  } = usePickupConfirmationFlow({
    confirmPickup,
    createConversation,
    currentUserId,
    driverLocation,
    getRequestById,
    navigation,
    photos,
    request,
    startDelivery,
  });

  const customerDisplay = useMemo(
    () =>
      resolveCustomerDisplayFromRequest(
        {
          ...request,
          customerAvatarUrl,
        },
        { fallbackName: 'Customer' }
      ),
    [customerAvatarUrl, request]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Pickup Confirmation"
        showBack={false}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 124 }}
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          {/* Status Header */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIndicator}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={styles.statusText}>Arrived at Pickup</Text>
              </View>
              <Text style={styles.requestId}>#{request?.id?.slice(-8)}</Text>
            </View>
          </View>

          {/* Customer Info */}
          <View style={styles.customerCard}>
            <View style={styles.customerHeader}>
              {customerDisplay.avatarUrl ? (
                <Image
                  source={{ uri: customerDisplay.avatarUrl }}
                  style={styles.customerPhoto}
                  onError={() => setCustomerAvatarUrl(null)}
                />
              ) : (
                <View style={styles.customerPhotoPlaceholder}>
                  <Text style={styles.customerPhotoInitials}>{customerDisplay.initials}</Text>
                </View>
              )}
              <Text style={styles.customerName}>{customerDisplay.name}</Text>
              <TouchableOpacity
                style={[styles.chatButton, isCreatingChat && styles.chatButtonDisabled]}
                onPress={openChat}
                disabled={isCreatingChat}
              >
                {isCreatingChat ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="chatbubble-ellipses" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Pickup Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Pickup Details</Text>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.pickup?.address || 'Pickup location'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cube" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.item?.description || 'Items to pickup'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="car" size={16} color={colors.primary} />
              <Text style={styles.detailText}>{request?.vehicle?.type || 'Vehicle type'}</Text>
            </View>
            {request?.item?.needsHelp && (
              <View style={styles.detailRow}>
                <Ionicons name="people" size={16} color={colors.warning} />
                <Text style={[styles.detailText, { color: colors.warning }]}>Loading assistance required</Text>
              </View>
            )}
          </View>

          {/* Photo Section */}
          <View style={styles.photoCard}>
            <View style={styles.photoHeader}>
              <Text style={styles.cardTitle}>Pickup Verification Photos</Text>
              <Text style={styles.photoCount}>{photos.length}/{maxVerificationPhotos}</Text>
            </View>
            <Text style={styles.photoSubtitle}>
              Take photos to verify the items you're picking up
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
                <Ionicons name="camera" size={32} color={colors.primary} />
                <Text style={styles.addPhotoText}>
                  {isMaxPhotosReached ? 'Max Reached' : 'Add Photo'}
                </Text>
              </TouchableOpacity>

              {/* Photo Items */}
              {photos.map((photo, index) => (
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

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.cardTitle}>Pickup Instructions</Text>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>1.</Text>
              <Text style={styles.instructionText}>Verify items match the description</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>2.</Text>
              <Text style={styles.instructionText}>Take clear photos of all items</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>3.</Text>
              <Text style={styles.instructionText}>Load items safely in your vehicle</Text>
            </View>
            <View style={styles.instruction}>
              <Text style={styles.instructionNumber}>4.</Text>
              <Text style={styles.instructionText}>Confirm pickup to start delivery</Text>
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
                ? 'Confirming Pickup...'
                : 'Confirm Pickup & Start Delivery'
          }
          style={[
            styles.confirmButton,
            { opacity: (photos.length < MIN_VERIFICATION_PHOTOS || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={confirmPickupComplete}
          disabled={photos.length < MIN_VERIFICATION_PHOTOS || isCompleting}
          loading={isCompleting}
          labelStyle={styles.confirmButtonText}
          leftIcon={<Ionicons name="checkmark" size={20} color={colors.white} />}
        />

        {photos.length < MIN_VERIFICATION_PHOTOS && (
          <Text style={styles.warningText}>At least {MIN_VERIFICATION_PHOTOS} photos required ({photos.length}/{MIN_VERIFICATION_PHOTOS})</Text>
        )}
      </View>

      <CameraScreen
        visible={isCameraVisible}
        onCapture={handleCameraCapture}
        onClose={closeCamera}
        alreadyCount={photos.length}
        maxPhotos={maxVerificationPhotos}
        minPhotosRequired={Math.max(0, MIN_VERIFICATION_PHOTOS - photos.length)}
        showGuideOverlay={false}
        enableGuideFrameCrop={false}
      />
    </View>
  );
}
