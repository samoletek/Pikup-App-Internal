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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.base,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroPayout: {
    color: colors.white,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  heroTagText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroMetaText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  heroSubText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  sectionTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.base,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.circle,
    marginTop: 4,
    marginRight: spacing.sm,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xxs,
  },
  routeText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  routeDivider: {
    height: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.base,
    marginLeft: spacing.xl,
  },
  noteLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xxs,
  },
  noteText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  itemMeta: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xxs,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  photosRow: {
    gap: spacing.sm,
  },
  photoLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoLoadingText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
  },
  photo: {
    width: 108,
    height: 108,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.elevated,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.base,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default styles;
