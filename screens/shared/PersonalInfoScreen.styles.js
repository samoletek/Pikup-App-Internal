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
  sectionBlock: {
    marginBottom: spacing.base,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
    padding: spacing.base,
  },
  photoCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  profilePhotoContainer: {
    position: "relative",
    width: 104,
    height: 104,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  profilePhotoText: {
    fontSize: 34,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  profilePhotoImage: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.circle,
  },
  editIconOverlay: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  photoHint: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  inputGroup: {
    marginBottom: spacing.base,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: spacing.xs,
  },
  verifiedBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  phoneText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  textInput: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  passwordInputRow: {
    position: "relative",
  },
  passwordTextInput: {
    paddingRight: spacing.xxl + spacing.sm,
  },
  passwordVisibilityButton: {
    position: "absolute",
    right: spacing.base - 2,
    top: "50%",
    marginTop: -10,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  textInputDisabled: {
    color: colors.text.muted,
    backgroundColor: colors.background.tertiary,
  },
  inputNote: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  switchRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
    paddingVertical: spacing.sm,
  },
  switchRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  switchInfo: {
    flex: 1,
    paddingRight: spacing.base,
  },
  switchTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginBottom: spacing.xs,
  },
  switchDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  passwordActionButton: {
    marginTop: spacing.base,
    minHeight: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordActionButtonDisabled: {
    opacity: 0.6,
  },
  passwordActionButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionLabelDanger: {
    color: colors.error,
  },
  dangerCard: {
    borderColor: colors.error,
    backgroundColor: colors.background.secondary,
  },
  dangerDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.35,
  },
  dangerButton: {
    marginTop: spacing.base,
    minHeight: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default styles;
