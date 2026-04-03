import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { logger } from '../services/logger';

export const DEFAULT_MAX_VERIFICATION_PHOTOS = 10;
export const MIN_VERIFICATION_PHOTOS = 3;

export default function usePickupVerificationPhotos({
  maxPhotos = DEFAULT_MAX_VERIFICATION_PHOTOS,
  scrollViewRef,
}) {
  const [photos, setPhotos] = useState([]);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const showMaxPhotosAlert = useCallback(() => {
    Alert.alert('Photo Limit Reached', `You can add up to ${maxPhotos} verification photos.`);
  }, [maxPhotos]);

  const mapAssetsToPhotos = useCallback((assets = [], startIndex = 0) => {
    const timestamp = new Date().toISOString();
    return (assets || [])
      .filter((asset) => asset?.uri)
      .map((asset, index) => ({
        uri: asset.uri,
        id: `${Date.now()}-${startIndex + index}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp,
      }));
  }, []);

  const appendPhotos = useCallback(
    (newPhotos = []) => {
      if (!Array.isArray(newPhotos) || newPhotos.length === 0) {
        return;
      }

      setPhotos((prev) => [...prev, ...newPhotos].slice(0, maxPhotos));
      setTimeout(() => {
        scrollViewRef?.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [maxPhotos, scrollViewRef]
  );

  const handleCameraCapture = useCallback((capturedAssets = []) => {
    setIsCameraVisible(false);
    if (photos.length >= maxPhotos) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = maxPhotos - photos.length;
    const capturedPhotos = mapAssetsToPhotos(capturedAssets).slice(0, remaining);
    if (capturedPhotos.length === 0) {
      return;
    }

    appendPhotos(capturedPhotos);
    if (photos.length + capturedPhotos.length >= maxPhotos) {
      showMaxPhotosAlert();
    }
  }, [appendPhotos, mapAssetsToPhotos, maxPhotos, photos.length, showMaxPhotosAlert]);

  const closeCamera = useCallback(() => {
    setIsCameraVisible(false);
  }, []);

  const selectFromGallery = useCallback(async () => {
    try {
      if (photos.length >= maxPhotos) {
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
        selectionLimit: maxPhotos - photos.length,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets?.length) {
        const remaining = maxPhotos - photos.length;
        const selectedPhotos = mapAssetsToPhotos(result.assets).slice(0, remaining);
        appendPhotos(selectedPhotos);

        if (photos.length + selectedPhotos.length >= maxPhotos) {
          showMaxPhotosAlert();
        }
      }
    } catch (error) {
      logger.error('PickupVerificationPhotos', 'Error selecting photo', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  }, [appendPhotos, mapAssetsToPhotos, maxPhotos, photos.length, showMaxPhotosAlert]);

  const removePhoto = useCallback((photoId) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
        },
      },
    ]);
  }, []);

  const showPhotoOptions = useCallback(() => {
    if (photos.length >= maxPhotos) {
      showMaxPhotosAlert();
      return;
    }

    const remaining = maxPhotos - photos.length;

    Alert.alert('Add Photo', `Add up to ${remaining} photos`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo (Camera)', onPress: () => setIsCameraVisible(true) },
      { text: `Choose from Gallery (${remaining})`, onPress: selectFromGallery },
    ]);
  }, [maxPhotos, photos.length, selectFromGallery, showMaxPhotosAlert]);

  return {
    photos,
    setPhotos,
    isMaxPhotosReached: photos.length >= maxPhotos,
    maxVerificationPhotos: maxPhotos,
    isCameraVisible,
    closeCamera,
    handleCameraCapture,
    showPhotoOptions,
    removePhoto,
  };
}
