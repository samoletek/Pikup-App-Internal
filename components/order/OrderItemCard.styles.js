import { StyleSheet } from 'react-native';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../styles/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
  },
  cardHeaderMain: {
    flex: 1,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
  },
  placeholderThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  itemName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  badges: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginRight: 6,
  },
  badgeFragile: {
    backgroundColor: colors.secondaryLight,
  },
  badgeInsured: {
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  cardContent: {
    padding: spacing.base,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  field: {
    marginTop: spacing.base,
  },
  fieldLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    padding: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoContainer: {
    position: 'relative',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.circle,
    zIndex: 10,
  },
  addPhotoBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  addPhotoTextWrap: {
    marginLeft: 12,
  },
  addPhotoIconTrailing: {
    marginLeft: 'auto',
  },
  addPhotoBtnTopTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  addPhotoBtnTopSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  photoGridTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.base,
  },
  conditionBtnGroup: {
    flexDirection: 'row',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.full,
    padding: 2,
    marginBottom: spacing.base,
  },
  conditionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.xl,
  },
  conditionBtnActive: {
    backgroundColor: colors.primary,
  },
  conditionBtnText: {
    color: colors.text.muted,
    fontWeight: typography.fontWeight.semibold,
  },
  conditionBtnTextActive: {
    color: colors.white,
  },
  booleanBtnGroup: {
    flexDirection: 'row',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.full,
    padding: 2,
    gap: spacing.xs,
  },
  booleanBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  booleanBtnActive: {
    backgroundColor: colors.primary,
  },
  booleanBtnText: {
    color: colors.text.muted,
    fontWeight: typography.fontWeight.semibold,
  },
  booleanBtnTextActive: {
    color: colors.white,
  },
  coverageInfoBox: {
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  coverageInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  coverageInfoTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  coverageInfoBody: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  invoiceSection: {
    marginTop: spacing.base,
    padding: spacing.base,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
  },
  invoiceLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  invoicePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoicePreviewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  invoiceImage: {
    width: 60,
    height: 80,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  invoiceImageNoMargin: {
    marginRight: 0,
  },
  removeInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeInvoiceText: {
    color: colors.error,
    marginLeft: 6,
    fontWeight: typography.fontWeight.semibold,
  },
  uploadInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.base,
  },
  uploadInvoiceText: {
    color: colors.primary,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  errorBorder: {
    borderWidth: 1,
    borderColor: colors.error,
  },
});

export default styles;
