import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Dimensions,
    ActivityIndicator,
    TextInput as RNTextInput,
    Animated,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { colors } from '../styles/theme';
import { sendPhoneOtp, verifyPhoneOtp, formatPhoneForDisplay, validatePhoneNumber } from '../services/PhoneVerificationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * PhoneVerificationModal — reusable component for verifying phone number.
 * Used when a user skipped phone verification during registration
 * and later needs to verify before creating/accepting a trip.
 *
 * Props:
 * - visible: boolean
 * - onClose: () => void
 * - onVerified: (phoneNumber: string) => void — called after successful verification
 * - userId: string — current user ID
 * - userTable: 'customers' | 'drivers' — which table to update
 */
export default function PhoneVerificationModal({ visible, onClose, onVerified, userId, userTable }) {
    const modalRef = useRef(null);
    const otpInputRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const [step, setStep] = useState('phone_input'); // 'phone_input' | 'phone_verify'
    const countryCode = '+1';
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        if (visible) {
            setStep('phone_input');
            setPhoneNumber('');
            setOtpCode('');
            setPhoneError('');
            setOtpError('');
            setSendingOtp(false);
            setVerifyingOtp(false);
            setResendTimer(0);
        }
    }, [visible]);

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleClose = () => {
        modalRef.current?.close();
    };

    const animateStepChange = (newStep) => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(() => {
            setStep(newStep);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleSendOtp = async () => {
        if (!validatePhoneNumber(phoneNumber)) {
            setPhoneError('Please enter a valid phone number');
            return;
        }

        const fullPhone = `${countryCode}${phoneNumber.replace(/[^\d]/g, '')}`;
        setSendingOtp(true);
        setPhoneError('');

        try {
            await sendPhoneOtp(fullPhone);
            setResendTimer(60);
            animateStepChange('phone_verify');
        } catch (err) {
            setPhoneError(err.message || 'Failed to send verification code');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpCode.length !== 6) {
            setOtpError('Please enter the 6-digit code');
            return;
        }

        const fullPhone = `${countryCode}${phoneNumber.replace(/[^\d]/g, '')}`;
        setVerifyingOtp(true);
        setOtpError('');

        try {
            const result = await verifyPhoneOtp(fullPhone, otpCode);
            if (!result?.verified) throw new Error('Invalid verification code');

            // Update phone number and mark as verified in DB
            if (userId && userTable) {
                const { error: updateError } = await supabase
                    .from(userTable)
                    .update({ phone_number: fullPhone, phone_verified: true })
                    .eq('id', userId);

                if (updateError) {
                    console.error('Error updating phone_number:', updateError);
                }
            }

            handleClose();
            if (onVerified) onVerified(fullPhone);
        } catch (e) {
            if (e.message?.includes('expired')) {
                setOtpError('Code expired. Please request a new one.');
            } else if (e.message?.includes('Invalid') || e.message?.includes('invalid')) {
                setOtpError('Incorrect code. Please try again.');
            } else {
                Alert.alert('Verification Failed', e.message);
            }
        } finally {
            setVerifyingOtp(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;

        const fullPhone = `${countryCode}${phoneNumber.replace(/[^\d]/g, '')}`;
        setSendingOtp(true);

        try {
            await sendPhoneOtp(fullPhone);
            setResendTimer(60);
            setOtpError('');
            setOtpCode('');
        } catch (err) {
            setOtpError('Failed to resend code. Please try again.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleBack = () => {
        if (step === 'phone_verify') {
            animateStepChange('phone_input');
        } else {
            handleClose();
        }
    };

    const getTitle = () => {
        return step === 'phone_input' ? 'Verify Phone Number' : 'Enter Code';
    };

    const getModalHeight = () => {
        return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.45 : SCREEN_HEIGHT * 0.50;
    };

    const renderPhoneInput = () => (
        <>
            <Text style={styles.stepDescription}>
                Phone verification is required to continue. We'll send a code to confirm your number.
            </Text>

            <View style={styles.phoneInputRow}>
                <View style={[styles.phoneInputWrapper, phoneError && styles.inputError]}>
                    <RNTextInput
                        style={styles.input}
                        value={phoneNumber}
                        onChangeText={(t) => {
                            setPhoneNumber(formatPhoneForDisplay(t));
                            setPhoneError('');
                        }}
                        placeholder="(555) 123-4567"
                        placeholderTextColor={colors.text.tertiary}
                        keyboardType="phone-pad"
                        maxLength={14}
                    />
                </View>
            </View>
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, opacity: sendingOtp ? 0.6 : 1 }]}
                onPress={handleSendOtp}
                disabled={sendingOtp}
            >
                {sendingOtp ? (
                    <ActivityIndicator color={colors.white} />
                ) : (
                    <Text style={[styles.btnText, { color: colors.white }]}>Send Verification Code</Text>
                )}
            </TouchableOpacity>
        </>
    );

    const renderPhoneVerify = () => {
        const digits = phoneNumber.replace(/[^\d]/g, '');
        const maskedPhone = `${countryCode} ****${digits.slice(-4)}`;

        return (
            <>
                <Text style={styles.stepDescription}>
                    Enter the 6-digit code sent to {maskedPhone}
                </Text>

                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.otpContainer}
                    onPress={() => otpInputRef.current?.focus()}
                >
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <View
                            key={index}
                            style={[
                                styles.otpBox,
                                otpCode.length === index && styles.otpBoxActive,
                                otpError && styles.otpBoxError,
                            ]}
                        >
                            <Text style={styles.otpDigit}>
                                {otpCode[index] || ''}
                            </Text>
                        </View>
                    ))}
                </TouchableOpacity>

                <RNTextInput
                    ref={otpInputRef}
                    style={styles.hiddenOtpInput}
                    value={otpCode}
                    onChangeText={(t) => {
                        const cleaned = t.replace(/[^\d]/g, '').slice(0, 6);
                        setOtpCode(cleaned);
                        setOtpError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    textContentType="oneTimeCode"
                />

                {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary, opacity: (verifyingOtp || otpCode.length !== 6) ? 0.6 : 1 }]}
                    onPress={handleVerifyOtp}
                    disabled={verifyingOtp || otpCode.length !== 6}
                >
                    {verifyingOtp ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={[styles.btnText, { color: colors.white }]}>Verify</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resendTimer > 0 || sendingOtp}
                    style={styles.resendBtn}
                >
                    <Text style={[
                        styles.resendText,
                        (resendTimer > 0 || sendingOtp) && { color: colors.text.muted }
                    ]}>
                        {sendingOtp
                            ? 'Sending...'
                            : resendTimer > 0
                                ? `Resend code in ${resendTimer}s`
                                : 'Resend Code'}
                    </Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <BaseModal
            ref={modalRef}
            visible={visible}
            onClose={onClose}
            height={getModalHeight()}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={true}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.headerTitle}>{getTitle()}</Text>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={animateClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                enabled={true}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
                style={styles.keyboardAvoiding}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                        {step === 'phone_input' && renderPhoneInput()}
                        {step === 'phone_verify' && renderPhoneVerify()}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
}

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
    phoneInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
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
