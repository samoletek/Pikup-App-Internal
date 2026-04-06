import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../styles/theme';

const normalizeRelativeBearing = (heading, mapBearing) => {
  const rawDifference = Number(heading || 0) - Number(mapBearing || 0);
  const normalizedDifference = ((rawDifference + 540) % 360) - 180;
  return Number.isFinite(normalizedDifference) ? normalizedDifference : 0;
};

const NAVIGATION_PUCK_SOURCE = require('../../assets/navigation-puck.png');

export default function DriverNavigationPuck({ heading = 0, mapBearing = 0 }) {
  const relativeBearing = normalizeRelativeBearing(heading, mapBearing);
  const rotation = `${relativeBearing}deg`;

  return (
    <View style={styles.shadow}>
      <Image
        source={NAVIGATION_PUCK_SOURCE}
        style={[styles.puckImage, { transform: [{ rotate: rotation }] }]}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 8,
  },
  puckImage: {
    width: 38,
    height: 38,
  },
});
