import { useCallback, useEffect } from 'react';
import { Alert, Animated } from 'react-native';
import { logger } from '../services/logger';
import { checkUserExists } from '../services/AuthService';
import { sendPhoneOtp, validatePhoneNumber, verifyPhoneOtp } from '../services/PhoneVerificationService';
import { buildUsPhoneWithCountryCode, COUNTRY_CODE, resolveNameParts } from './authModalFlow.utils';
import useAuthModalFlowState from './useAuthModalFlow.state';
import useAuthModalResendTimer from './useAuthModalResendTimer';
import useAuthModalValidation from './useAuthModalValidation';

export default function useAuthModalFlow({
  visible,
  selectedRole,
  navigation,
  closeModal,
  login,
  signup,
  signInWithGoogle,
  signInWithApple,
}) {
  const {
    step,
    setStep,
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
    setCheckingEmail,
    phoneNumber,
    setPhoneNumber,
    otpCode,
    setOtpCode,
    phoneError,
    setPhoneError,
    otpError,
    setOtpError,
    sendingOtp,
    setSendingOtp,
    verifyingOtp,
    setVerifyingOtp,
    resendTimer,
    setResendTimer,
    emailError,
    setEmailError,
    passwordError,
    setPasswordError,
    nameError,
    setNameError,
    confirmPasswordError,
    setConfirmPasswordError,
    otpInputRef,
    fadeAnim,
    resetForm,
  } = useAuthModalFlowState();

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [resetForm, visible]);
  useAuthModalResendTimer(resendTimer, setResendTimer);

  const animateStepChange = useCallback((newStep) => {
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
  }, [fadeAnim, setStep]);

  const {
    validateEmail,
    validateName,
    validatePassword,
    validateConfirmPassword,
  } = useAuthModalValidation({
    password,
    setEmailError,
    setNameError,
    setPasswordError,
    setConfirmPasswordError,
  });

  const checkEmail = useCallback(async () => {
    if (!validateEmail(email)) return;

    setCheckingEmail(true);
    try {
      const data = await checkUserExists(email);

      if (data.exists) {
        if (data.userType === selectedRole) {
          animateStepChange('password');
        } else {
          const correctRole = data.userType === 'driver' ? 'Driver' : 'Customer';
          Alert.alert(
            'Wrong Portal',
            `This email is registered as a ${correctRole}. Please go back and login as a ${correctRole}.`
          );
        }
      } else {
        animateStepChange('register');
      }
    } catch (error) {
      logger.error('AuthModalFlow', 'Email check failed', error);
      Alert.alert('Error', 'Could not verify email. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  }, [animateStepChange, email, selectedRole, setCheckingEmail, validateEmail]);

  const handleAppleSignIn = useCallback(async () => {
    try {
      await signInWithApple(selectedRole);
      closeModal();
    } catch (error) {
      if (!error?.canceled) Alert.alert('Error', error.message);
    }
  }, [closeModal, selectedRole, signInWithApple]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle(selectedRole);
      closeModal();
    } catch (error) {
      if (!error?.canceled) Alert.alert('Error', error.message);
    }
  }, [closeModal, selectedRole, signInWithGoogle]);

  const handleBack = useCallback(() => {
    if (step === 'email_check') {
      animateStepChange('initial');
    } else if (step === 'password' || step === 'register') {
      animateStepChange('email_check');
    } else if (step === 'phone_input') {
      animateStepChange('register');
    } else if (step === 'phone_verify') {
      animateStepChange('phone_input');
    } else {
      animateStepChange('initial');
    }
  }, [animateStepChange, step]);

  const handleLogin = useCallback(async () => {
    if (!validatePassword(password)) return;

    try {
      await login(email, password, selectedRole);
      closeModal();
    } catch (error) {
      Alert.alert('Sign In Failed', error.message);
    }
  }, [closeModal, email, login, password, selectedRole, validatePassword]);

  const navigateToRoleTabs = useCallback(() => {
    if (!navigation) return;
    const targetScreen = selectedRole === 'driver' ? 'DriverTabs' : 'CustomerTabs';
    navigation.replace(targetScreen);
  }, [navigation, selectedRole]);

  const handleRegister = useCallback(async () => {
    const isNameValid = validateName(name);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword);

    if (isNameValid && isPasswordValid && isConfirmValid) {
      animateStepChange('phone_input');
    }
  }, [
    animateStepChange,
    confirmPassword,
    name,
    password,
    validateConfirmPassword,
    validateName,
    validatePassword,
  ]);

  const completeSignup = useCallback(async ({ phoneNumber: normalizedPhone, phoneVerified }) => {
    const nameParts = resolveNameParts(name);
    await signup(email, password, selectedRole, {
      name: name.trim(),
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phoneNumber: normalizedPhone || '',
      phoneVerified: !!phoneVerified,
    });

    closeModal();
    navigateToRoleTabs();
  }, [closeModal, email, name, navigateToRoleTabs, password, selectedRole, signup]);

  const handleSkipPhone = useCallback(async () => {
    try {
      await completeSignup({
        phoneNumber: '',
        phoneVerified: false,
      });
    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    }
  }, [completeSignup]);

  const fullPhone = useCallback(() => buildUsPhoneWithCountryCode(phoneNumber), [phoneNumber]);

  const handleSendOtp = useCallback(async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    setSendingOtp(true);
    setPhoneError('');

    try {
      const sendResult = await sendPhoneOtp(fullPhone());
      if (!sendResult?.success) {
        setPhoneError(sendResult?.error || 'Failed to send verification code');
        return;
      }
      setResendTimer(60);
      animateStepChange('phone_verify');
    } catch (error) {
      setPhoneError(error.message || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  }, [animateStepChange, fullPhone, phoneNumber, setPhoneError, setResendTimer, setSendingOtp]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const normalizedPhone = fullPhone();
      const result = await verifyPhoneOtp(normalizedPhone, otpCode);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to verify code');
      }
      if (!result?.verified) throw new Error('Invalid verification code');

      await completeSignup({
        phoneNumber: normalizedPhone,
        phoneVerified: true,
      });
    } catch (error) {
      if (error.message?.includes('expired')) {
        setOtpError('Code expired. Please request a new one.');
      } else if (error.message?.includes('Invalid') || error.message?.includes('invalid')) {
        setOtpError('Incorrect code. Please try again.');
      } else {
        Alert.alert('Registration Failed', error.message);
      }
    } finally {
      setVerifyingOtp(false);
    }
  }, [completeSignup, fullPhone, otpCode, setOtpError, setVerifyingOtp]);

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;

    setSendingOtp(true);

    try {
      const sendResult = await sendPhoneOtp(fullPhone());
      if (!sendResult?.success) {
        setOtpError(sendResult?.error || 'Failed to resend code. Please try again.');
        return;
      }
      setResendTimer(60);
      setOtpError('');
      setOtpCode('');
    } catch (_error) {
      setOtpError('Failed to resend code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  }, [fullPhone, resendTimer, setOtpCode, setOtpError, setResendTimer, setSendingOtp]);

  return {
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
    countryCode: COUNTRY_CODE,
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
  };
}
