// Request Modal Header component: renders its UI and handles related interactions.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

export default function RequestModalHeader({
  requestsCount,
  onClose,
  panHandlers,
  styles,
}) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.handleArea} {...panHandlers}>
        <View style={styles.modalHandle} />
      </View>
      <View style={styles.headerContent}>
        <Text style={styles.modalTitle}>Available Requests</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {requestsCount} request{requestsCount !== 1 ? 's' : ''} nearby
        </Text>
      </View>
    </View>
  );
}
