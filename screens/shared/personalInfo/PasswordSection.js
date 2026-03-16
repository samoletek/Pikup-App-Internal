import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';
import { PASSWORD_FIELD_CONFIG } from './constants';

export default function PasswordSection({
  styles,
  passwordData,
  passwordVisibility,
  passwordErrors,
  changingPassword,
  onChangeField,
  onToggleVisibility,
  onSubmit,
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>
      <View style={styles.card}>
        {PASSWORD_FIELD_CONFIG.map((fieldConfig, index) => {
          const fieldKey = fieldConfig.key;
          const isLastField = index === PASSWORD_FIELD_CONFIG.length - 1;
          const isVisible = Boolean(passwordVisibility[fieldKey]);
          const errorMessage = passwordErrors[fieldKey];

          return (
            <View key={fieldKey} style={[styles.inputGroup, isLastField && styles.inputGroupLast]}>
              <Text style={styles.inputLabel}>{fieldConfig.label}</Text>
              <View style={styles.passwordInputRow}>
                <TextInput
                  style={[styles.textInput, styles.passwordTextInput]}
                  value={passwordData[fieldKey]}
                  onChangeText={(value) => onChangeField(fieldKey, value)}
                  placeholder={fieldConfig.placeholder}
                  placeholderTextColor={colors.text.placeholder}
                  textContentType={fieldConfig.textContentType}
                  secureTextEntry={!isVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={fieldConfig.returnKeyType}
                />
                <TouchableOpacity
                  style={styles.passwordVisibilityButton}
                  onPress={() => onToggleVisibility(fieldKey)}
                  accessibilityRole="button"
                  accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={isVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </View>
          );
        })}

        {passwordErrors.general ? <Text style={styles.errorText}>{passwordErrors.general}</Text> : null}

        <TouchableOpacity
          style={[styles.passwordActionButton, changingPassword && styles.passwordActionButtonDisabled]}
          onPress={onSubmit}
          disabled={changingPassword}
        >
          <Text style={styles.passwordActionButtonText}>
            {changingPassword ? 'Updating...' : 'Update Password'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
