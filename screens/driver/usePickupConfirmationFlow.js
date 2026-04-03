import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import useDriverTripChat from '../../hooks/useDriverTripChat';
import { MIN_VERIFICATION_PHOTOS } from '../../hooks/usePickupVerificationPhotos';
import { logger } from '../../services/logger';
import { navigateDriverToHome } from './navigationRoute.utils';

export default function usePickupConfirmationFlow({
  confirmPickup,
  createConversation,
  currentUserId,
  driverLocation,
  getRequestById,
  getUserProfile,
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
    getUserProfile,
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
      const errorMessage = String(error?.message || '').toLowerCase();
      if (errorMessage.includes('session expired') || errorMessage.includes('sign in again')) {
        Alert.alert(
          'Session Expired',
          'Your session expired while uploading pickup photos. Please sign in again and retry.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (errorMessage.includes('cancelled')) {
        Alert.alert(
          'Order Cancelled',
          'The customer has cancelled this order.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigateDriverToHome(navigation);
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
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
    if (photos.length < MIN_VERIFICATION_PHOTOS) {
      Alert.alert(
        'Photos Required',
        `Please take at least ${MIN_VERIFICATION_PHOTOS} photos to verify the pickup.`,
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
