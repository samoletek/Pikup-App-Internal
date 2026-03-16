import { useRef, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { DEFAULT_MAX_CAMERA_PHOTOS } from '../CameraScreen.constants';
import { logger } from '../../../services/logger';

export const useCameraCaptureSession = ({
  onCapture,
  onClose,
  alreadyCount = 0,
  maxPhotos = DEFAULT_MAX_CAMERA_PHOTOS,
}) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const cameraRef = useRef(null);

  const totalLimit = Math.max(1, Number(maxPhotos) || DEFAULT_MAX_CAMERA_PHOTOS);
  const canCapture = capturedPhotos.length + alreadyCount < totalLimit;
  const remaining = totalLimit - alreadyCount - capturedPhotos.length;

  const handleCapture = async () => {
    if (!cameraRef.current || !canCapture) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedPhotos((prev) => [...prev, photo]);
      }
    } catch (error) {
      logger.error('CameraScreen', 'Camera capture failed', error);
    }
  };

  const handleRemove = (index) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDone = () => {
    onCapture(capturedPhotos);
    setCapturedPhotos([]);
  };

  const handleClose = () => {
    setCapturedPhotos([]);
    onClose();
  };

  return {
    facing,
    setFacing,
    permission,
    requestPermission,
    capturedPhotos,
    cameraRef,
    canCapture,
    remaining,
    handleCapture,
    handleRemove,
    handleDone,
    handleClose,
  };
};
