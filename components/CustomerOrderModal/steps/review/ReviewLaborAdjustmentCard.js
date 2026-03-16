// Review labor adjustment card: allows tuning labor minutes estimate in fixed increments.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles';
import { colors, typography, spacing, sizing, hitSlopDefault } from '../../../../styles/theme';

const SLIDER_VALUE_MIN_WIDTH = 80;

const localStyles = StyleSheet.create({
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  sliderBtn: {
    width: sizing.touchTargetMin,
    height: sizing.touchTargetMin,
    borderRadius: sizing.touchTargetMin / 2,
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnDisabled: {
    opacity: 0.4,
  },
  sliderValueBox: {
    minWidth: SLIDER_VALUE_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderValueText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  sliderEstimateLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sliderRangeText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs,
  },
  sliderBufferHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  sliderBufferHintText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
});

const ReviewLaborAdjustmentCard = ({
  laborSliderConfig,
  currentLaborMinutes,
  laborAdjustment,
  onLaborStep,
}) => {
  if (!laborSliderConfig) {
    return null;
  }

  const canDecrement = currentLaborMinutes > laborSliderConfig.min;
  const canIncrement = currentLaborMinutes < laborSliderConfig.max;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardTitle}>Adjust Labor Time</Text>
      <Text style={[styles.priceLabel, { marginBottom: spacing.md }]}>
        Move items take time. Adjust if you need more time.
      </Text>

      <View style={localStyles.sliderRow}>
        <TouchableOpacity
          style={[localStyles.sliderBtn, !canDecrement && localStyles.sliderBtnDisabled]}
          onPress={() => onLaborStep('down')}
          hitSlop={hitSlopDefault}
        >
          <Ionicons
            name="remove"
            size={22}
            color={canDecrement ? colors.text.primary : colors.text.muted}
          />
        </TouchableOpacity>

        <View style={localStyles.sliderValueBox}>
          <Text style={localStyles.sliderValueText}>{currentLaborMinutes} min</Text>
          {laborAdjustment === null && (
            <Text style={localStyles.sliderEstimateLabel}>estimated</Text>
          )}
        </View>

        <TouchableOpacity
          style={[localStyles.sliderBtn, !canIncrement && localStyles.sliderBtnDisabled]}
          onPress={() => onLaborStep('up')}
          hitSlop={hitSlopDefault}
        >
          <Ionicons
            name="add"
            size={22}
            color={canIncrement ? colors.text.primary : colors.text.muted}
          />
        </TouchableOpacity>
      </View>

      <View style={localStyles.sliderRange}>
        <Text style={localStyles.sliderRangeText}>{laborSliderConfig.min} min</Text>
        <Text style={localStyles.sliderRangeText}>{laborSliderConfig.max} min</Text>
      </View>

      {laborSliderConfig.bufferMinutes > 0 && (
        <View style={localStyles.sliderBufferHint}>
          <Ionicons name="information-circle" size={14} color={colors.primary} />
          <Text style={localStyles.sliderBufferHintText}>
            Includes {laborSliderConfig.bufferMinutes} min free buffer
          </Text>
        </View>
      )}
    </View>
  );
};

export default ReviewLaborAdjustmentCard;
