// Auth register step component: captures profile fields and consent before account creation.
import React from 'react';
import { Linking, Alert, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';
import styles from '../../AuthModal.styles';
import { links } from '../../../constants/links';
import { logger } from '../../../services/logger';
import { AuthStepButton, AuthStepInput } from './AuthStepShared';

const TERMS_URL = links.terms;
const PRIVACY_URL = links.privacy;

const openExternalUrl = async (url, fallbackMessage) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }

    Alert.alert('Error', fallbackMessage);
  } catch (error) {
    logger.error('AuthRegisterStep', 'Failed to open external URL', error);
    Alert.alert('Error', 'Failed to open link');
  }
};

const AuthRegisterStep = ({
  email,
  name,
  setName,
  nameError,
  setNameError,
  password,
  setPassword,
  passwordError,
  setPasswordError,
  showPassword,
  setShowPassword,
  confirmPassword,
  setConfirmPassword,
  confirmPasswordError,
  setConfirmPasswordError,
  showConfirmPassword,
  setShowConfirmPassword,
  loading,
  onRegister,
}) => (
  <>
    <AuthStepInput
      value={email}
      editable={false}
      placeholder="Email Address"
    />

    <AuthStepInput
      placeholder="Full Name"
      value={name}
      onChangeText={(text) => {
        setName(text);
        setNameError('');
      }}
      autoCapitalize="words"
      error={nameError}
      editable={!loading}
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

    <AuthStepInput
      placeholder="Confirm Password"
      value={confirmPassword}
      onChangeText={(text) => {
        setConfirmPassword(text);
        setConfirmPasswordError('');
      }}
      secureTextEntry={!showConfirmPassword}
      autoCapitalize="none"
      error={confirmPasswordError}
      rightIcon={<Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={colors.text.muted} />}
      onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
      editable={!loading}
    />

    <Text style={styles.termsText}>
      By creating an account, you agree to our{`\n`}
      <Text
        style={styles.linkText}
        onPress={() => openExternalUrl(TERMS_URL, `Cannot open this link: ${TERMS_URL}`)}
        suppressHighlighting={false}
      >
        Terms
      </Text>
      {' '}and{' '}
      <Text
        style={styles.linkText}
        onPress={() => openExternalUrl(PRIVACY_URL, `Cannot open this link: ${PRIVACY_URL}`)}
        suppressHighlighting={false}
      >
        Privacy Policy
      </Text>
      .
    </Text>

    <AuthStepButton
      title="Continue"
      onPress={onRegister}
      loading={loading}
    />
  </>
);

export default AuthRegisterStep;
