import { StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  contentColumn: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  summarySubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xxs,
  },
  refreshButton: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: borderRadius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  tripCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.sm,
    padding: spacing.base,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tripLeft: {
    flex: 1,
  },
  tripRight: {
    alignItems: 'flex-end',
  },
  tripDate: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xxs,
  },
  tripTime: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  tripAmount: {
    color: colors.success,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  tripRoute: {
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  routeText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  routeLine: {
    width: 1,
    height: spacing.md,
    backgroundColor: colors.text.subtle,
    marginLeft: spacing.xs + 1,
    marginVertical: spacing.xxs,
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.strong,
    paddingTop: spacing.sm,
  },
  tripFooterText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginRight: spacing.xs,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxxl,
  },
  loadingText: {
    marginTop: spacing.base,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  emptyState: {
    paddingTop: spacing.xxxl,
    marginHorizontal: spacing.base,
  },
});

export default styles;
