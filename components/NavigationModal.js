// Navigation Modal component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';
import AppButton from './ui/AppButton';

export const NavigationModal = ({ request, onComplete }) => {
  return (
    <View style={styles.modalContent}>
      <View style={styles.navHeader}>
        <View style={styles.navDirection}>
          <Text style={styles.navTurn}>↗</Text>
          <Text style={styles.navInstruction}>Turn Right</Text>
        </View>
        <View style={styles.navDestination}>
          <Text style={styles.navDistance}>1400 Denver West Blvd</Text>
          <Text style={styles.navArrows}>↑ ↑ ↑</Text>
        </View>
      </View>

      <View style={styles.loadingSection}>
        <Text style={styles.loadingText}>Loading in progress</Text>
        <View style={styles.customerCard}>
          <Image source={request.customer.photo} style={styles.customerPhotoSmall} />
          <Text style={styles.customerNameSmall}>{request.customer.name}</Text>
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.contactBtn}>
              <Text>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactBtn}>
              <Text>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.photoSection}>
        <TouchableOpacity style={styles.photoBtn}>
          <Text style={styles.photoBtnText}>📷</Text>
          <Text style={styles.photoText}>Take a photo to verify your pickup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.takePhotoBtn}>
          <Text style={styles.takePhotoBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <Text style={styles.photoRequirement}>4 photos is required</Text>
      </View>

      <AppButton title="→ Go to pick up" onPress={onComplete} style={styles.nextBtn} />
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: colors.background.tertiary,
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  navHeader: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navDirection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navTurn: {
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
  },
  navInstruction: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  navDestination: {
    alignItems: 'flex-end',
  },
  navDistance: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  navArrows: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  loadingSection: {
    marginBottom: 20,
  },
  loadingText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    padding: 12,
    borderRadius: 10,
  },
  customerPhotoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  customerNameSmall: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoBtn: {
    width: 80,
    height: 80,
    backgroundColor: colors.background.elevated,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoBtnText: {
    fontSize: 32,
  },
  photoText: {
    color: colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  takePhotoBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 8,
  },
  takePhotoBtnText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  photoRequirement: {
    color: colors.text.tertiary,
    fontSize: 12,
  },
  nextBtn: {
    borderRadius: 12,
  },
});

// Add default export
export default NavigationModal;
