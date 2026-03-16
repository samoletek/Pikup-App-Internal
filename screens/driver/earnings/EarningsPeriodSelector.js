import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function EarningsPeriodSelector({
  styles,
  selectedPeriod,
  onSelectPeriod,
}) {
  return (
    <View style={styles.periodSelector}>
      <TouchableOpacity
        style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
        onPress={() => onSelectPeriod('week')}
      >
        <Text style={[styles.periodText, selectedPeriod === 'week' && styles.periodTextActive]}>
          This Week
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
        onPress={() => onSelectPeriod('month')}
      >
        <Text style={[styles.periodText, selectedPeriod === 'month' && styles.periodTextActive]}>
          This Month
        </Text>
      </TouchableOpacity>
    </View>
  );
}
