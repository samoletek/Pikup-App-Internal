import { StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
    height: 50,
  },
  headerLeft: { width: 40 },
  headerRight: { width: 40, alignItems: 'flex-end' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 8,
  },
  securityIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.brandTint,
  },
  securityNoticeText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 30,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  passwordToggleButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 30,
    height: 52,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.white,
    height: '100%',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  btn: {
    height: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.background.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: colors.primary,
  },
  otpBoxError: {
    borderColor: colors.error,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  resendBtn: {
    alignSelf: 'center',
    marginTop: 16,
  },
  resendText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default styles;
