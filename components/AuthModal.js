// Auth Modal component: renders its UI and handles related interactions.
import React, { useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Keyboard,
    Platform,
    KeyboardAvoidingView,
    Dimensions,
    Animated,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { useAuthActions, useAuthIdentity } from '../contexts/AuthContext';
import { colors } from '../styles/theme';
import styles from './AuthModal.styles';
import AuthModalStepContent from './auth/AuthModalStepContent';
import { getAuthModalHeight, getAuthModalTitle } from './auth/authModalMeta';
import useAuthModalFlow from '../hooks/useAuthModalFlow';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Auth Modal Component ---

export default function AuthModal({ visible, onClose, selectedRole, navigation }) {
    const modalRef = useRef(null);

    // Auth Context
    const { loading } = useAuthIdentity();
    const { login, signup, signInWithGoogle, signInWithApple, resetPassword } = useAuthActions();

    const handleClose = () => {
        Keyboard.dismiss();
        modalRef.current?.close();
    };
    const {
        step,
        email,
        setEmail,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        name,
        setName,
        confirmPassword,
        setConfirmPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        checkingEmail,
        phoneNumber,
        setPhoneNumber,
        otpCode,
        setOtpCode,
        phoneError,
        setPhoneError,
        otpError,
        setOtpError,
        sendingOtp,
        verifyingOtp,
        resendTimer,
        otpInputRef,
        fadeAnim,
        emailError,
        setEmailError,
        passwordError,
        setPasswordError,
        nameError,
        setNameError,
        confirmPasswordError,
        setConfirmPasswordError,
        countryCode,
        animateStepChange,
        checkEmail,
        handleAppleSignIn,
        handleGoogleSignIn,
        handleBack,
        handleLogin,
        handleRegister,
        handleSendOtp,
        handleSkipPhone,
        handleVerifyOtp,
        handleResendOtp,
    } = useAuthModalFlow({
        visible,
        selectedRole,
        navigation,
        closeModal: handleClose,
        login,
        signup,
        signInWithGoogle,
        signInWithApple,
    });

    return (
        <BaseModal
            ref={modalRef}
            visible={visible}
            onClose={onClose}
            height={getAuthModalHeight(step, SCREEN_HEIGHT)}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={true}
            bottomInsetEnabled={Platform.OS === 'ios'}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {step !== 'initial' && (
                            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="arrow-back" size={24} color={colors.white} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.headerTitle}>{getAuthModalTitle(step, selectedRole)}</Text>
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
                        <AuthModalStepContent
                            step={step}
                            selectedRole={selectedRole}
                            email={email}
                            setEmail={setEmail}
                            emailError={emailError}
                            setEmailError={setEmailError}
                            password={password}
                            setPassword={setPassword}
                            passwordError={passwordError}
                            setPasswordError={setPasswordError}
                            showPassword={showPassword}
                            setShowPassword={setShowPassword}
                            name={name}
                            setName={setName}
                            nameError={nameError}
                            setNameError={setNameError}
                            confirmPassword={confirmPassword}
                            setConfirmPassword={setConfirmPassword}
                            confirmPasswordError={confirmPasswordError}
                            setConfirmPasswordError={setConfirmPasswordError}
                            showConfirmPassword={showConfirmPassword}
                            setShowConfirmPassword={setShowConfirmPassword}
                            phoneNumber={phoneNumber}
                            setPhoneNumber={setPhoneNumber}
                            phoneError={phoneError}
                            setPhoneError={setPhoneError}
                            otpCode={otpCode}
                            setOtpCode={setOtpCode}
                            otpError={otpError}
                            setOtpError={setOtpError}
                            countryCode={countryCode}
                            otpInputRef={otpInputRef}
                            loading={loading}
                            checkingEmail={checkingEmail}
                            sendingOtp={sendingOtp}
                            verifyingOtp={verifyingOtp}
                            resendTimer={resendTimer}
                            animateStepChange={animateStepChange}
                            checkEmail={checkEmail}
                            handleAppleSignIn={handleAppleSignIn}
                            handleGoogleSignIn={handleGoogleSignIn}
                            handleLogin={handleLogin}
                            handleRegister={handleRegister}
                            handleSendOtp={handleSendOtp}
                            handleSkipPhone={handleSkipPhone}
                            handleVerifyOtp={handleVerifyOtp}
                            handleResendOtp={handleResendOtp}
                            resetPassword={resetPassword}
                        />
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </BaseModal>
    );
}
