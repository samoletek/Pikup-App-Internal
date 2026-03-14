import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import useOrderStatusMonitor from '../../hooks/useOrderStatusMonitor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import styles from './PickupConfirmationScreen.styles';
import {
  colors,
  layout,
  spacing,
} from '../../styles/theme';

const MAX_VERIFICATION_PHOTOS = 10;

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const resolveCustomerAvatarFromRequest = (requestLike) => {
  if (!requestLike || typeof requestLike !== 'object') {
    return null;
  }

  const customer =
    requestLike.customer ||
    requestLike.customerProfile ||
    requestLike.customer_profile ||
    {};
  const originalData =
    requestLike.originalData && typeof requestLike.originalData === 'object'
      ? requestLike.originalData
      : {};
  const originalCustomer =
    originalData.customer ||
    originalData.customerProfile ||
    originalData.customer_profile ||
    {};

  return firstNonEmptyString(
    requestLike.customerPhoto,
    customer.profileImageUrl,
    customer.profile_image_url,
    customer.avatarUrl,
    customer.avatar_url,
    requestLike.customerProfileImageUrl,
    requestLike.customer_profile_image_url,
    requestLike.customerAvatarUrl,
    requestLike.customer_avatar_url,
    originalCustomer.profileImageUrl,
    originalCustomer.profile_image_url,
    originalCustomer.avatarUrl,
    originalCustomer.avatar_url,
    originalData.customerProfileImageUrl,
    originalData.customer_profile_image_url,
    originalData.customerAvatarUrl,
    originalData.customer_avatar_url
  );
};

export default function PickupConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { request, driverLocation } = route.params;
  const {
    confirmPickup,
    startDelivery,
    createConversation,
    getRequestById,
    getUserProfile,
    currentUser,
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const activeRequestCustomerId = String(
    request?.customerId ||
    request?.customer_id ||
    request?.customer?.id ||
    request?.customer?.uid ||
    request?.originalData?.customerId ||
    request?.originalData?.customer_id ||
    ''
  );

  const [photos, setPhotos] = useState([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState(
    () => resolveCustomerAvatarFromRequest(request)
  );

  const scrollViewRef = useRef(null);
  const customerAvatarCacheRef = useRef(new Map());

  // Monitor order status for cancellations
  useOrderStatusMonitor(request?.id, navigation, {
    currentScreen: 'PickupConfirmationScreen',
    enabled: !!request?.id
  });

  useEffect(() => {
    const embeddedAvatar = resolveCustomerAvatarFromRequest(request);
    if (embeddedAvatar) {
      setCustomerAvatarUrl(embeddedAvatar);
      if (activeRequestCustomerId) {
        customerAvatarCacheRef.current.set(activeRequestCustomerId, embeddedAvatar);
      }
      return;
    }

    if (!activeRequestCustomerId || typeof getUserProfile !== 'function') {
      setCustomerAvatarUrl(null);
      return;
    }

    if (customerAvatarCacheRef.current.has(activeRequestCustomerId)) {
      setCustomerAvatarUrl(customerAvatarCacheRef.current.get(activeRequestCustomerId));
      return;
    }

    let isMounted = true;

    const loadCustomerAvatar = async () => {
      try {
        const profile = await getUserProfile(activeRequestCustomerId);
        if (!isMounted) {
          return;
        }

        const profileAvatar = firstNonEmptyString(
          profile?.profileImageUrl,
          profile?.profile_image_url,
          profile?.avatarUrl,
          profile?.avatar_url
        );

        customerAvatarCacheRef.current.set(activeRequestCustomerId, profileAvatar);
        setCustomerAvatarUrl(profileAvatar);
      } catch (_error) {
        if (!isMounted) {
          return;
        }

        customerAvatarCacheRef.current.set(activeRequestCustomerId, null);
        setCustomerAvatarUrl(null);
      }
    };

    loadCustomerAvatar();

    return () => {
      isMounted = false;
    };
  }, [activeRequestCustomerId, getUserProfile, request]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take photos of the items.',
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
    setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_VERIFICATION_PHOTOS));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const takePhotoBatch = async () => {
    try {
      if (photos.length >= MAX_VERIFICATION_PHOTOS) {
        showMaxPhotosAlert();
        return;
      }

      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      let remaining = MAX_VERIFICATION_PHOTOS - photos.length;
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
      if (photos.length >= MAX_VERIFICATION_PHOTOS) {
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
        selectionLimit: MAX_VERIFICATION_PHOTOS - photos.length,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const remaining = MAX_VERIFICATION_PHOTOS - photos.length;
        const selectedPhotos = mapAssetsToPhotos(result.assets).slice(0, remaining);
        appendPhotos(selectedPhotos);

        if (photos.length + selectedPhotos.length >= MAX_VERIFICATION_PHOTOS) {
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
            setPhotos(prev => prev.filter(photo => photo.id !== photoId));
          }
        }
      ]
    );
  };

  const showPhotoOptions = () => {
    if (photos.length >= MAX_VERIFICATION_PHOTOS) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = MAX_VERIFICATION_PHOTOS - photos.length;

    Alert.alert(
      'Add Photo',
      `Add up to ${remaining} photos`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photos (Camera)', onPress: takePhotoBatch },
        { text: `Choose from Gallery (${remaining})`, onPress: selectFromGallery }
      ]
    );
  };

  const confirmPickupComplete = async () => {
    if (photos.length === 0) {
      Alert.alert(
        'Photos Required',
        'Please take at least one photo to verify the pickup.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Pickup',
      'Have you successfully picked up all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Start Delivery',
          onPress: handleConfirmPickup
        }
      ]
    );
  };

  const handleConfirmPickup = async () => {
    setIsCompleting(true);
    setIsUploadingPhotos(true);

    try {
      console.log(`Confirming pickup with ${photos.length} photos...`);

      // Confirm pickup with photos and location (photos are uploaded to Supabase Storage)
      await confirmPickup(request.id, photos, driverLocation);
      console.log('Pickup confirmed with photos uploaded to Supabase Storage');

      setIsUploadingPhotos(false);

      // Start delivery phase
      await startDelivery(request.id, driverLocation);
      console.log('Started delivery phase');

      // Navigate to delivery screen
      navigation.replace('DeliveryNavigationScreen', {
        request,
        pickupPhotos: photos,
        driverLocation
      });

    } catch (error) {
      console.error('Error confirming pickup:', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to confirm pickup and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const customerName =
    request?.customerName ||
    request?.customer?.name ||
    request?.customer?.displayName ||
    (request?.customerEmail ? request.customerEmail.split('@')[0] : 'Customer');
  const isMaxPhotosReached = photos.length >= MAX_VERIFICATION_PHOTOS;

  const openChat = async () => {
    if (isCreatingChat) return;

    setIsCreatingChat(true);
    try {
      const req = request || {};
      const requestId = req.id || req.requestId || req.originalData?.id;
      let customerId =
        req.customerId ||
        req.customer_id ||
        req.originalData?.customerId ||
        req.originalData?.customer_id ||
        req.customerUid ||
        req.customer?.uid ||
        req.customer?.id ||
        null;
      let customerEmail =
        req.customerEmail ||
        req.customer_email ||
        req.originalData?.customerEmail ||
        req.originalData?.customer_email ||
        req.customer?.email ||
        '';

      if (requestId && !customerId && typeof getRequestById === 'function') {
        try {
          const latestRequest = await getRequestById(requestId);
          customerId =
            latestRequest?.customerId ||
            latestRequest?.customer_id ||
            customerId;
          customerEmail =
            latestRequest?.customerEmail ||
            latestRequest?.customer_email ||
            customerEmail;
        } catch (fetchError) {
          console.warn('Failed to fetch latest request before opening chat:', fetchError);
        }
      }

      const customerDisplayName =
        req.customerName ||
        req.customer?.name ||
        req.customer?.displayName ||
        (customerEmail ? customerEmail.split('@')[0] : 'Customer');

      if (!requestId || !currentUserId) {
        Alert.alert('Error', 'Could not open chat right now. Please try again.');
        return;
      }

      const conversationId = await createConversation(
        requestId,
        customerId || null,
        currentUserId,
        customerDisplayName,
        req.assignedDriverName || ''
      );

      if (!conversationId) {
        Alert.alert('Error', 'Could not open chat right now. Please try again.');
        return;
      }

      navigation.navigate('MessageScreen', {
        conversationId,
        requestId,
        driverName: customerDisplayName,
      });
    } catch (error) {
      console.error('openChat error', error);
      Alert.alert('Error', 'Could not open chat right now. Please try again.');
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Pickup Confirmation"
        onBack={() => navigation.goBack()}
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
              {customerAvatarUrl ? (
                <Image
                  source={{ uri: customerAvatarUrl }}
                  style={styles.customerPhoto}
                  onError={() => setCustomerAvatarUrl(null)}
                />
              ) : (
                <View style={styles.customerPhotoPlaceholder}>
                  <Ionicons name="person" size={22} color={colors.text.muted} />
                </View>
              )}
              <Text style={styles.customerName}>{customerName}</Text>
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
              <Text style={styles.photoCount}>{photos.length}/{MAX_VERIFICATION_PHOTOS}</Text>
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
        <TouchableOpacity
          style={[
            styles.confirmButton,
            { opacity: (photos.length === 0 || isCompleting) ? 0.6 : 1 }
          ]}
          onPress={confirmPickupComplete}
          disabled={photos.length === 0 || isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={colors.white} style={{ marginRight: spacing.sm }} />
          ) : (
            <Ionicons name="checkmark" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
          )}
          <Text style={styles.confirmButtonText}>
            {isUploadingPhotos ? 'Uploading Photos...' :
              isCompleting ? 'Confirming Pickup...' :
                'Confirm Pickup & Start Delivery'}
          </Text>
        </TouchableOpacity>

        {photos.length === 0 && (
          <Text style={styles.warningText}>⚠️ At least 1 photo required</Text>
        )}
      </View>
    </View>
  );
}
