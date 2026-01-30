import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Keyboard,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Dimensions,
    ActivityIndicator,
    TextInput as RNTextInput,
    Linking,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import BaseModal from './BaseModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Simple Reusable Components (Inline for portability) ---

const Button = ({ title, onPress, variant = 'primary', disabled, loading, style }) => {
    const isPrimary = variant === 'primary';
    const backgroundColor = isPrimary ? '#A77BFF' : 'transparent';
    const textColor = isPrimary ? '#FFFFFF' : '#A77BFF';
    const borderColor = isPrimary ? 'transparent' : '#A77BFF';

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
                placeholderTextColor="#999"
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
    const { login, signup, signInWithGoogle, signInWithApple, loading } = useAuth();

    // State
    const [step, setStep] = useState('initial'); // 'initial' | 'email_check' | 'password' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Checking state
    const [checkingEmail, setCheckingEmail] = useState(false);

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
    };

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
            await AsyncStorage.setItem('expected_role', selectedRole); // For Context awareness
            await signInWithApple(selectedRole);
            handleClose();
        } catch (error) {
            if (!error?.canceled) Alert.alert('Error', error.message);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await AsyncStorage.setItem('expected_role', selectedRole); // For Context awareness
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
            try {
                // signup(email, password, role, additionalData)
                // Split name for consistency if needed, but Context usually handles raw data
                const nameParts = name.trim().split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '';

                await signup(email, password, selectedRole, {
                    name: name.trim(),
                    firstName,
                    lastName
                });

                // Navigate directly to CustomerTabs/DriverTabs to avoid WelcomeScreen flash
                handleClose();
                if (navigation) {
                    const targetScreen = selectedRole === 'driver' ? 'DriverTabs' : 'CustomerTabs';
                    navigation.replace(targetScreen);
                }
            } catch (e) {
                Alert.alert('Registration Failed', e.message);
            }
        }
    };


    // --- Render Steps ---

    const renderInitialStep = () => (
        <>
            <TouchableOpacity
                style={[styles.authButton, styles.emailAuthBtn]}
                onPress={() => animateStepChange('email_check')}
            >
                <Ionicons name="mail-outline" size={24} color="#FFF" style={{ marginRight: 10 }} />
                <Text style={[styles.authButtonText, { color: '#FFF' }]}>Continue with Email</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
                <TouchableOpacity
                    style={[styles.authButton, styles.emailAuthBtn]}
                    onPress={handleAppleSignIn}
                >
                    <Ionicons name="logo-apple" size={24} color="#FFF" style={{ marginRight: 10 }} />
                    <Text style={[styles.authButtonText, { color: '#FFF' }]}>Continue with Apple</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[styles.authButton, styles.emailAuthBtn]}
                onPress={handleGoogleSignIn}
            >
                <Ionicons name="logo-google" size={24} color="#FFF" style={{ marginRight: 10 }} />
                <Text style={[styles.authButtonText, { color: '#FFF' }]}>Continue with Google</Text>
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
                rightIcon={<Ionicons name="checkmark" size={24} color="#FFF" />}
            />

            <Input
                placeholder="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                error={passwordError}
                rightIcon={<Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#888" />}
                onRightIconPress={() => setShowPassword(!showPassword)}
                editable={!loading}
            />

            <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
            />

            <TouchableOpacity style={styles.forgotBtn}>
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
                rightIcon={<Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#888" />}
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
                rightIcon={<Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color="#888" />}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                editable={!loading}
            />

            <Text style={styles.termsText}>
                By creating an account, you agree to our{'\n'}
                <Text style={styles.linkText} onPress={() => Linking.openURL('https://pikup-app.com/')}>Terms</Text>
                {' '}and{' '}
                <Text style={styles.linkText} onPress={() => Linking.openURL('https://pikup-app.com/')}>Privacy Policy</Text>.
            </Text>

            <Button
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
            />
        </>
    );


    const getTitle = () => {
        switch (step) {
            case 'initial': return `${selectedRole === 'driver' ? 'Driver' : 'Customer'} Login`;
            case 'email_check': return 'What\'s your email?';
            case 'password': return 'Welcome Back';
            case 'register': return 'Create Account';
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
        // 'initial' (3 buttons)
        return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.35 : SCREEN_HEIGHT * 0.40;
    };

    return (
        <BaseModal
            ref={modalRef}
            visible={visible}
            onClose={onClose}
            height={getModalHeight()}
            backgroundColor="#141426"
            avoidKeyboard={true}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {step !== 'initial' && (
                            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="arrow-back" size={24} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.headerTitle}>{getTitle()}</Text>
                    <View style={styles.headerRight}>
                        <TouchableOpacity onPress={animateClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                enabled={false} // Disabled because BaseModal handles it via avoidKeyboard
                style={{ flex: 1 }}
            >
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    {step === 'initial' && renderInitialStep()}
                    {step === 'email_check' && renderEmailCheckStep()}
                    {step === 'password' && renderPasswordStep()}
                    {step === 'register' && renderRegisterStep()}
                </Animated.View>
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
        color: '#FFF',
        textAlign: 'center',
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 20,
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
        borderColor: '#444',
    },
    emailAuthBtn: {
        backgroundColor: '#222233',
        borderColor: '#444',
    },
    authButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },

    // Inputs
    inputContainer: {
        marginBottom: 12,
    },
    inputLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 4,
        marginLeft: 8
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222233',
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 30,
        height: 52,
        paddingHorizontal: 16,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#FFF',
        height: '100%',
    },
    inputError: {
        borderColor: '#FF4444',
    },
    rightIcon: {
        padding: 4,
    },
    errorText: {
        color: '#FF4444',
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
        color: '#A77BFF',
        fontWeight: '600',
    },
    termsText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        marginTop: 0,
        marginBottom: 20,
        lineHeight: 18,
    },
    linkText: {
        color: '#A77BFF',
        fontWeight: '600'
    }
});
