import { StyleSheet } from 'react-native';
import {
  borderRadius,
  colors,
  sizing,
  spacing,
  typography,
} from '../../styles/theme';

const STEPPER_VALUE_MIN_WIDTH = 56;
const STEPPER_INPUT_MIN_WIDTH = 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.xl,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupIcon: {
    backgroundColor: colors.primary,
  },
  dropoffIcon: {
    backgroundColor: colors.success,
  },
  addressInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  addressLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  addressText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  field: {
    marginBottom: spacing.xl,
  },
  locationTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationTypeChip: {
    flex: 1,
    minHeight: 92,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.input,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
  },
  locationTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationTypeChipIcon: {
    marginBottom: spacing.md,
  },
  locationTypeChipText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    lineHeight: 16,
  },
  locationTypeChipTextActive: {
    color: colors.white,
  },
  fieldLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
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
    height: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    color: colors.text.muted,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  toggleTextActive: {
    color: colors.white,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  stepperBtn: {
    width: sizing.touchTargetMin,
    height: sizing.touchTargetMin,
    borderRadius: sizing.touchTargetMin / 2,
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: STEPPER_VALUE_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    minWidth: STEPPER_INPUT_MIN_WIDTH,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  helpNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  helpNoteText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
});

export default styles;
