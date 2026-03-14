import React from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

export default function PendingBookingSearchSheet({
  isExpanded,
  onToggleExpand,
  searchTimerLabel,
  pendingBookingSummary,
  searchSheetDetailsHeight,
  searchSheetDetailsOpacity,
  isCancellingPending,
  onCancelPendingBooking,
}) {
  return (
    <View style={styles.searchSheetContainer}>
      <TouchableOpacity
        style={styles.searchStatusCard}
        activeOpacity={0.9}
        onPress={onToggleExpand}
      >
        <View style={styles.searchStatusHeader}>
          <View style={styles.searchStatusMainTextWrap}>
            <View style={styles.searchSheetTitleRow}>
              <Text style={styles.searchSheetTitle}>Looking for your driver</Text>
              <Text style={styles.searchSheetSubtitle}>
                We are matching your trip now. Please wait.
              </Text>
            </View>
            <View style={styles.searchingTimerRow}>
              <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.searchingTimerText}>Search time: {searchTimerLabel}</Text>
            </View>
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={colors.text.tertiary}
          />
        </View>

        <Animated.View
          style={[
            styles.searchSheetDetailsAnimated,
            {
              height: searchSheetDetailsHeight,
              opacity: searchSheetDetailsOpacity,
            },
          ]}
        >
          <View style={styles.searchSheetDetails}>
            {pendingBookingSummary && (
              <>
                <View style={styles.searchDetailRow}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color={colors.primary} />
                  <Text style={styles.searchDetailText} numberOfLines={1}>
                    {pendingBookingSummary.pickupAddress}
                  </Text>
                </View>

                <View style={styles.searchDetailRow}>
                  <Ionicons name="arrow-down-circle-outline" size={14} color={colors.success} />
                  <Text style={styles.searchDetailText} numberOfLines={1}>
                    {pendingBookingSummary.dropoffAddress}
                  </Text>
                </View>

                <View style={styles.searchDetailMetaRow}>
                  <View style={styles.searchMetaPill}>
                    <Ionicons name="car-outline" size={13} color={colors.text.secondary} />
                    <Text style={styles.searchMetaPillText}>{pendingBookingSummary.vehicleType}</Text>
                  </View>
                  <View style={styles.searchMetaPill}>
                    <Ionicons name="cube-outline" size={13} color={colors.text.secondary} />
                    <Text style={styles.searchMetaPillText}>
                      {pendingBookingSummary.itemsCount} item
                      {pendingBookingSummary.itemsCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={styles.searchMetaPill}>
                    <Ionicons name="cash-outline" size={13} color={colors.text.secondary} />
                    <Text style={styles.searchMetaPillText}>
                      {pendingBookingSummary.totalAmountLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.searchScheduleRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.searchScheduleText}>{pendingBookingSummary.scheduleLabel}</Text>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.searchingCancelButton,
          styles.searchingCancelButtonStandalone,
          isCancellingPending && styles.searchingCancelButtonDisabled,
        ]}
        onPress={onCancelPendingBooking}
        activeOpacity={0.85}
        disabled={isCancellingPending}
      >
        {isCancellingPending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.searchingCancelButtonText}>Cancel Search</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    zIndex: 22,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 12,
  },
  searchStatusCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  searchStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchStatusMainTextWrap: {
    flex: 1,
    marginRight: spacing.base,
  },
  searchSheetTitleRow: {
    flexDirection: 'column',
  },
  searchSheetTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  searchSheetSubtitle: {
    marginTop: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  searchSheetDetailsAnimated: {
    overflow: 'hidden',
  },
  searchSheetDetails: {
    marginTop: spacing.base,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  searchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  searchDetailText: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  searchDetailMetaRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  searchMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchMetaPillText: {
    marginLeft: 6,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  searchScheduleRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchScheduleText: {
    marginLeft: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  searchingTimerRow: {
    marginTop: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchingTimerText: {
    marginLeft: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  searchingCancelButton: {
    width: '100%',
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
  searchingCancelButtonStandalone: {
    marginTop: spacing.md,
  },
  searchingCancelButtonDisabled: {
    opacity: 0.7,
  },
  searchingCancelButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
