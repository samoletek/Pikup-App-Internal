import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "../styles/theme";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.base,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successLight,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.success,
  },
  securityText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  cardSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardFieldContainer: {
    backgroundColor: colors.background.input,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 4,
  },
  cardFieldWrapper: {
    height: 50,
    marginVertical: 5,
  },
  cardField: {
    backgroundColor: colors.background.input,
    textColor: colors.text.primary,
    placeholderColor: colors.text.placeholder,
    borderRadius: 30,
    fontSize: 16,
    cursorColor: colors.success,
    textErrorColor: colors.error,
  },
  brandsContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  brandBadge: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  brandText: {
    color: colors.text.placeholder,
    fontSize: 10,
    fontWeight: "bold",
  },
  featuresList: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: "auto",
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    color: colors.text.placeholder,
    fontSize: 12,
    marginLeft: 4,
  },
  footer: {
    paddingBottom: 20,
  },
  btn: {
    height: 56,
    borderRadius: 30,
    marginTop: 8,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimary: {
    backgroundColor: colors.success,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
});

export default styles;
