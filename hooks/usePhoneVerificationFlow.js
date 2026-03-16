import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Platform } from 'react-native';
import {
  formatPhoneForDisplay,
  saveVerifiedPhoneNumber,
  sendPhoneOtp,
  validatePhoneNumber,
  verifyPhoneOtp,
} from '../services/PhoneVerificationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COUNTRY_CODE = '+1';

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
};

export default function usePhoneVerificationFlow({
  visible,
  requirePassword,
  verifyAccountPassword,
  flowType,
  currentPhone,
  userId,
  userTable,
  onVerified,
  closeModal,
}) {
  const initialStep = requirePassword ? 'password_confirm' : 'phone_input';
  const isPhoneChangeFlow = flowType === 'phone_change';
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [step, setStep] = useState(initialStep);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(initialStep);
    setPhoneNumber('');
    setOtpCode('');
    setPhoneError('');
    setOtpError('');
    setPasswordError('');
    setAccountPassword('');
    setShowPassword(false);
    setCheckingPassword(false);
    setSendingOtp(false);
    setVerifyingOtp(false);
    setResendTimer(0);
  }, [visible, initialStep]);

  useEffect(() => {
    if (resendTimer <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendTimer]);

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
  }, [fadeAnim]);

  const closeVerificationModal = useCallback(() => {
    if (typeof closeModal === 'function') {
      closeModal();
    }
  }, [closeModal]);

  const handleVerifyPassword = useCallback(async () => {
    if (!requirePassword) {
      animateStepChange('phone_input');
      return;
    }

    if (!accountPassword) {
      setPasswordError('Enter your account password.');
      return;
    }

    if (typeof verifyAccountPassword !== 'function') {
      setPasswordError('Password verification is unavailable. Please sign in again.');
      return;
    }

    setCheckingPassword(true);
    setPasswordError('');

    try {
      await verifyAccountPassword(accountPassword);
      setAccountPassword('');
      animateStepChange('phone_input');
    } catch (error) {
      setPasswordError(error?.message || 'Current password is incorrect.');
    } finally {
      setCheckingPassword(false);
    }
  }, [
    accountPassword,
    animateStepChange,
    requirePassword,
    verifyAccountPassword,
  ]);

  const handleSendOtp = useCallback(async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    const fullPhone = normalizePhone(phoneNumber);
    const normalizedCurrentPhone = normalizePhone(currentPhone);

    if (isPhoneChangeFlow && normalizedCurrentPhone && fullPhone === normalizedCurrentPhone) {
      setPhoneError('This number is already linked to your account.');
      return;
    }

    setSendingOtp(true);
    setPhoneError('');

    try {
      const sendResult = await sendPhoneOtp(fullPhone, { userId, userTable });
      if (!sendResult?.success) {
        setPhoneError(sendResult?.error || 'Failed to send verification code');
        return;
      }
      setResendTimer(60);
      animateStepChange('phone_verify');
    } catch (err) {
      setPhoneError(err.message || 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
    }
  }, [
    animateStepChange,
    currentPhone,
    isPhoneChangeFlow,
    phoneNumber,
    userId,
    userTable,
  ]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }

    const fullPhone = normalizePhone(phoneNumber);
    setVerifyingOtp(true);
    setOtpError('');

    try {
      const result = await verifyPhoneOtp(fullPhone, otpCode);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to verify code');
      }
      if (!result?.verified) {
        throw new Error('Invalid verification code');
      }

      if (!userId || !userTable) {
        throw new Error('Could not link verification to your profile. Please sign in again.');
      }

      const saveResult = await saveVerifiedPhoneNumber({ userTable, userId, phone: fullPhone });
      if (!saveResult?.success) {
        throw new Error(saveResult?.error || 'Failed to save verified phone number');
      }

      closeVerificationModal();
      if (typeof onVerified === 'function') {
        onVerified(fullPhone);
      }
    } catch (error) {
      if (error.message?.includes('expired')) {
        setOtpError('Code expired. Please request a new one.');
      } else if (error.message?.includes('Invalid') || error.message?.includes('invalid')) {
        setOtpError('Incorrect code. Please try again.');
      } else {
        Alert.alert('Verification Failed', error.message);
      }
    } finally {
      setVerifyingOtp(false);
    }
  }, [
    closeVerificationModal,
    onVerified,
    otpCode,
    phoneNumber,
    userId,
    userTable,
  ]);

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) {
      return;
    }

    const fullPhone = normalizePhone(phoneNumber);
    setSendingOtp(true);

    try {
      const sendResult = await sendPhoneOtp(fullPhone, { userId, userTable });
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
  }, [phoneNumber, resendTimer, userId, userTable]);

  const handleBack = useCallback(() => {
    if (step === 'phone_verify') {
      animateStepChange('phone_input');
      return;
    }

    if (step === 'phone_input' && requirePassword) {
      animateStepChange('password_confirm');
      return;
    }

    closeVerificationModal();
  }, [
    animateStepChange,
    closeVerificationModal,
    requirePassword,
    step,
  ]);

  const title = useCallback(() => {
    if (step === 'password_confirm') return 'Confirm Password';
    if (step === 'phone_input') {
      return isPhoneChangeFlow ? 'Verify New Number' : 'Verify Phone Number';
    }
    return 'Enter Code';
  }, [isPhoneChangeFlow, step]);

  const modalHeight = useCallback(() => {
    if (requirePassword) {
      return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.52 : SCREEN_HEIGHT * 0.56;
    }
    return Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.45 : SCREEN_HEIGHT * 0.5;
  }, [requirePassword]);

  const handleAccountPasswordChange = useCallback((value) => {
    setAccountPassword(value);
    setPasswordError('');
  }, []);

  const handlePhoneChange = useCallback((value) => {
    setPhoneNumber(formatPhoneForDisplay(value));
    setPhoneError('');
  }, []);

  const handleOtpChange = useCallback((value) => {
    const cleaned = value.replace(/[^\d]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    setOtpError('');
  }, []);

  return {
    countryCode: COUNTRY_CODE,
    isPhoneChangeFlow,
    step,
    fadeAnim,
    phoneNumber,
    otpCode,
    phoneError,
    otpError,
    passwordError,
    accountPassword,
    showPassword,
    checkingPassword,
    sendingOtp,
    verifyingOtp,
    resendTimer,
    setShowPassword,
    title,
    modalHeight,
    handleBack,
    handleVerifyPassword,
    handleSendOtp,
    handleVerifyOtp,
    handleResendOtp,
    handleAccountPasswordChange,
    handlePhoneChange,
    handleOtpChange,
  };
}
