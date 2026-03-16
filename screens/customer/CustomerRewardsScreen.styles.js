import { StyleSheet } from 'react-native';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  creditsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  creditsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  creditsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  creditsAmount: {
    fontSize: 40,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  creditsSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.sm,
  },
  promoInputContainer: {
    flex: 1,
  },
  promoInput: {
    minHeight: 44,
    height: 44,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  promoButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  promoButtonDisabled: {
    opacity: 0.4,
  },
  promoFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  promoFeedbackText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  referralContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  referralIconCircle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  referralTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  referralSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  shareButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
  },
  milestoneContent: {
    padding: spacing.lg,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  milestoneTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  milestoneAchieved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  milestoneAchievedText: {
    fontSize: typography.fontSize.base,
    color: colors.success,
    fontWeight: typography.fontWeight.medium,
  },
  progressBarContainer: {
    marginBottom: spacing.md,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xs,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'right',
  },
  milestoneReward: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    textAlign: 'center',
  },
});

export default styles;
