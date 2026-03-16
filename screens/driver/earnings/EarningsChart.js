import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../../../styles/theme';

export default function EarningsChart({
  styles,
  loading,
  chartTitle,
  weeklyData,
}) {
  if (loading) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{chartTitle}</Text>
        <View style={styles.loadingChart}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const maxTrips = Math.max(...weeklyData.map((day) => day.trips), 1);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{chartTitle}</Text>
      <View style={styles.chartWrapper}>
        {weeklyData.map((day, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max((day.trips / maxTrips) * 60, 4),
                    backgroundColor: day.trips > 0 ? colors.success : colors.border.strong,
                  },
                ]}
              />
              <Text
                style={[
                  styles.barValue,
                  { color: day.trips > 0 ? colors.text.primary : colors.text.subtle },
                ]}
              >
                {day.trips}
              </Text>
            </View>
            <Text style={styles.barLabel}>{day.day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
          <Text style={styles.legendText}>Daily Trips</Text>
        </View>
      </View>
    </View>
  );
}
