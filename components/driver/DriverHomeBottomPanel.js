import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

export default function DriverHomeBottomPanel({
  isCompact,
  isRestoringActiveTrip,
  hasActiveTrip,
  activeJob,
  activeJobStatusLabel,
  activeJobDestinationAddress,
  activeJobSecondaryLabel,
  onResumeTrip,
  isOnline,
  isScheduledPoolActive,
  waitTime,
  progressValue,
  onGoOffline,
  onGoOnline,
  onGoOnlineScheduled,
  onViewScheduledRequests,
  isDriverGeoRestricted,
  onViewAcceptedRequests,
}) {
  return (
    <View style={styles.bottomPanel}>
      {isRestoringActiveTrip ? (
        <View style={styles.restoringTripContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.restoringTripText}>Restoring active order...</Text>
        </View>
      ) : hasActiveTrip && activeJob ? (
        <View style={styles.activeTripContainer}>
          <View style={styles.activeTripHeader}>
            <View style={styles.activeTripHeaderIcon}>
              <Ionicons name="navigate" size={16} color={colors.white} />
            </View>
            <View style={styles.activeTripHeaderTextWrap}>
              <Text style={styles.activeTripTitle}>Active Order</Text>
              <Text style={styles.activeTripStatusText}>{activeJobStatusLabel}</Text>
            </View>
          </View>

          <Text style={styles.activeTripAddress} numberOfLines={2}>
            {activeJobDestinationAddress}
          </Text>

          {activeJobSecondaryLabel ? (
            <Text style={styles.activeTripSecondaryLabel} numberOfLines={1}>
              {activeJobSecondaryLabel}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.activeTripButton}
            onPress={onResumeTrip}
            activeOpacity={0.85}
          >
            <Text style={styles.activeTripButtonText}>Resume trip</Text>
          </TouchableOpacity>
        </View>
      ) : isOnline ? (
        <>
          <View style={styles.waitTimeContainer}>
            <Text style={styles.waitTimeText}>
              {isScheduledPoolActive ? 'Scheduled mode is active' : `${waitTime} wait in your area`}
            </Text>
            <Text style={styles.waitTimeSubtext}>
              {isScheduledPoolActive
                ? 'Showing nearest scheduled requests by pickup time and location.'
                : 'Average wait for 10 pickup request over the last hour'}
            </Text>
          </View>

          {isScheduledPoolActive && (
            <View style={styles.secondaryOnlineActionsRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryOnlineAction,
                  styles.secondaryOnlineActionHalf,
                  styles.secondaryOnlineActionFirst,
                ]}
                onPress={onViewScheduledRequests}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryOnlineActionText}>View Scheduled Requests</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryOnlineAction, styles.secondaryOnlineActionHalf]}
                onPress={onViewAcceptedRequests}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryOnlineActionText}>View Accepted Requests</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Current Progress</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progressValue * 100}%` }]} />
            </View>
            <Text style={styles.nextLevelText}>Next Level: Gold</Text>
          </View>

          <TouchableOpacity
            style={styles.goOfflineButton}
            onPress={onGoOffline}
            activeOpacity={0.8}
          >
            <View style={styles.onlineButtonCircle} />
            <Text style={styles.goOfflineText}>Go Offline</Text>
          </TouchableOpacity>
        </>
      ) : isDriverGeoRestricted ? (
        <View style={[styles.offlineActionsStack, isCompact && styles.offlineActionsStackCompact]}>
          <TouchableOpacity
            style={[
              styles.offlineRoleButton,
              styles.offlineRoleButtonDisabled,
              isCompact && styles.offlineRoleButtonCompact,
            ]}
            disabled
            activeOpacity={1}
          >
            <View style={styles.lockedButtonContent}>
              <Ionicons name="lock-closed" size={14} color={colors.text.primary} />
              <Text style={styles.offlineRoleButtonTextDisabled}>Go Online</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.offlineRoleButton,
              styles.offlineRoleButtonDark,
              styles.offlineRoleButtonDisabled,
              isCompact && styles.offlineRoleButtonCompact,
            ]}
            disabled
            activeOpacity={1}
          >
            <View style={styles.lockedButtonContent}>
              <Ionicons name="lock-closed" size={14} color={colors.text.primary} />
              <Text style={styles.offlineRoleButtonTextDisabled}>
                Go Online Scheduled
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.offlineActionsStack, isCompact && styles.offlineActionsStackCompact]}>
          <TouchableOpacity
            style={[styles.offlineRoleButton, isCompact && styles.offlineRoleButtonCompact]}
            onPress={onGoOnline}
            activeOpacity={0.8}
          >
            <Text style={styles.offlineRoleButtonText}>Go Online</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.offlineRoleButton,
              styles.offlineRoleButtonDark,
              isCompact && styles.offlineRoleButtonCompact,
            ]}
            onPress={onGoOnlineScheduled}
            activeOpacity={0.8}
          >
            <Text style={styles.offlineRoleButtonText}>Go Online Scheduled</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.navigation.tabBarBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.navigation.tabBarBorder,
  },
  restoringTripContainer: {
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoringTripText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  activeTripContainer: {
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    padding: spacing.base,
  },
  activeTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  activeTripHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  activeTripHeaderTextWrap: {
    flex: 1,
  },
  activeTripTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  activeTripStatusText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  activeTripAddress: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  activeTripSecondaryLabel: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.base,
  },
  activeTripButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTripButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.3,
  },
  waitTimeContainer: {
    marginBottom: spacing.md,
  },
  waitTimeText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  waitTimeSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    lineHeight: 16,
  },
  secondaryOnlineAction: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryOnlineActionsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  secondaryOnlineActionHalf: {
    flex: 1,
    marginBottom: 0,
  },
  secondaryOnlineActionFirst: {
    marginRight: spacing.sm,
  },
  secondaryOnlineActionText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  progressContainer: {
    backgroundColor: colors.background.panel,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBorder,
  },
  progressLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.background.elevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  nextLevelText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  offlineActionsStack: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  offlineActionsStackCompact: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  offlineRoleButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.base,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  offlineRoleButtonDark: {
    backgroundColor: colors.primaryDark,
  },
  offlineRoleButtonCompact: {
    width: '100%',
    flex: 0,
  },
  offlineRoleButtonDisabled: {
    opacity: 0.78,
    shadowOpacity: 0,
    elevation: 0,
  },
  offlineRoleButtonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  offlineRoleButtonTextDisabled: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  lockedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  goOfflineButton: {
    backgroundColor: colors.background.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: borderRadius.full,
    shadowColor: colors.background.elevated,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: colors.navigation.tabBarBorder,
  },
  onlineButtonCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
    shadowColor: colors.white,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  goOfflineText: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
    letterSpacing: 0.5,
    textShadowColor: colors.overlayDark,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
