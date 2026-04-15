// Review price breakdown component: displays fare composition and final payable total.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { styles } from '../../styles';
import { colors, typography, spacing } from '../../../../styles/theme';

const localStyles = StyleSheet.create({
  insuranceWarning: {
    fontSize: typography.fontSize.xs,
    color: colors.warning,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  bufferRowLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
});

const ReviewPriceBreakdownCard = ({
  pricing,
  insuranceLoading,
  insuranceError,
}) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryCardTitle}>Price Breakdown</Text>

    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>Base Fare</Text>
      <Text style={styles.priceValue}>${pricing?.baseFare?.toFixed(2) || '0.00'}</Text>
    </View>

    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>Mileage ({pricing?.distance || 0} mi)</Text>
      <Text style={styles.priceValue}>${pricing?.mileageFee?.toFixed(2) || '0.00'}</Text>
    </View>

    {pricing?.laborFee > 0 && (
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>
          Labor ({pricing.laborBillableMinutes || pricing.laborMinutes} min @ ${pricing.laborPerMin?.toFixed(2)}/min)
        </Text>
        <Text style={styles.priceValue}>${pricing.laborFee.toFixed(2)}</Text>
      </View>
    )}

    {pricing?.laborBufferMinutes > 0 && (
      <View style={styles.priceRow}>
        <Text style={[styles.priceLabel, localStyles.bufferRowLabel]}>
          Includes {pricing.laborBufferMinutes} min free buffer
        </Text>
      </View>
    )}

    {pricing?.surgeFee > 0 && (
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Surge ({pricing.surgeLabel})</Text>
        <Text style={styles.priceValue}>${pricing.surgeFee.toFixed(2)}</Text>
      </View>
    )}

    {(pricing?.insuranceApplied || pricing?.mandatoryInsurance > 0) && (
      <View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>
            Insurance{insuranceLoading ? ' (loading...)' : ''}
          </Text>
          <Text style={styles.priceValue}>
            {insuranceLoading
              ? '...'
              : `$${(pricing.mandatoryInsurance || 0).toFixed(2)}`
            }
          </Text>
        </View>

        {insuranceError && (
          <Text style={localStyles.insuranceWarning}>
            Could not verify insurance yet. We will retry before payment and ask you before creating an uninsured trip.
          </Text>
        )}
      </View>
    )}

    <View style={styles.priceDivider} />

    <View style={styles.priceRow}>
      <Text style={styles.totalLabel}>Total</Text>
      <Text style={styles.totalValue}>
        {insuranceLoading ? '...' : `$${pricing?.total?.toFixed(2) || '0.00'}`}
      </Text>
    </View>
  </View>
);

export default ReviewPriceBreakdownCard;
