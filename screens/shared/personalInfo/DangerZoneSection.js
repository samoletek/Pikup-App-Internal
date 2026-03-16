import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function DangerZoneSection({
  styles,
  deletingAccount,
  onDeleteAccount,
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>DANGER ZONE</Text>
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dangerDescription}>
          Deleting your account is permanent and removes access to your profile data.
        </Text>
        <TouchableOpacity
          style={[styles.dangerButton, deletingAccount && styles.dangerButtonDisabled]}
          onPress={onDeleteAccount}
          disabled={deletingAccount}
        >
          <Text style={styles.dangerButtonText}>
            {deletingAccount ? 'Deleting...' : 'Delete Account'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
