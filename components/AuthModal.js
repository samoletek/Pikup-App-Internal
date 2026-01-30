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
import * as AppleAuthentication from 'expo-apple-authentication';
import BaseModal from './BaseModal';
import { useAuth } from '../contexts/AuthContext';

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

const Input = ({ value, onChangeText, placeholder, secureTextEntry, error, rightIcon, onRightIconPress, keyboardType, autoCapitalize, editable }) => (
    <View style={styles.inputContainer}>
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
                <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
                    {rightIcon}
                </TouchableOpacity>
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
    const [step, setStep] = useState('initial'); // 'initial' | 'email' | 'login' | 'register'
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        setAuthMode('login');
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
            setModalVisible(false); // Note: Should trigger close
            handleClose();
        } catch (error) {
            if (!error?.canceled) Alert.alert('Error', error.message);
        }
    };

    const handleContinueWithEmail = () => {
        if (!validateEmail(email)) return;
        animateStepChange(authMode === 'login' ? 'login' : 'register');
    };

    const handleBack = () => {
        if (step === 'login' || step === 'register') {
            animateStepChange('email');
        } else {
            animateStepChange('initial');
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
        if (validateEmail(email) && validatePassword(password)) {
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
        const isEmailValid = validateEmail(email);
        const isPasswordValid = validatePassword(password);
        const isConfirmValid = validateConfirmPassword(confirmPassword);

        if (isNameValid && isEmailValid && isPasswordValid && isConfirmValid) {
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
                onPress={() => setStep('email')}
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

    const renderEmailStep = () => (
        <>
            <View style={styles.modeToggle}>
                <TouchableOpacity
                    style={[styles.modeBtn, authMode === 'login' && styles.modeBtnActive]}
                    onPress={() => setAuthMode('login')}
                >
                    <Text style={[styles.modeBtnText, authMode === 'login' && styles.modeBtnTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeBtn, authMode === 'register' && styles.modeBtnActive]}
                    onPress={() => setAuthMode('register')}
                >
                    <Text style={[styles.modeBtnText, authMode === 'register' && styles.modeBtnTextActive]}>Create Account</Text>
                </TouchableOpacity>
            </View>

            <Input
                placeholder="Email"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailError}
            />

            <Button title="Continue" onPress={handleContinueWithEmail} />
        </>
    );

    const renderPasswordStep = (isRegister) => (
        <>
            <Input
                value={email}
                editable={false}
                placeholder="Email"
            />

            {isRegister && (
                <Input
                    placeholder="Full Name"
                    value={name}
                    onChangeText={(t) => { setName(t); setNameError(''); }}
                    autoCapitalize="words"
                    error={nameError}
                    editable={!loading}
                />
            )}

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

            {isRegister && (
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
            )}

            <Button
                title={isRegister ? "Create Account" : "Sign In"}
                onPress={isRegister ? handleRegister : handleLogin}
                loading={loading}
            />

            {!isRegister && (
                <TouchableOpacity style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
            )}

            {isRegister && (
                <Text style={styles.termsText}>
                    By creating an account, you agree to our{'\n'}
                    <Text style={styles.linkText} onPress={() => Linking.openURL('https://pikup-app.com/')}>Terms</Text>
                    {' '}and{' '}
                    <Text style={styles.linkText} onPress={() => Linking.openURL('https://pikup-app.com/')}>Privacy Policy</Text>.
                </Text>
            )}
        </>
    );

    const getTitle = () => {
        switch (step) {
            case 'initial': return `Are you ${selectedRole === 'driver' ? 'Driver' : 'Customer'}?`;
            case 'email': return authMode === 'login' ? 'Sign In' : 'Create Account';
            case 'login': return 'Sign In';
            case 'register': return 'Create Account';
            default: return '';
        }
    };

    const getModalHeight = () => {
        if (step === 'register') {
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.54 : SCREEN_HEIGHT * 0.62;
        }
        if (step === 'login') {
            return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.37 : SCREEN_HEIGHT * 0.43;
        }
        // Compact height for other steps (initial, email)
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
                    {step === 'email' && renderEmailStep()}
                    {step === 'login' && renderPasswordStep(false)}
                    {step === 'register' && renderPasswordStep(true)}
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
    googleAuthBtn: {
        backgroundColor: '#FFFFFF',
    },
    appleButton: {
        width: '100%',
        height: 50,
        marginBottom: 15,
    },
    authButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },

    // Toggle
    modeToggle: {
        flexDirection: 'row',
        backgroundColor: '#222233',
        borderRadius: 30,
        padding: 4,
        marginBottom: 12,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 30,
    },
    modeBtnActive: {
        backgroundColor: '#A77BFF',
    },
    modeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
    },
    modeBtnTextActive: {
        color: '#FFFFFF',
    },

    // Inputs
    inputContainer: {
        marginBottom: 12,
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
    },
    btnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    emailDisplay: {
        textAlign: 'center',
        fontSize: 16,
        color: '#AAA',
        marginBottom: 12,
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
        marginTop: 20,
        lineHeight: 18,
    },
    linkText: {
        color: '#A77BFF',
        fontWeight: '600'
    }
});
