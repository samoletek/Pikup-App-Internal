// Camera Screen component: orchestrates camera capture flow with overlay guidance and thumbnail queue.
import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, StatusBar } from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../styles/theme';
import { DEFAULT_MAX_CAMERA_PHOTOS } from './CameraScreen.constants';
import styles from './CameraScreen.styles';
import CameraOverlayGuide from './camera/CameraOverlayGuide';
import CameraCaptureControls from './camera/CameraCaptureControls';
import CameraPermissionState from './camera/CameraPermissionState';
import { useCameraCaptureSession } from './camera/useCameraCaptureSession';

const CameraScreen = ({
  visible,
  onCapture,
  onClose,
  alreadyCount = 0,
  maxPhotos = DEFAULT_MAX_CAMERA_PHOTOS,
}) => {
  const insets = useSafeAreaInsets();
  const androidStatusBarInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const headerTopInset = Math.max(insets.top, androidStatusBarInset);
  const {
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
  } = useCameraCaptureSession({
    onCapture,
    onClose,
    alreadyCount,
    maxPhotos,
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {!permission?.granted ? (
        <CameraPermissionState
          onRequestPermission={requestPermission}
          onClose={handleClose}
        />
      ) : (
        <View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            facing={facing}
          />

          <CameraOverlayGuide />

          <View style={[styles.header, { top: headerTopInset + spacing.sm }]}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
              <Ionicons name="close" size={28} color={colors.white} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {capturedPhotos.length > 0
                ? `${capturedPhotos.length} photo${capturedPhotos.length > 1 ? 's' : ''} taken`
                : 'Take Photo'}
            </Text>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
            >
              <Ionicons name="camera-reverse-outline" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>

          <CameraCaptureControls
            capturedPhotos={capturedPhotos}
            onRemove={handleRemove}
            remaining={remaining}
            canCapture={canCapture}
            onCapture={handleCapture}
            onDone={handleDone}
          />
        </View>
      )}
    </Modal>
  );
};

export default CameraScreen;
