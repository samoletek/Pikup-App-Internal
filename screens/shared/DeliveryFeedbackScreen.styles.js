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
  title: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
  },
  toggleText: {
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  activeBtn: {
    backgroundColor: colors.primary,
  },
  activeText: {
    color: colors.text.primary,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverName: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
  vehicle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  stars: {
    color: colors.primary,
    marginTop: spacing.xs,
  },
  vehicleImg: {
    width: 80,
    height: 50,
    resizeMode: 'contain',
  },
  viewPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  viewPhotosText: {
    color: colors.primary,
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  label: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  subLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tipBtn: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tipSelected: {
    backgroundColor: colors.primary,
  },
  tipText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  tipInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + 2,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
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
    borderRadius: 30,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  submitText: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
  disabledBtn: {
    backgroundColor: colors.text.placeholder,
    opacity: 0.6,
  },
  claimBtn: {
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  claimText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
  startClaimButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
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
