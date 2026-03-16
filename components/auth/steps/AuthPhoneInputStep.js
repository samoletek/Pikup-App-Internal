// Auth phone input step component: collects phone number and starts SMS OTP verification.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import styles from '../../AuthModal.styles';
import { colors } from '../../../styles/theme';
import { formatPhoneForDisplay } from '../../../services/PhoneVerificationService';
import AppFormField from '../../ui/AppFormField';
import { AuthStepButton, RawTextInput } from './AuthStepShared';

const AuthPhoneInputStep = ({
  phoneNumber,
  setPhoneNumber,
  phoneError,
  setPhoneError,
  loading,
  sendingOtp,
  onSendOtp,
  onSkipPhone,
}) => (
  <>
    <Text style={styles.stepDescription}>
      We&apos;ll send a verification code to confirm your phone number.
    </Text>

    <AppFormField
      error={phoneError}
      containerStyle={{ marginBottom: 12 }}
      errorStyle={styles.errorText}
    >
      <View style={[styles.inputWrapper, phoneError && styles.inputError]}>
        <RawTextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(formatPhoneForDisplay(text));
            setPhoneError('');
          }}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="phone-pad"
          maxLength={14}
        />
      </View>
    </AppFormField>

    <AuthStepButton
      title="Send Verification Code"
      onPress={onSendOtp}
      loading={sendingOtp}
    />

    <TouchableOpacity
      onPress={onSkipPhone}
      style={styles.skipBtn}
      disabled={loading}
    >
      <Text style={styles.skipText}>Skip for Now</Text>
    </TouchableOpacity>
  </>
);

export default AuthPhoneInputStep;
