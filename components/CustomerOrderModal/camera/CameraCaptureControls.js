// Camera capture controls component: renders thumbnails strip and bottom capture/done controls.
import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../styles/theme';
import styles from '../CameraScreen.styles';

const HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

const CameraCaptureControls = ({
  capturedPhotos,
  onRemove,
  remaining,
  canCapture,
  onCapture,
  onDone,
}) => (
  <>
    {capturedPhotos.length > 0 && (
      <View style={styles.thumbStrip}>
        <FlatList
          data={capturedPhotos}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.base }}
          renderItem={({ item, index }) => (
            <View style={styles.thumbWrapper}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => onRemove(index)}
                hitSlop={HIT_SLOP}
              >
                <Ionicons name="close-circle" size={30} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    )}

    <View style={styles.bottomRow}>
      <View style={styles.counterBox}>
        {remaining > 0 ? (
          <Text style={styles.counterText}>{remaining} left</Text>
        ) : (
          <Text style={[styles.counterText, { color: colors.warning }]}>Max reached</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}
        onPress={onCapture}
        disabled={!canCapture}
      >
        <View style={[styles.captureBtnInner, !canCapture && { backgroundColor: colors.border.light }]} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.doneBtn, capturedPhotos.length === 0 && styles.doneBtnDisabled]}
        onPress={onDone}
        disabled={capturedPhotos.length === 0}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  </>
);

export default CameraCaptureControls;
