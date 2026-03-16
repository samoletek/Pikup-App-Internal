import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  getConfirmPasswordValidationError,
  getEmailValidationError,
  getNameValidationError,
  getPasswordValidationError,
} from './authModalFlow.utils';

type SetStateString = Dispatch<SetStateAction<string>>;

type UseAuthModalValidationParams = {
  password: string;
  setEmailError: SetStateString;
  setNameError: SetStateString;
  setPasswordError: SetStateString;
  setConfirmPasswordError: SetStateString;
};

export default function useAuthModalValidation({
  password,
  setEmailError,
  setNameError,
  setPasswordError,
  setConfirmPasswordError,
}: UseAuthModalValidationParams) {
  const validateEmail = useCallback((value: string) => {
    const validationError = getEmailValidationError(value);
    setEmailError(validationError);
    return !validationError;
  }, [setEmailError]);

  const validateName = useCallback((value: string) => {
    const validationError = getNameValidationError(value);
    setNameError(validationError);
    return !validationError;
  }, [setNameError]);

  const validatePassword = useCallback((value: string) => {
    const validationError = getPasswordValidationError(value);
    setPasswordError(validationError);
    return !validationError;
  }, [setPasswordError]);

  const validateConfirmPassword = useCallback((value: string) => {
    const validationError = getConfirmPasswordValidationError(value, password);
    setConfirmPasswordError(validationError);
    return !validationError;
  }, [password, setConfirmPasswordError]);

  return {
    validateEmail,
    validateName,
    validatePassword,
    validateConfirmPassword,
  };
}
