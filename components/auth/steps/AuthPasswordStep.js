// Auth password step component: authenticates existing user and supports password reset.
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';
import styles from '../../AuthModal.styles';
import { AuthStepButton, AuthStepInput } from './AuthStepShared';

const AuthPasswordStep = ({
  email,
  password,
  setPassword,
  passwordError,
  setPasswordError,
  showPassword,
  setShowPassword,
  loading,
  onLogin,
  onResetPassword,
}) => (
  <>
    <AuthStepInput
      value={email}
      editable={false}
      placeholder="Email Address"
      rightIcon={<Ionicons name="checkmark" size={24} color={colors.white} />}
    />

    <AuthStepInput
      placeholder="Password"
      value={password}
      onChangeText={(text) => {
        setPassword(text);
        setPasswordError('');
      }}
      secureTextEntry={!showPassword}
      autoCapitalize="none"
      error={passwordError}
      rightIcon={<Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />}
      onRightIconPress={() => setShowPassword(!showPassword)}
      editable={!loading}
    />

    <AuthStepButton
      title="Sign In"
      onPress={onLogin}
      loading={loading}
    />

    <TouchableOpacity
      style={styles.forgotBtn}
      onPress={async () => {
        if (!email) {
          Alert.alert('Email Required', 'Please enter your email address first.');
          return;
        }

        try {
          await onResetPassword(email);
          Alert.alert(
            'Check Your Email',
            'If an account exists for this email, a password reset link has been sent.',
          );
        } catch (error) {
          Alert.alert('Error', error?.message || 'Failed to send reset email.');
        }
      }}
    >
      <Text style={styles.forgotText}>Forgot password?</Text>
    </TouchableOpacity>
  </>
);

export default AuthPasswordStep;
