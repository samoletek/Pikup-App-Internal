import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { colors } from '../../../styles/theme';

export default function AddressSection({ styles, personalInfo, onChangeField }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>ADDRESS</Text>
      <View style={styles.card}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Street Address</Text>
          <TextInput
            style={styles.textInput}
            value={personalInfo.address}
            onChangeText={(value) => onChangeField('address', value)}
            placeholder="Street Address"
            placeholderTextColor={colors.text.placeholder}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.textInput}
            value={personalInfo.city}
            onChangeText={(value) => onChangeField('city', value)}
            placeholder="City"
            placeholderTextColor={colors.text.placeholder}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <View style={[styles.rowInputs, styles.inputGroupLast]}>
          <View style={styles.halfInput}>
            <Text style={styles.inputLabel}>State</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.state}
              onChangeText={(value) => onChangeField('state', value)}
              placeholder="State"
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.inputLabel}>ZIP Code</Text>
            <TextInput
              style={styles.textInput}
              value={personalInfo.zipCode}
              onChangeText={(value) => onChangeField('zipCode', value)}
              placeholder="ZIP"
              placeholderTextColor={colors.text.placeholder}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
