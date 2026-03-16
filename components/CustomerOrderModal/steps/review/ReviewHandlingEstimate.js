// Review handling estimate component: shows self-handling or labor estimate details.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles';
import { colors, spacing } from '../../../../styles/theme';

const localStyles = StyleSheet.create({
  selfHandlingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

const ReviewHandlingEstimate = ({ isSelfHandling, handlingEstimate }) => {
  if (isSelfHandling) {
    return (
      <View style={styles.handlingEstimateBox}>
        <View style={localStyles.selfHandlingHeader}>
          <Ionicons name="time-outline" size={18} color={colors.secondary} />
          <Text style={styles.handlingEstimateTitle}>Self-Handling</Text>
        </View>
        <Text style={styles.handlingEstimateHint}>
          Please be at the location ~5 min before the driver arrives. You will handle loading and unloading yourself.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.handlingEstimateBox}>
      <Text style={styles.handlingEstimateTitle}>Estimated Loading & Unloading</Text>
      <View style={styles.handlingEstimateRow}>
        <Text style={styles.handlingEstimateLabel}>Loading</Text>
        <Text style={styles.handlingEstimateValue}>{handlingEstimate.loading}</Text>
      </View>
      <View style={styles.handlingEstimateRow}>
        <Text style={styles.handlingEstimateLabel}>Unloading</Text>
        <Text style={styles.handlingEstimateValue}>{handlingEstimate.unloading}</Text>
      </View>
      <Text style={styles.handlingEstimateHint}>{handlingEstimate.hint}</Text>
    </View>
  );
};

export default ReviewHandlingEstimate;
