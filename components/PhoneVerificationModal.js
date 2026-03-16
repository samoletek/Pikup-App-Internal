// Phone Verification Modal component: renders its UI and handles related interactions.
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from './BaseModal';
import { colors } from '../styles/theme';
import PhoneVerificationStepContent from './phoneVerification/PhoneVerificationStepContent';
import usePhoneVerificationFlow from '../hooks/usePhoneVerificationFlow';
import styles from './PhoneVerificationModal.styles';

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
 * - requirePassword: boolean — require password re-auth before sending OTP
 * - verifyAccountPassword: (password: string) => Promise<boolean>
 * - flowType: 'verification' | 'phone_change' — adjusts copy for profile phone change
 * - currentPhone: string — current linked phone (used to block same-number change)
 */
export default function PhoneVerificationModal({
  visible,
  onClose,
  onVerified,
  userId,
  userTable,
  requirePassword = false,
  verifyAccountPassword,
  flowType = 'verification',
  currentPhone = '',
}) {
  const modalRef = useRef(null);
  const otpInputRef = useRef(null);

  const closeModal = () => {
    modalRef.current?.close();
  };

  const {
    countryCode,
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
  } = usePhoneVerificationFlow({
    visible,
    requirePassword,
    verifyAccountPassword,
    flowType,
    currentPhone,
    userId,
    userTable,
    onVerified,
    closeModal,
  });

  return (
    <BaseModal
      ref={modalRef}
      visible={visible}
      onClose={onClose}
      height={modalHeight()}
      backgroundColor={colors.background.secondary}
      avoidKeyboard
      renderHeader={(animateClose) => (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{title()}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={animateClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled
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
            <PhoneVerificationStepContent
              step={step}
              isPhoneChangeFlow={isPhoneChangeFlow}
              countryCode={countryCode}
              phoneNumber={phoneNumber}
              otpCode={otpCode}
              phoneError={phoneError}
              otpError={otpError}
              passwordError={passwordError}
              accountPassword={accountPassword}
              showPassword={showPassword}
              checkingPassword={checkingPassword}
              sendingOtp={sendingOtp}
              verifyingOtp={verifyingOtp}
              resendTimer={resendTimer}
              otpInputRef={otpInputRef}
              onAccountPasswordChange={handleAccountPasswordChange}
              onTogglePassword={() => setShowPassword((prev) => !prev)}
              onVerifyPassword={handleVerifyPassword}
              onPhoneChange={handlePhoneChange}
              onSendOtp={handleSendOtp}
              onOtpChange={handleOtpChange}
              onVerifyOtp={handleVerifyOtp}
              onResendOtp={handleResendOtp}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BaseModal>
  );
}
