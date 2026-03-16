import { StyleSheet } from 'react-native';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  topSection: {
    width: '100%',
    alignSelf: 'center',
  },
  listViewport: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    marginTop: spacing.sm + spacing.xs,
  },
  claimsList: {
    paddingHorizontal: spacing.base,
    paddingBottom: 100,
  },
  claimsListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  startClaimButton: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: borderRadius.full,
  },
  startClaimText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
  },
});

export default styles;
