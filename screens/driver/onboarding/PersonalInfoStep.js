import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../../styles/theme";
import AppInput from "../../../components/ui/AppInput";

const PersonalInfoStep = ({
  styles,
  isLoadingVerificationData,
  verificationDataPopulated,
  formData,
  updateFormData,
  formatName,
  formatPhoneNumber,
  formatDateOfBirth,
}) => {
  const firstNameError =
    formData.firstName.length > 0 && formData.firstName.length < 2
      ? "Min 2 characters"
      : "";
  const lastNameError =
    formData.lastName.length > 0 && formData.lastName.length < 2
      ? "Min 2 characters"
      : "";
  const isIdentityNameLocked = verificationDataPopulated && !isLoadingVerificationData;

  return (
    <View style={styles.formContent}>
      {isLoadingVerificationData && !verificationDataPopulated && (
        <View style={styles.autoFilledBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.autoFilledText}>Loading verified information...</Text>
        </View>
      )}
      {verificationDataPopulated && !isLoadingVerificationData && (
        <View style={styles.autoFilledBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.autoFilledText}>Name fields were pre-filled from Stripe verification and are locked.</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <AppInput
          containerStyle={[styles.inputContainer, { flex: 1, marginRight: spacing.sm }]}
          label="First Name *"
          value={formData.firstName}
          onChangeText={(value) => updateFormData("firstName", formatName(value))}
          editable={!isIdentityNameLocked}
          selectTextOnFocus={!isIdentityNameLocked}
          placeholder="John"
          autoCapitalize="words"
          maxLength={30}
          inputStyle={[
            styles.textInput,
            isIdentityNameLocked && styles.lockedInput,
            firstNameError && styles.textInputError,
          ]}
          error={firstNameError}
        />
        <AppInput
          containerStyle={[styles.inputContainer, { flex: 1, marginLeft: spacing.sm }]}
          label="Last Name *"
          value={formData.lastName}
          onChangeText={(value) => updateFormData("lastName", formatName(value))}
          editable={!isIdentityNameLocked}
          selectTextOnFocus={!isIdentityNameLocked}
          placeholder="Doe"
          autoCapitalize="words"
          maxLength={30}
          inputStyle={[
            styles.textInput,
            isIdentityNameLocked && styles.lockedInput,
            lastNameError && styles.textInputError,
          ]}
          error={lastNameError}
        />
      </View>

      <AppInput
        containerStyle={styles.inputContainer}
        label="Phone Number *"
        value={formData.phoneNumber}
        onChangeText={(value) => updateFormData("phoneNumber", formatPhoneNumber(value))}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
        maxLength={14}
        inputStyle={styles.textInput}
      />

      <AppInput
        containerStyle={styles.inputContainer}
        label="Date of Birth *"
        value={formData.dateOfBirth}
        onChangeText={(value) => updateFormData("dateOfBirth", formatDateOfBirth(value))}
        placeholder="MM/DD/YYYY"
        keyboardType="numeric"
        maxLength={10}
        inputStyle={styles.textInput}
      />
    </View>
  );
};

export default PersonalInfoStep;
