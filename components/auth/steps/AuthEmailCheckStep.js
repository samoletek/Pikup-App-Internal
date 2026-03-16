// Auth email check step component: collects email and runs account lookup.
import React from 'react';
import { AuthStepButton, AuthStepInput } from './AuthStepShared';

const AuthEmailCheckStep = ({
  email,
  setEmail,
  emailError,
  setEmailError,
  checkingEmail,
  onCheckEmail,
}) => (
  <>
    <AuthStepInput
      placeholder="Email Address"
      value={email}
      onChangeText={(text) => {
        setEmail(text);
        setEmailError('');
      }}
      keyboardType="email-address"
      autoCapitalize="none"
      error={emailError}
    />

    <AuthStepButton
      title="Continue"
      onPress={onCheckEmail}
      loading={checkingEmail}
    />
  </>
);

export default AuthEmailCheckStep;
