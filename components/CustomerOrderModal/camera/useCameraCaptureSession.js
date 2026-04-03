import { Alert } from 'react-native';
import { useRef, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  BOX_HEIGHT,
  BOX_LEFT,
  BOX_TOP,
  BOX_WIDTH,
  DEFAULT_MAX_CAMERA_PHOTOS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../CameraScreen.constants';
import { logger } from '../../../services/logger';

const CAMERA_CAPTURE_QUALITY = 0.5;
const MAX_CAMERA_ZOOM = 0.9;
const HIGH_ZOOM_SOFTNESS_THRESHOLD = 0.72;
const MID_ZOOM_SOFTNESS_THRESHOLD = 0.62;
const MIN_PIXELS_FOR_MID_ZOOM = 2_500_000;
const MIN_CROP_SIDE_PX = 8;

const getGuideFrameCropRect = ({ imageWidth, imageHeight }) => {
  const width = Number(imageWidth) || 0;
  const height = Number(imageHeight) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  // Camera preview fills the screen with "cover" behavior.
  const previewScale = Math.max(SCREEN_WIDTH / width, SCREEN_HEIGHT / height);
  const renderedWidth = width * previewScale;
  const renderedHeight = height * previewScale;
  const overflowX = Math.max(0, (renderedWidth - SCREEN_WIDTH) / 2);
  const overflowY = Math.max(0, (renderedHeight - SCREEN_HEIGHT) / 2);

  const rawOriginX = (BOX_LEFT + overflowX) / previewScale;
  const rawOriginY = (BOX_TOP + overflowY) / previewScale;
  const rawCropWidth = BOX_WIDTH / previewScale;
  const rawCropHeight = BOX_HEIGHT / previewScale;

  const originX = Math.max(0, Math.min(width - 1, Math.round(rawOriginX)));
  const originY = Math.max(0, Math.min(height - 1, Math.round(rawOriginY)));
  const cropWidth = Math.max(
    1,
    Math.min(width - originX, Math.round(rawCropWidth)),
  );
  const cropHeight = Math.max(
    1,
    Math.min(height - originY, Math.round(rawCropHeight)),
  );

  if (cropWidth < MIN_CROP_SIDE_PX || cropHeight < MIN_CROP_SIDE_PX) {
    return null;
  }

  return {
    originX,
    originY,
    width: cropWidth,
    height: cropHeight,
  };
};

export const useCameraCaptureSession = ({
  onCapture,
  onClose,
  alreadyCount = 0,
  maxPhotos = DEFAULT_MAX_CAMERA_PHOTOS,
  minPhotosRequired = 1,
  enableGuideFrameCrop = true,
}) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef(null);

  const totalLimit = Math.max(1, Number(maxPhotos) || DEFAULT_MAX_CAMERA_PHOTOS);
  const canCapture = capturedPhotos.length + alreadyCount < totalLimit;
  const remaining = totalLimit - alreadyCount - capturedPhotos.length;
  const minimumRequired = Math.max(1, Number(minPhotosRequired) || 1);
  const canDone = capturedPhotos.length >= minimumRequired;
  const donePhotosRemaining = Math.max(0, minimumRequired - capturedPhotos.length);

  const handleCapture = async () => {
    if (!cameraRef.current || !canCapture) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: CAMERA_CAPTURE_QUALITY,
        base64: false,
      });

      if (photo?.uri) {
        if (!enableGuideFrameCrop) {
          setCapturedPhotos((prev) => [...prev, photo]);
          return;
        }

        const capturedPixels = Number(photo?.width || 0) * Number(photo?.height || 0);
        const isLikelyTooSoft =
          zoom >= HIGH_ZOOM_SOFTNESS_THRESHOLD ||
          (zoom >= MID_ZOOM_SOFTNESS_THRESHOLD &&
            capturedPixels > 0 &&
            capturedPixels < MIN_PIXELS_FOR_MID_ZOOM);

        if (isLikelyTooSoft) {
          Alert.alert('фото недостаточно чёткое');
          return;
        }

        const cropRect = getGuideFrameCropRect({
          imageWidth: photo?.width,
          imageHeight: photo?.height,
        });

        if (!cropRect) {
          Alert.alert('Не удалось обработать фото. Попробуйте снова.');
          return;
        }

        const croppedPhoto = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ crop: cropRect }],
          {
            compress: CAMERA_CAPTURE_QUALITY,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false,
          },
        );

        if (!croppedPhoto?.uri) {
          Alert.alert('Не удалось обработать фото. Попробуйте снова.');
          return;
        }

        setCapturedPhotos((prev) => [
          ...prev,
          {
            ...photo,
            ...croppedPhoto,
          },
        ]);
      }
    } catch (error) {
      logger.error('CameraScreen', 'Camera capture failed', error);
    }
  };

  const handleRemove = (index) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDone = () => {
    if (!canDone) {
      return;
    }
    onCapture(capturedPhotos);
    setCapturedPhotos([]);
    setZoom(0);
  };

  const handleClose = () => {
    setCapturedPhotos([]);
    setZoom(0);
    onClose();
  };

  return {
    facing,
    setFacing,
    permission,
    requestPermission,
    capturedPhotos,
    zoom,
    setZoom,
    maxZoom: MAX_CAMERA_ZOOM,
    cameraRef,
    canCapture,
    remaining,
    minimumRequired,
    canDone,
    donePhotosRemaining,
    handleCapture,
    handleRemove,
    handleDone,
    handleClose,
  };
};
