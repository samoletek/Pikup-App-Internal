import { StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 140,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },

  // Rating section
  ratingSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  ratingLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.base,
  },

  // Sections
  section: {
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.base,
    lineHeight: typography.fontSize.base * 1.5,
  },

  // Tip grid (3x2)
  tipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tipBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  tipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tipText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  tipTextSelected: {
    color: colors.primary,
  },
  enterOtherAmount: {
    color: colors.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  customTipInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },

  // Badge chips
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeChip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
  },
  badgeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  badgeChipText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  badgeChipTextSelected: {
    color: colors.primary,
  },

  // Comment
  commentSection: {
    marginTop: spacing.lg,
  },
  commentInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    minHeight: 120,
    textAlignVertical: 'top',
  },

  // Bottom button
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background.primary,
    gap: spacing.md - 2,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  submitText: {
    color: colors.white,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.md,
  },
  disabledBtn: {
    backgroundColor: colors.text.placeholder,
    opacity: 0.6,
  },

  // Claim button
  startClaimButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  startClaimText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
    marginLeft: spacing.sm,
  },
});

export default styles;
