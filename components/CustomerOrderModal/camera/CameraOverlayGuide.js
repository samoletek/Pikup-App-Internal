// Camera overlay guide component: renders framing mask, corners, and alignment hint over camera preview.
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../styles/theme';
import styles from '../CameraScreen.styles';
import {
  BOX_HEIGHT,
  BOX_LEFT,
  BOX_TOP,
  BOX_WIDTH,
  SIDE_OVERLAY_WIDTH,
  SCREEN_WIDTH,
} from '../CameraScreen.constants';

const CameraOverlayGuide = () => (
  <>
    <View
      pointerEvents="none"
      style={[styles.overlay, { top: 0, height: BOX_TOP, width: SCREEN_WIDTH }]}
    />

    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          top: BOX_TOP,
          height: BOX_HEIGHT,
          width: SIDE_OVERLAY_WIDTH,
          left: 0,
        },
      ]}
    />

    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          top: BOX_TOP,
          height: BOX_HEIGHT,
          width: SIDE_OVERLAY_WIDTH,
          right: 0,
        },
      ]}
    />

    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        {
          top: BOX_TOP + BOX_HEIGHT,
          bottom: 0,
          width: SCREEN_WIDTH,
        },
      ]}
    />

    <View
      pointerEvents="none"
      style={[
        styles.boxContainer,
        {
          top: BOX_TOP,
          left: BOX_LEFT,
          width: BOX_WIDTH,
          height: BOX_HEIGHT,
        },
      ]}
    >
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
    </View>

    <View
      pointerEvents="none"
      style={[styles.hintContainer, { top: BOX_TOP + BOX_HEIGHT + spacing.base }]}
    >
      <Ionicons name="scan-outline" size={14} color={colors.primary} />
      <Text style={styles.hintText}>Center the item in the frame</Text>
    </View>
  </>
);

export default CameraOverlayGuide;
