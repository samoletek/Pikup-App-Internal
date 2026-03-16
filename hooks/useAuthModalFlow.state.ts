import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';

type AuthStep =
  | 'initial'
  | 'email_check'
  | 'password'
  | 'register'
  | 'phone_input'
  | 'phone_verify';

export default function useAuthModalFlowState() {
  const [step, setStep] = useState<AuthStep>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const otpInputRef = useRef<null | { focus?: () => void }>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const resetForm = useCallback(() => {
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
  }, []);

  return {
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
  };
}
