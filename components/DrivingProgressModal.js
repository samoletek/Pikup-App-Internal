// Driving Progress Modal component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';
import AppButton from './ui/AppButton';

export const DrivingProgressModal = ({ request, onArrive, driverLocation }) => {
  return (
    <View style={styles.modalContent}>
      <View style={styles.drivingHeader}>
        <Text style={styles.drivingTitle}>Driving in Progress</Text>
      </View>

      <View style={styles.driverCard}>
        <Image source={request.customer.photo} style={styles.driverPhoto} />
        <Text style={styles.driverName}>{request.customer.name}</Text>
        <View style={styles.callButtons}>
          <TouchableOpacity style={styles.callBtn}>
            <Text style={styles.callBtnText}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AppButton title="Arrive" onPress={onArrive} style={styles.arriveBtn} />
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
  drivingHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  drivingTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  driverCard: {
    backgroundColor: colors.background.elevated,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  driverName: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  callButtons: {
    flexDirection: 'row',
  },
  callBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: {
    fontSize: 20,
  },
  arriveBtn: {
    borderRadius: 12,
  },
});

// Add default export
export default DrivingProgressModal;
