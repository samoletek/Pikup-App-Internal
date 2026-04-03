// Camera Screen component: orchestrates camera capture flow with overlay guidance and thumbnail queue.
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  StatusBar,
  PanResponder,
} from 'react-native';
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

const getPinchDistance = (touches = []) => {
  if (touches.length < 2) {
    return 0;
  }

  const [firstTouch, secondTouch] = touches;
  const distanceX = firstTouch.pageX - secondTouch.pageX;
  const distanceY = firstTouch.pageY - secondTouch.pageY;

  return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
};

const CameraScreen = ({
  visible,
  onCapture,
  onClose,
  alreadyCount = 0,
  maxPhotos = DEFAULT_MAX_CAMERA_PHOTOS,
  minPhotosRequired = 1,
  showGuideOverlay = true,
  enableGuideFrameCrop = true,
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
    zoom,
    setZoom,
    maxZoom,
    cameraRef,
    canCapture,
    remaining,
    canDone,
    donePhotosRemaining,
    handleCapture,
    handleRemove,
    handleDone,
    handleClose,
  } = useCameraCaptureSession({
    onCapture,
    onClose,
    alreadyCount,
    maxPhotos,
    minPhotosRequired,
    enableGuideFrameCrop,
  });
  const pinchBaseRef = useRef({ distance: 0, zoom: 0 });
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 2,
        onPanResponderGrant: (event) => {
          const distance = getPinchDistance(event.nativeEvent.touches);

          if (!distance) {
            return;
          }

          pinchBaseRef.current = {
            distance,
            zoom: zoomRef.current,
          };
        },
        onPanResponderMove: (event) => {
          const distance = getPinchDistance(event.nativeEvent.touches);
          const baseDistance = pinchBaseRef.current.distance;

          if (!distance || !baseDistance) {
            return;
          }

          const scale = distance / baseDistance;
          const rawZoom = pinchBaseRef.current.zoom + (scale - 1) * maxZoom;
          const nextZoom = Math.min(maxZoom, Math.max(0, rawZoom));

          setZoom(nextZoom);
        },
        onPanResponderRelease: () => {
          pinchBaseRef.current.distance = 0;
        },
        onPanResponderTerminate: () => {
          pinchBaseRef.current.distance = 0;
        },
      }),
    [maxZoom, setZoom],
  );

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
          <View style={styles.cameraLayer} {...pinchResponder.panHandlers}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraLayer}
              facing={facing}
              zoom={zoom}
              pointerEvents="none"
            />
          </View>

          {showGuideOverlay ? <CameraOverlayGuide /> : null}

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
            canDone={canDone}
            doneLabel={canDone ? 'Done' : `Add ${donePhotosRemaining} more`}
          />
        </View>
      )}
    </Modal>
  );
};

export default CameraScreen;
