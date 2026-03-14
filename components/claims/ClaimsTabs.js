import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

export default function ClaimsTabs({
  activeTab,
  ongoingCount,
  completedCount,
  onTabChange,
}) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'ongoing' && styles.activeTab]}
        onPress={() => onTabChange('ongoing')}
      >
        <Text style={[styles.tabText, activeTab === 'ongoing' && styles.activeTabText]}>
          Ongoing ({ongoingCount})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
        onPress={() => onTabChange('completed')}
      >
        <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
          Completed ({completedCount})
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.muted,
  },
  activeTabText: {
    color: colors.white,
  },
});
