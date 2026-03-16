import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseModal from '../../../components/BaseModal';
import AppFormField from '../../../components/ui/AppFormField';
import AppInput from '../../../components/ui/AppInput';
import { colors, spacing } from '../../../styles/theme';
import { US_STATES } from '../DriverOnboardingScreen.constants';

export default function AddressStep({
  styles,
  verificationDataPopulated,
  isLoadingVerificationData,
  formData,
  isLoadingAddress,
  addressSuggestions,
  updateFormData,
  searchAddress,
  handleAddressSelect,
  setShowStatePicker,
  showStatePicker,
  statePickerRef,
  closeStatePicker,
  screenHeight,
  formatZipCode,
}) {
  const zipError =
    formData.address.postalCode.length > 0 && formData.address.postalCode.length < 5
      ? 'ZIP must be 5 digits'
      : '';

  return (
    <View style={styles.formContent}>
      {verificationDataPopulated && !isLoadingVerificationData && formData.address.line1 && (
        <View style={styles.autoFilledBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.autoFilledText}>Address pre-filled from your ID. Review and edit if needed.</Text>
        </View>
      )}
      <AppFormField
        label="Street Address"
        required
        containerStyle={[styles.inputContainer, { zIndex: 10 }]}
        labelStyle={styles.inputLabel}
      >
        <View style={styles.addressInputWrapper}>
          <TextInput
            style={[styles.textInput, isLoadingAddress && styles.textInputWithLoader]}
            value={formData.address.line1}
            onChangeText={(value) => {
              updateFormData('address.line1', value);
              searchAddress(value);
            }}
            placeholder="Start typing an address..."
            placeholderTextColor={colors.text.placeholder}
            autoCapitalize="words"
          />
          {isLoadingAddress && (
            <View style={styles.addressLoadingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
        {addressSuggestions.length > 0 && (
          <ScrollView
            style={styles.suggestionsContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {addressSuggestions.map((feature) => (
              <TouchableOpacity
                key={feature.id}
                style={styles.suggestionItem}
                onPress={() => handleAddressSelect(feature)}
              >
                <Ionicons name="location-outline" size={18} color={colors.text.subtle} style={{ marginRight: spacing.sm }} />
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {feature.place_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </AppFormField>

      <View style={styles.inputRow}>
        <AppInput
          containerStyle={[styles.inputContainer, { flex: 2, marginRight: spacing.sm }]}
          label="City *"
          value={formData.address.city}
          onChangeText={(value) => updateFormData('address.city', value)}
          placeholder="Atlanta"
          autoCapitalize="words"
          inputStyle={styles.textInput}
        />
        <AppFormField
          label="State"
          required
          containerStyle={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}
          labelStyle={styles.inputLabel}
        >
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStatePicker(true)}
          >
            <Text style={formData.address.state ? styles.pickerButtonText : styles.pickerButtonPlaceholder}>
              {formData.address.state || 'Select'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.text.subtle} />
          </TouchableOpacity>
        </AppFormField>
      </View>

      <AppInput
        containerStyle={styles.inputContainer}
        label="ZIP Code *"
        value={formData.address.postalCode}
        onChangeText={(value) => updateFormData('address.postalCode', formatZipCode(value))}
        placeholder="30309"
        keyboardType="numeric"
        maxLength={5}
        inputStyle={styles.textInput}
        error={zipError}
      />

      <BaseModal
        ref={statePickerRef}
        visible={showStatePicker}
        onClose={() => setShowStatePicker(false)}
        height={screenHeight * 0.5}
        backgroundColor={colors.background.tertiary}
      >
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Select State</Text>
        </View>
        <ScrollView style={styles.pickerList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {formData.address.state ? (
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => {
                updateFormData('address.state', '');
                closeStatePicker();
              }}
            >
              <Text style={[styles.pickerItemText, { color: colors.text.subtle }]}>Clear selection</Text>
              <Ionicons name="close-circle-outline" size={20} color={colors.text.subtle} />
            </TouchableOpacity>
          ) : null}
          {US_STATES.map((state) => (
            <TouchableOpacity
              key={state.value}
              style={[
                styles.pickerItem,
                formData.address.state === state.value && styles.pickerItemSelected,
              ]}
              onPress={() => {
                updateFormData('address.state', state.value);
                closeStatePicker();
              }}
            >
              <Text style={[
                styles.pickerItemText,
                formData.address.state === state.value && styles.pickerItemTextSelected,
              ]}>
                {state.label}
              </Text>
              {formData.address.state === state.value && (
                <Ionicons name="checkmark" size={20} color={colors.success} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BaseModal>
    </View>
  );
}
