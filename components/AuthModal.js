import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Keyboard,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Dimensions,
    ActivityIndicator,
    TextInput as RNTextInput,
    Linking,
    Animated,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { colors } from '../styles/theme';
import styles from './AuthModal.styles';
import { sendPhoneOtp, verifyPhoneOtp, formatPhoneForDisplay, validatePhoneNumber } from '../services/PhoneVerificationService';
import { links } from '../constants/links';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TERMS_URL = links.terms;
const PRIVACY_URL = links.privacy;

// --- Simple Reusable Components (Inline for portability) ---

const Button = ({ title, onPress, variant = 'primary', disabled, loading, style }) => {
    const isPrimary = variant === 'primary';
    const backgroundColor = isPrimary ? colors.primary : 'transparent';
    const textColor = isPrimary ? colors.white : colors.primary;
    const borderColor = isPrimary ? 'transparent' : colors.primary;

    return (
        <TouchableOpacity
            style={[
                styles.btn,
                { backgroundColor, borderColor, borderWidth: isPrimary ? 0 : 1, opacity: disabled ? 0.6 : 1 },
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const Input = ({ value, onChangeText, placeholder, secureTextEntry, error, rightIcon, onRightIconPress, keyboardType, autoCapitalize, editable, label }) => (
    <View style={styles.inputContainer}>
        {label && <Text style={styles.inputLabel}>{label}</Text>}
        <View style={[styles.inputWrapper, error && styles.inputError]}>
            <RNTextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                editable={editable !== false}
            />
            {rightIcon && (
                onRightIconPress ? (
                    <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
                        {rightIcon}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.rightIcon}>
                        {rightIcon}
                    </View>
                )
            )}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
);

// --- Auth Modal Component ---

export default function AuthModal({ visible, onClose, selectedRole, navigation }) {
    const modalRef = useRef(null);

    // Auth Context
    const { login, signup, signInWithGoogle, signInWithApple, resetPassword, loading } = useAuth();

    // State
    const [step, setStep] = useState('initial'); // 'initial' | 'email_check' | 'password' | 'register' | 'phone_input' | 'phone_verify'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Checking state
    const [checkingEmail, setCheckingEmail] = useState(false);

    // Phone verification state
    const [phoneNumber, setPhoneNumber] = useState('');
    const countryCode = '+1';
    const [otpCode, setOtpCode] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    // OTP input ref
    const otpInputRef = useRef(null);

    // Fade animation for step transitions
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Errors
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [nameError, setNameError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');

    // Reset form on open
    useEffect(() => {
        if (visible) {
            resetForm();
        }
    }, [visible]);

    const resetForm = () => {
        setStep('initial');
        setEmail('');
        setPassword('');
        setName('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setEmailError('');
        setPasswordError('');
        setNameError('');
        setConfirmPasswordError('');
        setCheckingEmail(false);
        setPhoneNumber('');
        setOtpCode('');
        setPhoneError('');
        setOtpError('');
        setSendingOtp(false);
        setVerifyingOtp(false);
        setResendTimer(0);
    };

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
        Keyboard.dismiss();
        modalRef.current?.close();
    };

    // --- Validation ---
    const validateEmail = (val) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!val.trim()) {
            setEmailError('Email is required');
            return false;
        }
        if (!emailRegex.test(val)) {
            setEmailError('Invalid email address');
            return false;
        }
        setEmailError('');
        return true;
    };

    const validateName = (val) => {
        if (!val.trim()) {
            setNameError('Name is required');
            return false;
        }
        setNameError('');
        return true;
    };

    const validatePassword = (val) => {
        if (!val) {
            setPasswordError('Password is required');
            return false;
        }
        if (val.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const validateConfirmPassword = (val) => {
        if (!val) {
            setConfirmPasswordError('Please confirm your password');
            return false;
        }
        if (val !== password) {
            setConfirmPasswordError('Passwords do not match');
            return false;
        }
        setConfirmPasswordError('');
        return true;
    };

    // --- Handlers ---

    const checkEmail = async () => {
        if (!validateEmail(email)) return;

        setCheckingEmail(true);
        try {
            console.log('Checking user existence for:', email);
            const { data, error } = await supabase.functions.invoke('check-user-exists', {
                body: { email }
            });

            if (error) throw error;

            console.log('Check result:', data);

            // Logic:
            // 1. If exists && userType === selectedRole: Login (Password)
            // 2. If exists && userType !== selectedRole: Error (Wrong Portal)
            // 3. If !exists: Register

            if (data.exists) {
                if (data.userType === selectedRole) {
                    // Correct Portal - Login
                    animateStepChange('password');
                } else {
                    // Wrong Portal
                    const correctRole = data.userType === 'driver' ? 'Driver' : 'Customer';
                    Alert.alert(
                        'Wrong Portal',
                        `This email is registered as a ${correctRole}. Please go back and login as a ${correctRole}.`
                    );
                }
            } else {
                // New User - Register
                animateStepChange('register');
            }

        } catch (err) {
            console.error('Email check failed:', err);
            Alert.alert('Error', 'Could not verify email. Please try again.');
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            await signInWithApple(selectedRole);
            handleClose();
        } catch (error) {
            if (!error?.canceled) Alert.alert('Error', error.message);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle(selectedRole);
            // setModalVisible(false); // AuthModal logic usually handles closing based on auth state?
            // Actually signInWithGoogle logic might wait for redirect.
            handleClose();
        } catch (error) {
            if (!error?.canceled) Alert.alert('Error', error.message);
        }
    };

    const handleBack = () => {
        if (step === 'email_check') {
            animateStepChange('initial');
        } else if (step === 'password' || step === 'register') {
            animateStepChange('email_check');
        } else if (step === 'phone_input') {
            animateStepChange('register');
        } else if (step === 'phone_verify') {
            animateStepChange('phone_input');
        } else {
            animateStepChange('initial'); // fallback
        }
    };

    const animateStepChange = (newStep) => {
        // Fade out
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(() => {
            // Change step
            setStep(newStep);
            // Fade in
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        });
    };

    const handleLogin = async () => {
        if (validatePassword(password)) {
            try {
                // Now passing selectedRole to enforce portal restrictions
                await login(email, password, selectedRole);
                // If successful, auth state changes, app navigates. close modal.
                handleClose();
            } catch (e) {
                Alert.alert('Sign In Failed', e.message);
            }
        }
    };

    const handleRegister = async () => {
        const isNameValid = validateName(name);
        const isPasswordValid = validatePassword(password);
        const isConfirmValid = validateConfirmPassword(confirmPassword);

        if (isNameValid && isPasswordValid && isConfirmValid) {
            animateStepChange('phone_input');
        }
    };

    const handleSkipPhone = async () => {
        // Create account without phone verification
        try {
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            await signup(email, password, selectedRole, {
                name: name.trim(),
                firstName,
                lastName,
                phoneNumber: '',
                phoneVerified: false
            });

            handleClose();
            if (navigation) {
                const targetScreen = selectedRole === 'driver' ? 'DriverTabs' : 'CustomerTabs';
                navigation.replace(targetScreen);
            }
        } catch (e) {
            Alert.alert('Registration Failed', e.message);
        }
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

            // Phone verified — now complete registration
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            await signup(email, password, selectedRole, {
                name: name.trim(),
                firstName,
                lastName,
                phoneNumber: fullPhone,
                phoneVerified: true
            });

            handleClose();
            if (navigation) {
                const targetScreen = selectedRole === 'driver' ? 'DriverTabs' : 'CustomerTabs';
                navigation.replace(targetScreen);
            }
        } catch (e) {
            if (e.message?.includes('expired')) {
                setOtpError('Code expired. Please request a new one.');
            } else if (e.message?.includes('Invalid') || e.message?.includes('invalid')) {
                setOtpError('Incorrect code. Please try again.');
            } else {
                Alert.alert('Registration Failed', e.message);
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
        } catch (_err) {
            setOtpError('Failed to resend code. Please try again.');
        } finally {
            setSendingOtp(false);
        }
    };


    // --- Render Steps ---

    const renderInitialStep = () => (
        <>
            <TouchableOpacity
                style={[styles.authButton, styles.emailAuthBtn]}
                onPress={() => animateStepChange('email_check')}
            >
                <Ionicons name="mail-outline" size={24} color={colors.white} style={{ marginRight: 10 }} />
                <Text style={[styles.authButtonText, { color: colors.white }]}>Continue with Email</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
                <TouchableOpacity
                    style={[styles.authButton, styles.emailAuthBtn]}
                    onPress={handleAppleSignIn}
                >
                    <Ionicons name="logo-apple" size={24} color={colors.white} style={{ marginRight: 10 }} />
                    <Text style={[styles.authButtonText, { color: colors.white }]}>Continue with Apple</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[styles.authButton, styles.emailAuthBtn]}
                onPress={handleGoogleSignIn}
            >
                <Ionicons name="logo-google" size={24} color={colors.white} style={{ marginRight: 10 }} />
                <Text style={[styles.authButtonText, { color: colors.white }]}>Continue with Google</Text>
            </TouchableOpacity>
        </>
    );

    const renderEmailCheckStep = () => (
        <>
            <Input
                placeholder="Email Address"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailError}
            />

            <Button
                title="Continue"
                onPress={checkEmail}
                loading={checkingEmail}
            />
        </>
    );

    const renderPasswordStep = () => (
        <>
            <Input
                value={email}
                editable={false}
                placeholder="Email Address"
                rightIcon={<Ionicons name="checkmark" size={24} color={colors.white} />}
            />

            <Input
                placeholder="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                error={passwordError}
                rightIcon={<Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.text.muted} />}
                onRightIconPress={() => setShowPassword(!showPassword)}
                editable={!loading}
            />

            <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
            />

            <TouchableOpacity
                style={styles.forgotBtn}
                onPress={async () => {
                    if (!email) {
                        Alert.alert('Email Required', 'Please enter your email address first.');
                        return;
                    }
                    try {
                        await resetPassword(email);
                        Alert.alert(
                            'Check Your Email',
                            'If an account exists for this email, a password reset link has been sent.'
                        );
                    } catch (err) {
                        Alert.alert('Error', err?.message || 'Failed to send reset email.');
                    }
                }}
            >
                <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
        </>
    );

    const renderRegisterStep = () => (
        <>
            <Input
                value={email}
                editable={false}
                placeholder="Email Address"
            />

            <Input
                placeholder="Full Name"
                value={name}
                onChangeText={(t) => { setName(t); setNameError(''); }}
                autoCapitalize="words"
                error={nameError}
                editable={!loading}
            />

            <Input
                placeholder="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                error={passwordError}
                rightIcon={<Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.text.muted} />}
                onRightIconPress={() => setShowPassword(!showPassword)}
                editable={!loading}
            />

            <Input
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setConfirmPasswordError(''); }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                error={confirmPasswordError}
                rightIcon={<Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={colors.text.muted} />}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                editable={!loading}
            />

            <Text style={styles.termsText}>
                By creating an account, you agree to our{'\n'}
                <Text
                    style={styles.linkText}
                    onPress={async () => {
                        console.log('Opening Terms...');
                        try {
                            const supported = await Linking.canOpenURL(TERMS_URL);
                            if (supported) {
                                await Linking.openURL(TERMS_URL);
                            } else {
                                Alert.alert('Error', `Cannot open this link: ${TERMS_URL}`);
                            }
                        } catch (err) {
                            console.error('An error occurred', err);
                            Alert.alert('Error', 'Failed to open link');
                        }
                    }}
                    suppressHighlighting={false}
                >
                    Terms
                </Text>
                {' '}and{' '}
                <Text
                    style={styles.linkText}
                    onPress={async () => {
                        console.log('Opening Privacy...');
                        try {
                            const supported = await Linking.canOpenURL(PRIVACY_URL);
                            if (supported) {
                                await Linking.openURL(PRIVACY_URL);
                            } else {
                                Alert.alert('Error', 'Cannot open this link');
                            }
                        } catch (err) {
                            console.error('An error occurred', err);
                        }
                    }}
                    suppressHighlighting={false}
                >
                    Privacy Policy
                </Text>.
            </Text>

            <Button
                title="Continue"
                onPress={handleRegister}
                loading={loading}
            />
        </>
    );


    const renderPhoneInputStep = () => (
        <>
            <Text style={styles.stepDescription}>
                We'll send a verification code to confirm your phone number.
            </Text>

            <View style={[styles.inputWrapper, { marginBottom: 12 }, phoneError && styles.inputError]}>
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
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <Button
                title="Send Verification Code"
                onPress={handleSendOtp}
                loading={sendingOtp}
            />

            <TouchableOpacity
                onPress={handleSkipPhone}
                style={styles.skipBtn}
                disabled={loading}
            >
                <Text style={styles.skipText}>Skip for Now</Text>
            </TouchableOpacity>
        </>
    );

    const renderPhoneVerifyStep = () => {
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

                <Button
                    title="Verify & Create Account"
                    onPress={handleVerifyOtp}
                    loading={verifyingOtp}
                    disabled={otpCode.length !== 6}
                />

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

    const getTitle = () => {
        switch (step) {
            case 'initial': return `${selectedRole === 'driver' ? 'Driver' : 'Customer'} Login`;
            case 'email_check': return 'What\'s your email?';
            case 'password': return 'Welcome Back';
            case 'register': return 'Create Account';
            case 'phone_input': return 'Verify Phone Number';
            case 'phone_verify': return 'Enter Code';
            default: return '';
        }
    };

    const getModalHeight = () => {
        if (step === 'register') {
            // User requested 55% for registration fields
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.55 : SCREEN_HEIGHT * 0.60;
        }
        if (step === 'email_check') {
            // User requested ~30% for just email input
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.30 : SCREEN_HEIGHT * 0.35;
        }
        if (step === 'password') {
            // Updated to 40% as requested (Email field + Password field)
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.40 : SCREEN_HEIGHT * 0.45;
        }
        if (step === 'phone_input') {
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.45 : SCREEN_HEIGHT * 0.50;
        }
        if (step === 'phone_verify') {
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.45 : SCREEN_HEIGHT * 0.50;
        }
        // 'initial' (3 buttons)
        return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.35 : SCREEN_HEIGHT * 0.40;
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
                        {step !== 'initial' && (
                            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="arrow-back" size={24} color={colors.white} />
                            </TouchableOpacity>
                        )}
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
                        {step === 'initial' && renderInitialStep()}
                        {step === 'email_check' && renderEmailCheckStep()}
                        {step === 'password' && renderPasswordStep()}
                        {step === 'register' && renderRegisterStep()}
                        {step === 'phone_input' && renderPhoneInputStep()}
                        {step === 'phone_verify' && renderPhoneVerifyStep()}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
}
