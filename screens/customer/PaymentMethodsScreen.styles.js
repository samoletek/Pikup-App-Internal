import { StyleSheet } from "react-native";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

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
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  methodInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.tertiary,
    marginRight: spacing.sm,
  },
  methodCopy: {
    flex: 1,
  },
  methodTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  methodSubtitle: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  methodActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    color: colors.success,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  linkButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.errorLight,
  },
  addButton: {
    marginTop: spacing.base,
    height: 54,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  helperText: {
    marginTop: spacing.sm,
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },
});

export default styles;
