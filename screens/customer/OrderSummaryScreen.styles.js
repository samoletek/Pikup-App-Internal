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
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  section: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm + 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm + 2,
    flex: 1,
    lineHeight: 20,
  },
  dotLine: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs + 1,
  },
  dot: {
    width: 2,
    height: 2,
    backgroundColor: colors.text.subtle,
    borderRadius: borderRadius.circle,
    marginVertical: 2,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  tripMetaText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
  },
  tripMetaDivider: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    marginHorizontal: spacing.sm,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleImage: {
    width: 60,
    height: 35,
    resizeMode: 'contain',
    marginRight: spacing.md,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleType: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  vehicleEta: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    marginTop: 2,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalPrice: {
    color: colors.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  breakdownContainer: {
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm - 2,
  },
  priceLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  priceValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  paymentText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base + 1,
    fontWeight: typography.fontWeight.medium,
  },
  paymentTextHighlight: {
    color: colors.primary,
  },
  paymentSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  bottomInner: {
    width: '100%',
    alignSelf: 'center',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.text.subtle,
  },
  confirmIcon: {
    marginRight: spacing.sm,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default styles;
