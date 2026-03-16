// Auth phone verify step component: handles OTP entry, verification, and resend countdown.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../../AuthModal.styles';
import { colors } from '../../../styles/theme';
import AppFormField from '../../ui/AppFormField';
import { AuthStepButton, RawTextInput } from './AuthStepShared';

const AuthPhoneVerifyStep = ({
  phoneNumber,
  countryCode,
  otpInputRef,
  otpCode,
  setOtpCode,
  otpError,
  setOtpError,
  verifyingOtp,
  onVerifyOtp,
  resendTimer,
  sendingOtp,
  onResendOtp,
}) => {
  const digits = phoneNumber.replace(/[^\d]/g, '');
  const maskedPhone = `${countryCode} ****${digits.slice(-4)}`;

  return (
    <>
      <Text style={styles.stepDescription}>
        Enter the 6-digit code sent to {maskedPhone}
      </Text>

      <AppFormField error={otpError} errorStyle={styles.errorText}>
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
              <Text style={styles.otpDigit}>{otpCode[index] || ''}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <RawTextInput
          ref={otpInputRef}
          style={styles.hiddenOtpInput}
          value={otpCode}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^\d]/g, '').slice(0, 6);
            setOtpCode(cleaned);
            setOtpError('');
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
        />
      </AppFormField>

      <AuthStepButton
        title="Verify & Create Account"
        onPress={onVerifyOtp}
        loading={verifyingOtp}
        disabled={otpCode.length !== 6}
      />

      <TouchableOpacity
        onPress={onResendOtp}
        disabled={resendTimer > 0 || sendingOtp}
        style={styles.resendBtn}
      >
        <Text
          style={[
            styles.resendText,
            (resendTimer > 0 || sendingOtp) && { color: colors.text.muted },
          ]}
        >
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

export default AuthPhoneVerifyStep;
