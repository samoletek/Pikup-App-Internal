// Claim Card component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppCard from '../ui/AppCard';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../styles/theme';

export default function ClaimCard({
  item,
  statusColor,
  statusText,
  resolutionText,
  showResolution,
}) {
  return (
    <AppCard style={styles.claimCard}>
      <View style={styles.claimHeader}>
        <View style={styles.claimInfo}>
          <Text style={styles.claimDate}>{item.date}</Text>
          <Text style={styles.claimItem}>{item.item}</Text>
        </View>
        <Text style={styles.claimAmount}>{item.amount}</Text>
      </View>

      <Text style={styles.claimDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${item.progress}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>

      {showResolution && (
        <View style={styles.resolutionContainer}>
          <Text style={styles.resolutionLabel}>Resolution:</Text>
          <Text style={styles.resolutionText}>{resolutionText}</Text>
          <Text style={styles.completedDate}>Completed on {item.completedDate}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.viewDetailsButton}>
        <Text style={styles.viewDetailsText}>View Details</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  claimCard: {
    marginBottom: spacing.base,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  claimInfo: {
    flex: 1,
  },
  claimDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  claimItem: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  claimAmount: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  claimDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.strong,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  resolutionContainer: {
    backgroundColor: colors.background.primary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    marginBottom: spacing.base,
  },
  resolutionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  resolutionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  completedDate: {
    fontSize: typography.fontSize.xs,
    color: colors.success,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  viewDetailsText: {
    fontSize: typography.fontSize.base,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
