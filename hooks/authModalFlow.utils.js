export const COUNTRY_CODE = '+1';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getEmailValidationError = (value) => {
  if (!value.trim()) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(value)) {
    return 'Invalid email address';
  }
  return '';
};

export const getNameValidationError = (value) => {
  if (!value.trim()) {
    return 'Name is required';
  }
  return '';
};

export const getPasswordValidationError = (value) => {
  if (!value) {
    return 'Password is required';
  }
  if (value.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return '';
};

export const getConfirmPasswordValidationError = (confirmPassword, password) => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (confirmPassword !== password) {
    return 'Passwords do not match';
  }
  return '';
};

export const resolveNameParts = (name) => {
  const nameParts = String(name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  return { firstName, lastName };
};

export const buildUsPhoneWithCountryCode = (phoneNumber) => {
  return `${COUNTRY_CODE}${String(phoneNumber || '').replace(/[^\d]/g, '')}`;
};
