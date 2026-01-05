import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';

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

      <TouchableOpacity style={styles.nextBtn} onPress={onComplete}>
        <Text style={styles.nextBtnText}>→ Go to pick up</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  navHeader: {
    backgroundColor: '#A77BFF',
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
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 8,
  },
  navInstruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navDestination: {
    alignItems: 'flex-end',
  },
  navDistance: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navArrows: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  loadingSection: {
    marginBottom: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a3e',
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
    color: '#fff',
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
    backgroundColor: '#A77BFF',
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
    backgroundColor: '#2a2a3e',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoBtnText: {
    fontSize: 32,
  },
  photoText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  takePhotoBtn: {
    backgroundColor: '#A77BFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 8,
  },
  takePhotoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoRequirement: {
    color: '#999',
    fontSize: 12,
  },
  nextBtn: {
    backgroundColor: '#A77BFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Add default export
export default NavigationModal;