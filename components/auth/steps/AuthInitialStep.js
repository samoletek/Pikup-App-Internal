// Auth initial step component: offers provider options to begin authentication flow.
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../../ui/AppButton';
import { colors } from '../../../styles/theme';
import styles from '../../AuthModal.styles';

const AuthInitialStep = ({
  animateStepChange,
  onAppleSignIn,
  onGoogleSignIn,
}) => (
  <>
    <AppButton
      title="Continue with Email"
      style={[styles.authButton, styles.emailAuthBtn]}
      onPress={() => animateStepChange('email_check')}
      labelStyle={[styles.authButtonText, { color: colors.white }]}
      leftIcon={<Ionicons name="mail-outline" size={24} color={colors.white} />}
    />

    {Platform.OS === 'ios' && (
      <AppButton
        title="Continue with Apple"
        style={[styles.authButton, styles.emailAuthBtn]}
        onPress={onAppleSignIn}
        labelStyle={[styles.authButtonText, { color: colors.white }]}
        leftIcon={<Ionicons name="logo-apple" size={24} color={colors.white} />}
      />
    )}

    <AppButton
      title="Continue with Google"
      style={[styles.authButton, styles.emailAuthBtn]}
      onPress={onGoogleSignIn}
      labelStyle={[styles.authButtonText, { color: colors.white }]}
      leftIcon={<Ionicons name="logo-google" size={24} color={colors.white} />}
    />
  </>
);

export default AuthInitialStep;
