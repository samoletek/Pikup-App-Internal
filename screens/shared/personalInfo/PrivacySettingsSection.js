import React from 'react';
import { Text, View } from 'react-native';
import AppSwitch from '../../../components/AppSwitch';
import { PRIVACY_SETTINGS_FIELDS } from './constants';

export default function PrivacySettingsSection({ styles, privacySettings, onToggleSetting }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>PRIVACY SETTINGS</Text>
      <View style={styles.card}>
        {PRIVACY_SETTINGS_FIELDS.map((field, index) => {
          const isLast = index === PRIVACY_SETTINGS_FIELDS.length - 1;

          return (
            <View key={field.key} style={[styles.switchRow, isLast && styles.switchRowLast]}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>{field.title}</Text>
                <Text style={styles.switchDescription}>{field.description}</Text>
              </View>
              <AppSwitch
                onValueChange={() => onToggleSetting(field.key)}
                value={privacySettings[field.key]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
