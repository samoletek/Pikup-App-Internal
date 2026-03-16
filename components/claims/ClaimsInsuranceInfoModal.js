// Claims Insurance Info Modal component: renders its UI and handles related interactions.
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../ui/AppButton';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

export default function ClaimsInsuranceInfoModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.infoModalOverlay}>
        <View style={styles.infoModalCard}>
          <View style={styles.infoModalHeader}>
            <View style={styles.infoTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
              <Text style={styles.infoModalTitle}>Redkik Insurance</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.infoModalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close Redkik insurance info"
            >
              <Ionicons name="close" size={20} color={colors.text.subtle} />
            </TouchableOpacity>
          </View>

          <Text style={styles.infoModalText}>
            Claims are available only for completed deliveries that were purchased with Redkik
            insurance coverage.
          </Text>
          <Text style={styles.infoModalText}>
            To avoid claim rejection, include a clear issue description and attach photos or
            supporting documents when possible.
          </Text>

          <AppButton title="Understood" onPress={onClose} style={styles.infoModalOkButton} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  infoModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  infoModalCard: {
    width: '100%',
    maxWidth: layout.sheetMaxWidth,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.lg,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  infoModalTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  infoModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoModalText: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  infoModalOkButton: {
    marginTop: spacing.sm,
  },
});
