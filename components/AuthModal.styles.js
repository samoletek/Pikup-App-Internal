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

    // Buttons
    authButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 30, // Pill shape
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border.light,
    },
    emailAuthBtn: {
        backgroundColor: colors.background.input,
        borderColor: colors.border.light,
    },
    authButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },

    // Inputs
    inputContainer: {
        marginBottom: 12,
    },
    inputLabel: {
        color: colors.text.muted,
        fontSize: 12,
        marginBottom: 4,
        marginLeft: 8
    },
    inputWrapper: {
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
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    inputError: {
        borderColor: colors.error,
    },
    rightIcon: {
        padding: 4,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },

    // Other
    btn: {
        height: 48,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8
    },
    btnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    forgotBtn: {
        alignSelf: 'center',
        marginTop: 20,
    },
    forgotText: {
        color: colors.primary,
        fontWeight: '600',
    },
    termsText: {
        textAlign: 'center',
        fontSize: 12,
        color: colors.text.subtle,
        marginTop: 0,
        marginBottom: 4,
        lineHeight: 18,
    },
    linkText: {
        color: colors.primary,
        fontWeight: '600'
    },

    // Phone input
    stepDescription: {
        fontSize: 14,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },

    // OTP input
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
    skipBtn: {
        alignSelf: 'center',
        marginTop: 16,
    },
    skipText: {
        color: colors.text.subtle,
        fontSize: 14,
    },

});

export default styles;
