import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../styles/theme';

export default function ClaimsEmptyState({ activeTab }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={48} color={colors.text.subtle} />
      <Text style={styles.emptyStateText}>
        {activeTab === 'ongoing' ? 'No ongoing claims' : 'No completed claims'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        Claims can only be filed for deliveries with insurance coverage
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    color: colors.text.subtle,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: typography.fontSize.base,
    color: colors.text.subtle,
    textAlign: 'center',
    marginTop: spacing.xs + 1,
  },
});
