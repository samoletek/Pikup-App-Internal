import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import { logger } from '../../services/logger';

export default function usePickupConfirmationFlow({
  confirmPickup,
  createConversation,
  currentUserId,
  driverLocation,
  getRequestById,
  navigation,
  photos,
  request,
  startDelivery,
}) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const {
    isCreatingChat,
    openChat,
  } = useDriverTripChat({
    requestData: request,
    routeRequest: request,
    getRequestById,
    currentUserId,
    createConversation,
    navigation,
    errorMessage: 'Could not open chat right now. Please try again.',
  });

  const handleConfirmPickup = useCallback(async () => {
    const requestId = request?.id || request?.requestId || request?.originalData?.id;
    if (!requestId) {
      Alert.alert('Error', 'Could not confirm pickup right now. Please try again.');
      return;
    }

    setIsCompleting(true);
    setIsUploadingPhotos(true);

    try {
      await confirmPickup(requestId, photos, driverLocation);
      setIsUploadingPhotos(false);

      await startDelivery(requestId, driverLocation);

      navigation.replace('DeliveryNavigationScreen', {
        request,
        pickupPhotos: photos,
        driverLocation,
      });
    } catch (error) {
      logger.error('PickupConfirmationFlow', 'Error confirming pickup', error);
      setIsUploadingPhotos(false);
      Alert.alert(
        'Error',
        'Failed to confirm pickup and upload photos. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  }, [confirmPickup, driverLocation, navigation, photos, request, startDelivery]);

  const confirmPickupComplete = useCallback(() => {
    if (photos.length === 0) {
      Alert.alert(
        'Photos Required',
        'Please take at least one photo to verify the pickup.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Confirm Pickup', 'Have you successfully picked up all items?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Start Delivery',
        onPress: handleConfirmPickup,
      },
    ]);
  }, [handleConfirmPickup, photos.length]);

  return {
    confirmPickupComplete,
    isCompleting,
    isCreatingChat,
    isUploadingPhotos,
    openChat,
  };
}
