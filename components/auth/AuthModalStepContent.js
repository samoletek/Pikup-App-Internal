// Auth Modal Step Content component: routes auth flow state into dedicated step components.
import React from 'react';
import AuthInitialStep from './steps/AuthInitialStep';
import AuthEmailCheckStep from './steps/AuthEmailCheckStep';
import AuthPasswordStep from './steps/AuthPasswordStep';
import AuthRegisterStep from './steps/AuthRegisterStep';
import AuthPhoneInputStep from './steps/AuthPhoneInputStep';
import AuthPhoneVerifyStep from './steps/AuthPhoneVerifyStep';

export default function AuthModalStepContent({
  step,
  selectedRole,
  email,
  setEmail,
  emailError,
  setEmailError,
  password,
  setPassword,
  passwordError,
  setPasswordError,
  showPassword,
  setShowPassword,
  name,
  setName,
  nameError,
  setNameError,
  confirmPassword,
  setConfirmPassword,
  confirmPasswordError,
  setConfirmPasswordError,
  showConfirmPassword,
  setShowConfirmPassword,
  phoneNumber,
  setPhoneNumber,
  phoneError,
  setPhoneError,
  otpCode,
  setOtpCode,
  otpError,
  setOtpError,
  countryCode,
  otpInputRef,
  loading,
  checkingEmail,
  sendingOtp,
  verifyingOtp,
  resendTimer,
  animateStepChange,
  checkEmail,
  handleAppleSignIn,
  handleGoogleSignIn,
  handleLogin,
  handleRegister,
  handleSendOtp,
  handleSkipPhone,
  handleVerifyOtp,
  handleResendOtp,
  resetPassword,
}) {
  void selectedRole;

  if (step === 'initial') {
    return (
      <AuthInitialStep
        animateStepChange={animateStepChange}
        onAppleSignIn={handleAppleSignIn}
        onGoogleSignIn={handleGoogleSignIn}
      />
    );
  }

  if (step === 'email_check') {
    return (
      <AuthEmailCheckStep
        email={email}
        setEmail={setEmail}
        emailError={emailError}
        setEmailError={setEmailError}
        checkingEmail={checkingEmail}
        onCheckEmail={checkEmail}
      />
    );
  }

  if (step === 'password') {
    return (
      <AuthPasswordStep
        email={email}
        password={password}
        setPassword={setPassword}
        passwordError={passwordError}
        setPasswordError={setPasswordError}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        loading={loading}
        onLogin={handleLogin}
        onResetPassword={resetPassword}
      />
    );
  }

  if (step === 'register') {
    return (
      <AuthRegisterStep
        email={email}
        name={name}
        setName={setName}
        nameError={nameError}
        setNameError={setNameError}
        password={password}
        setPassword={setPassword}
        passwordError={passwordError}
        setPasswordError={setPasswordError}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        confirmPasswordError={confirmPasswordError}
        setConfirmPasswordError={setConfirmPasswordError}
        showConfirmPassword={showConfirmPassword}
        setShowConfirmPassword={setShowConfirmPassword}
        loading={loading}
        onRegister={handleRegister}
      />
    );
  }

  if (step === 'phone_input') {
    return (
      <AuthPhoneInputStep
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        phoneError={phoneError}
        setPhoneError={setPhoneError}
        loading={loading}
        sendingOtp={sendingOtp}
        onSendOtp={handleSendOtp}
        onSkipPhone={handleSkipPhone}
      />
    );
  }

  if (step === 'phone_verify') {
    return (
      <AuthPhoneVerifyStep
        phoneNumber={phoneNumber}
        countryCode={countryCode}
        otpInputRef={otpInputRef}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpError={otpError}
        setOtpError={setOtpError}
        verifyingOtp={verifyingOtp}
        onVerifyOtp={handleVerifyOtp}
        resendTimer={resendTimer}
        sendingOtp={sendingOtp}
        onResendOtp={handleResendOtp}
      />
    );
  }

  return null;
}
