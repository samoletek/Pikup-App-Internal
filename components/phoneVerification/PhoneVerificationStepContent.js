// Phone Verification Step Content component: renders its UI and handles related interactions.
import React from 'react';
import {
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../ui/AppButton';
import { colors } from '../../styles/theme';
import styles from '../PhoneVerificationModal.styles';

export default function PhoneVerificationStepContent({
  step,
  isPhoneChangeFlow,
  countryCode,
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
  otpInputRef,
  onAccountPasswordChange,
  onTogglePassword,
  onVerifyPassword,
  onPhoneChange,
  onSendOtp,
  onOtpChange,
  onVerifyOtp,
  onResendOtp,
}) {
  if (step === 'password_confirm') {
    return (
      <>
        <View style={styles.securityNotice}>
          <View style={styles.securityIconWrap}>
            <Ionicons name="lock-closed-outline" size={15} color={colors.primary} />
          </View>
          <Text style={styles.securityNoticeText}>Security check required</Text>
        </View>

        <Text style={styles.stepDescription}>
          Enter your account password before changing your phone number.
        </Text>

        <View style={[styles.passwordInputWrapper, passwordError && styles.inputError]}>
          <RNTextInput
            style={styles.input}
            value={accountPassword}
            onChangeText={onAccountPasswordChange}
            placeholder="Current password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={onVerifyPassword}
          />
          <TouchableOpacity
            style={styles.passwordToggleButton}
            onPress={onTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        <AppButton
          title="Continue"
          style={styles.btn}
          onPress={onVerifyPassword}
          disabled={checkingPassword}
          loading={checkingPassword}
        />
      </>
    );
  }

  if (step === 'phone_input') {
    return (
      <>
        <Text style={styles.stepDescription}>
          {isPhoneChangeFlow
            ? "Enter your new phone number. We'll send a one-time code to verify it."
            : "Phone verification is required to continue. We'll send a code to confirm your number."}
        </Text>

        <View style={styles.phoneInputRow}>
          <View style={[styles.phoneInputWrapper, phoneError && styles.inputError]}>
            <RNTextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={onPhoneChange}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>
        </View>
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

        <AppButton
          title={isPhoneChangeFlow ? 'Send Code to New Number' : 'Send Verification Code'}
          style={styles.btn}
          onPress={onSendOtp}
          disabled={sendingOtp}
          loading={sendingOtp}
        />
      </>
    );
  }

  const digits = phoneNumber.replace(/[^\d]/g, '');
  const maskedPhone = `${countryCode} ****${digits.slice(-4)}`;

  return (
    <>
      <Text style={styles.stepDescription}>
        {isPhoneChangeFlow
          ? `Enter the 6-digit code sent to your new number ${maskedPhone}`
          : `Enter the 6-digit code sent to ${maskedPhone}`}
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
            <Text style={styles.otpDigit}>{otpCode[index] || ''}</Text>
          </View>
        ))}
      </TouchableOpacity>

      <RNTextInput
        ref={otpInputRef}
        style={styles.hiddenOtpInput}
        value={otpCode}
        onChangeText={onOtpChange}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        textContentType="oneTimeCode"
      />

      {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

      <AppButton
        title="Verify"
        style={styles.btn}
        onPress={onVerifyOtp}
        disabled={verifyingOtp || otpCode.length !== 6}
        loading={verifyingOtp}
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
}
