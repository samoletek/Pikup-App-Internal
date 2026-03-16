import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';

function VerifiedBadge({ styles }) {
  return (
    <View style={styles.verifiedBadge}>
      <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
      <Text style={styles.verifiedBadgeText}>Verified</Text>
    </View>
  );
}

export default function BasicInfoSection({
  styles,
  personalInfo,
  fieldsLocked,
  onChangeField,
  onOpenPhoneVerify,
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>First Name</Text>
            {fieldsLocked ? <VerifiedBadge styles={styles} /> : null}
          </View>
          <TextInput
            style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
            value={personalInfo.firstName}
            onChangeText={(value) => onChangeField('firstName', value)}
            editable={!fieldsLocked}
            placeholder="First Name"
            placeholderTextColor={colors.text.placeholder}
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
          />
          {fieldsLocked ? <Text style={styles.inputNote}>Verified by identity check</Text> : null}
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>Last Name</Text>
            {fieldsLocked ? <VerifiedBadge styles={styles} /> : null}
          </View>
          <TextInput
            style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
            value={personalInfo.lastName}
            onChangeText={(value) => onChangeField('lastName', value)}
            editable={!fieldsLocked}
            placeholder="Last Name"
            placeholderTextColor={colors.text.placeholder}
            textContentType="familyName"
            autoCapitalize="words"
            returnKeyType="next"
          />
          {fieldsLocked ? <Text style={styles.inputNote}>Verified by identity check</Text> : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.textInput, styles.textInputDisabled]}
            value={personalInfo.email}
            editable={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
          />
          <Text style={styles.inputNote}>Email cannot be changed</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TouchableOpacity
            style={[styles.textInput, styles.phoneRow]}
            onPress={onOpenPhoneVerify}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.phoneText, !personalInfo.phone && { color: colors.text.placeholder }]}
            >
              {personalInfo.phone || 'Add phone number'}
            </Text>
            <Ionicons name="create-outline" size={18} color={colors.text.muted} />
          </TouchableOpacity>
          <Text style={styles.inputNote}>Changing phone requires re-verification</Text>
        </View>

        <View style={[styles.inputGroup, styles.inputGroupLast]}>
          <View style={styles.inputLabelRow}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            {fieldsLocked ? <VerifiedBadge styles={styles} /> : null}
          </View>
          <TextInput
            style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
            value={personalInfo.dateOfBirth}
            onChangeText={(value) => onChangeField('dateOfBirth', value)}
            editable={!fieldsLocked}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.text.placeholder}
          />
          {fieldsLocked ? <Text style={styles.inputNote}>Verified by identity check</Text> : null}
        </View>
      </View>
    </View>
  );
}
