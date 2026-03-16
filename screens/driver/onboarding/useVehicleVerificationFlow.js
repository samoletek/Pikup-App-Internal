import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  refreshVehicleVerificationSession,
  uploadVehiclePhotos,
  verifyVehicle,
} from '../../../services/VehicleVerificationService';
import { logger } from '../../../services/logger';

function buildUpdatedCarPhotoUris(prevUris, index, value) {
  const updated = [...prevUris];
  updated[index] = value;
  return updated;
}

export default function useVehicleVerificationFlow({ currentUser, setFormData }) {
  const [vinPhotoUri, setVinPhotoUri] = useState(null);
  const [carPhotoUris, setCarPhotoUris] = useState([null, null, null]);
  const [vehicleVerificationStatus, setVehicleVerificationStatus] = useState('idle');
  const [vehicleVerificationResult, setVehicleVerificationResult] = useState(null);
  const [vehicleVerificationError, setVehicleVerificationError] = useState(null);

  const resetVerificationState = useCallback(() => {
    setVehicleVerificationStatus('idle');
    setVehicleVerificationResult(null);
    setVehicleVerificationError(null);
  }, []);

  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'We need camera permission to take photos of your vehicle.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return true;
  }, []);

  const pickPhoto = useCallback(
    async (setter) => {
      const launchCamera = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          return;
        }

        try {
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            exif: false,
          });

          if (!result.canceled && result.assets[0]) {
            setter(result.assets[0].uri);
            resetVerificationState();
          }
        } catch (error) {
          logger.error('VehicleVerificationFlow', 'Camera error', error);
          Alert.alert('Camera Unavailable', 'Could not open camera. Try choosing from gallery instead.');
        }
      };

      const launchGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please grant photo library access.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]);
          return;
        }

        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            exif: false,
          });

          if (!result.canceled && result.assets[0]) {
            setter(result.assets[0].uri);
            resetVerificationState();
          }
        } catch (error) {
          logger.error('VehicleVerificationFlow', 'Gallery error', error);
          Alert.alert('Error', 'Failed to pick photo. Please try again.');
        }
      };

      Alert.alert('Add Photo', 'Choose a source', [
        { text: 'Camera', onPress: launchCamera },
        { text: 'Photo Library', onPress: launchGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [requestCameraPermission, resetVerificationState]
  );

  const takeVinPhoto = useCallback(() => {
    pickPhoto(setVinPhotoUri);
  }, [pickPhoto]);

  const takeCarPhoto = useCallback(
    (index) => {
      pickPhoto((uri) => {
        setCarPhotoUris((prevUris) => buildUpdatedCarPhotoUris(prevUris, index, uri));
      });
    },
    [pickPhoto]
  );

  const resetVinPhoto = useCallback(() => {
    setVinPhotoUri(null);
    setVehicleVerificationStatus('idle');
    setVehicleVerificationResult(null);
  }, []);

  const resetCarPhoto = useCallback((index) => {
    setCarPhotoUris((prevUris) => buildUpdatedCarPhotoUris(prevUris, index, null));
    setVehicleVerificationStatus('idle');
    setVehicleVerificationResult(null);
  }, []);

  const showVinHintAlert = useCallback(() => {
    Alert.alert(
      'Where to find the VIN plate',
      [
        'Driver-side door jamb: open the door and look for a sticker on the frame.',
        "Dashboard: check the base of the windshield on the driver's side.",
        'Engine bay or vehicle registration documents.',
        '',
        'Tips for a good photo:',
        'Use enough light and avoid shadows on the VIN.',
        'Hold the camera close so all 17 characters are readable.',
        'Keep the camera steady to avoid blur.',
      ].join('\n'),
      [{ text: 'OK' }]
    );
  }, []);

  const showVehiclePhotoHintAlert = useCallback(() => {
    Alert.alert(
      'How to take photos of your vehicle',
      [
        'Front: stand about 10 feet in front and capture bumper, headlights, and license plate.',
        'Side: stand at a slight angle and capture the whole car from hood to trunk.',
        'Rear: stand about 10 feet behind and capture bumper, taillights, and license plate.',
        '',
        'For best results, take photos outdoors in daylight.',
      ].join('\n'),
      [{ text: 'OK' }]
    );
  }, []);

  const handleVerifyVehicle = useCallback(async () => {
    const validCarPhotos = carPhotoUris.filter(Boolean);
    if (!vinPhotoUri || validCarPhotos.length === 0) {
      Alert.alert('Photos Required', 'Please take a VIN plate photo and at least one vehicle photo.');
      return;
    }

    try {
      setVehicleVerificationStatus('uploading');
      setVehicleVerificationError(null);

      const driverId = currentUser?.uid || currentUser?.id;
      const { vinPhotoUrl, carPhotoUrls } = await uploadVehiclePhotos(driverId, vinPhotoUri, carPhotoUris);

      setVehicleVerificationStatus('verifying');
      await refreshVehicleVerificationSession();

      const result = await verifyVehicle(vinPhotoUrl, carPhotoUrls);
      setVehicleVerificationResult(result);

      if (result.status === 'approved') {
        setVehicleVerificationStatus('approved');

        if (result.vinData) {
          setFormData((prevFormData) => ({
            ...prevFormData,
            vehicleInfo: {
              ...prevFormData.vehicleInfo,
              make: result.vinData.make || prevFormData.vehicleInfo.make,
              model: result.vinData.model || prevFormData.vehicleInfo.model,
              year: result.vinData.year || prevFormData.vehicleInfo.year,
              vin: result.extractedVin || prevFormData.vehicleInfo.vin,
              color: result.detectedColor || prevFormData.vehicleInfo.color,
              licensePlate: result.detectedLicensePlate || prevFormData.vehicleInfo.licensePlate,
            },
          }));
        }
      } else {
        setVehicleVerificationStatus('rejected');
        setFormData((prevFormData) => ({
          ...prevFormData,
          vehicleInfo: {
            ...prevFormData.vehicleInfo,
            make: '',
            model: '',
            year: '',
            vin: '',
            color: '',
            licensePlate: '',
          },
        }));
      }
    } catch (error) {
      logger.error('VehicleVerificationFlow', 'Vehicle verification error', error);
      setVehicleVerificationStatus('error');
      setVehicleVerificationError(error.message || 'Verification failed. Please try again.');
    }
  }, [carPhotoUris, currentUser, setFormData, vinPhotoUri]);

  return {
    vinPhotoUri,
    setVinPhotoUri,
    carPhotoUris,
    setCarPhotoUris,
    vehicleVerificationStatus,
    setVehicleVerificationStatus,
    vehicleVerificationResult,
    vehicleVerificationError,
    takeVinPhoto,
    takeCarPhoto,
    resetVinPhoto,
    resetCarPhoto,
    showVinHintAlert,
    showVehiclePhotoHintAlert,
    handleVerifyVehicle,
  };
}
