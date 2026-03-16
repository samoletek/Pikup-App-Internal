import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../styles/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 20,
  },
  eyeIcon: {
    position: 'absolute',
    right: 30,
    borderRadius: 30,
    paddingVertical: 16,
  },
  termsAcceptedErrorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 30,
    marginLeft: 20,
  },
  inputError: {
    borderColor: colors.error,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg + spacing.xs,
    marginTop: spacing.md,
  },
  iconContainer: {
    backgroundColor: colors.background.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: typography.fontSize.xxl + 4,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.inverse,
    marginBottom: spacing.lg + spacing.xs,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: typography.fontSize.xxl,
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  inputContainer: {
    marginBottom: spacing.md + 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
  },
  input: {
    backgroundColor: colors.background.inputLight,
    borderRadius: 30,
    paddingHorizontal: spacing.base + spacing.xs,
    paddingVertical: spacing.base - 1,
    paddingLeft: 45,
    fontSize: typography.fontSize.md,
    color: colors.text.inverse,
    width: '100%',
  },
  buttonContainer: {
    marginTop: spacing.base + spacing.xs,
    width: '100%',
  },
  buttonContainerCompact: {
    marginTop: spacing.base,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingVertical: spacing.base,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: spacing.base + spacing.xs,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm + 2,
    marginBottom: spacing.lg + spacing.xs,
  },
  toggleText: {
    color: colors.text.placeholder,
    fontSize: 16,
  },
  toggleLink: {
    color: colors.text.link,
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  termsTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 10,
    flex: 1,
  },
  termsText: {
    color: colors.text.placeholder,
    fontSize: 14,
  },
  termsLink: {
    color: colors.text.link,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: colors.background.surface,
    borderRadius: 30,
    paddingVertical: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.inverse,
  },
  googleButtonText: {
    color: colors.text.inverse,
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default styles;
