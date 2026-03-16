import { StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

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
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },

  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
  },
  summaryBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
  },
  summaryBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },

  toggleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  toggleIconBoxActive: {
    backgroundColor: colors.overlayPrimarySoft,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  toggleDesc: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: typography.fontSize.sm * 1.35,
  },

  modePickerContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  modePickerLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  modePickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.tertiary,
  },
  modeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeOptionText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  modeOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },

  tipsBlock: {
    marginBottom: spacing.xl,
  },
  tipsLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  tipRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  tipText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    lineHeight: typography.fontSize.base * 1.35,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});

export default styles;
