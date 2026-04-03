import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MIN_VERIFICATION_PHOTOS } from '../../hooks/usePickupVerificationPhotos';
import { logger } from '../../services/logger';

const MAX_VERIFICATION_PHOTOS = 10;

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

export default function useDeliveryConfirmationFlow({
  driverLocation,
  finishDelivery,
  navigation,
  pickupPhotos,
  refreshProfile,
  request,
  submitTripRating,
}) {
  const [deliveryPhotos, setDeliveryPhotos] = useState([]);
  const [customerRating, setCustomerRating] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const scrollViewRef = useRef(null);

  const showMaxPhotosAlert = useCallback(() => {
    Alert.alert(
      'Photo Limit Reached',
      `You can add up to ${MAX_VERIFICATION_PHOTOS} verification photos.`
    );
  }, []);

  const appendPhotos = useCallback((newPhotos = []) => {
    if (!Array.isArray(newPhotos) || newPhotos.length === 0) return;
    setDeliveryPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_VERIFICATION_PHOTOS));
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleCameraCapture = useCallback((capturedAssets = []) => {
    setIsCameraVisible(false);
    if (deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = MAX_VERIFICATION_PHOTOS - deliveryPhotos.length;
    const capturedPhotos = mapAssetsToPhotos(capturedAssets).slice(0, remaining);
    if (capturedPhotos.length === 0) {
      return;
    }

    appendPhotos(capturedPhotos);
    if (deliveryPhotos.length + capturedPhotos.length >= MAX_VERIFICATION_PHOTOS) {
      showMaxPhotosAlert();
    }
  }, [appendPhotos, deliveryPhotos.length, showMaxPhotosAlert]);

  const closeCamera = useCallback(() => {
    setIsCameraVisible(false);
  }, []);

  const selectFromGallery = useCallback(async () => {
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
      logger.error('DeliveryConfirmationFlow', 'Error selecting photo', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  }, [appendPhotos, deliveryPhotos.length, showMaxPhotosAlert]);

  const removePhoto = useCallback((photoId) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setDeliveryPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
          },
        },
      ]
    );
  }, []);

  const showPhotoOptions = useCallback(() => {
    if (deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = MAX_VERIFICATION_PHOTOS - deliveryPhotos.length;

    Alert.alert('Add Delivery Photo', `Add up to ${remaining} photos`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo (Camera)', onPress: () => setIsCameraVisible(true) },
      { text: `Choose from Gallery (${remaining})`, onPress: selectFromGallery },
    ]);
  }, [deliveryPhotos.length, selectFromGallery, showMaxPhotosAlert]);

  const navigateToDriverTabs = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'DriverTabs' }],
    });
  }, [navigation]);

  const handleCompleteDelivery = useCallback(async () => {
    setIsCompleting(true);
    setIsUploadingPhotos(true);

    try {
      await finishDelivery(request.id, deliveryPhotos, driverLocation, customerRating);

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
          logger.warn(
            'DeliveryConfirmationFlow',
            'Failed to save driver rating after delivery completion',
            ratingError
          );
        }
      }

      navigateToDriverTabs();
    } catch (error) {
      logger.error('DeliveryConfirmationFlow', 'Error completing delivery', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to complete delivery and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  }, [
    customerRating,
    deliveryPhotos,
    driverLocation,
    finishDelivery,
    navigateToDriverTabs,
    refreshProfile,
    request,
    submitTripRating,
  ]);

  const completeDelivery = useCallback(async () => {
    if (deliveryPhotos.length < MIN_VERIFICATION_PHOTOS) {
      Alert.alert(
        'Photos Required',
        `Please take at least ${MIN_VERIFICATION_PHOTOS} photos to verify the delivery.`,
        [{ text: 'OK' }]
      );
      return;
    }
    await handleCompleteDelivery();
  }, [deliveryPhotos.length, handleCompleteDelivery]);

  const getRatingLabel = useCallback((rating) => {
    if (rating === 5) return 'Excellent';
    if (rating === 4) return 'Very Good';
    if (rating === 3) return 'Good';
    if (rating === 2) return 'Fair';
    if (rating === 1) return 'Poor';
    return '';
  }, []);

  return {
    completeDelivery,
    customerRating,
    deliveryPhotos,
    getRatingLabel,
    isCompleting,
    isUploadingPhotos,
    isMaxPhotosReached: deliveryPhotos.length >= MAX_VERIFICATION_PHOTOS,
    maxVerificationPhotos: MAX_VERIFICATION_PHOTOS,
    isCameraVisible,
    closeCamera,
    handleCameraCapture,
    removePhoto,
    scrollViewRef,
    setCustomerRating,
    showPhotoOptions,
  };
}
