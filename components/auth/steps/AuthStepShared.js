// Auth step shared controls: reusable button and input primitives for auth modal steps.
import React from 'react';
import { TextInput as RNTextInput } from 'react-native';
import AppButton from '../../ui/AppButton';
import AppInput from '../../ui/AppInput';
import { colors } from '../../../styles/theme';
import styles from '../../AuthModal.styles';

export const AuthStepButton = ({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}) => {
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? colors.primary : 'transparent';
  const textColor = isPrimary ? colors.white : colors.primary;
  const borderColor = isPrimary ? 'transparent' : colors.primary;

  return (
    <AppButton
      title={title}
      style={[
        styles.btn,
        {
          backgroundColor,
          borderColor,
          borderWidth: isPrimary ? 0 : 1,
        },
        style,
      ]}
      variant={isPrimary ? 'primary' : 'ghost'}
      labelStyle={[styles.btnText, { color: textColor }]}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
    />
  );
};

export const AuthStepInput = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  rightIcon,
  onRightIconPress,
  keyboardType,
  autoCapitalize,
  editable,
  label,
}) => (
  <AppInput
    containerStyle={styles.inputContainer}
    label={label}
    labelStyle={styles.inputLabel}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    secureTextEntry={secureTextEntry}
    error={error}
    rightIcon={rightIcon}
    onRightIconPress={onRightIconPress}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    editable={editable !== false}
    inputWrapperStyle={[styles.inputWrapper, error && styles.inputError]}
    inputStyle={styles.input}
    errorStyle={styles.errorText}
  />
);

export const RawTextInput = RNTextInput;
