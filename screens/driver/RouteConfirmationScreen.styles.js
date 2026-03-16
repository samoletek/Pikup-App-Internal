import { StyleSheet } from "react-native";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  mapPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.base,
  },
  mapPlaceholderText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.background.secondary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text.secondary,
    marginBottom: spacing.xs + 2,
    fontSize: typography.fontSize.base,
  },
  address: {
    color: colors.text.primary,
    marginBottom: spacing.sm + 2,
    fontSize: typography.fontSize.base,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  meta: {
    flex: 1,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  bold: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm + 2,
    marginBottom: spacing.base,
  },
  pill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
  },
  activePill: {
    backgroundColor: colors.primary,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  activePillText: {
    color: colors.white,
  },
  textArea: {
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm + 2,
    height: 100,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  charCount: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs + 1,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  helpLabel: {
    marginTop: spacing.lg,
  },
  toggleRow: {
    flexDirection: "row",
    marginVertical: spacing.sm + 2,
    gap: spacing.sm + 2,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  activeToggle: {
    backgroundColor: colors.primaryDark,
  },
  toggleText: {
    color: colors.text.secondary,
  },
  activeToggleText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.sm + 2,
  },
  checkboxIcon: {
    marginRight: spacing.sm,
  },
  checkboxText: {
    color: colors.text.primary,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.light,
    borderRadius: borderRadius.sm + 2,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.background.tertiary,
  },
  uploadText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs + 2,
  },
  uploadBtn: {
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  uploadBtnText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  nextBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    marginTop: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  nextBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default styles;
