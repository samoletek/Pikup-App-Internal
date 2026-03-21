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
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: '100%',
    alignSelf: 'center',
  },
  sectionBlock: {
    marginBottom: spacing.base,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  rowText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  rowTitleDisabled: {
    color: colors.text.secondary,
  },
  rowSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  rowSubtitleDisabled: {
    color: colors.text.muted,
  },
  rowValue: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginRight: spacing.xs,
  },
  rowValueDisabled: {
    color: colors.text.muted,
  },
  switchRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  switchInfo: {
    flex: 1,
    paddingRight: spacing.base,
  },
  switchTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  switchControl: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  versionText: {
    textAlign: 'center',
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginTop: spacing.sm,
  },
});

export default styles;
