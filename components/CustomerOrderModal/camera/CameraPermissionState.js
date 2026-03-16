// Camera permission state component: requests camera permission before entering capture flow.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';
import styles from '../CameraScreen.styles';

const CameraPermissionState = ({ onRequestPermission, onClose }) => (
  <View style={styles.permissionContainer}>
    <Ionicons name="camera-outline" size={64} color={colors.text.muted} />
    <Text style={styles.permissionTitle}>Camera Access Needed</Text>
    <Text style={styles.permissionSubtitle}>
      Allow camera access to take photos of your items
    </Text>

    <TouchableOpacity style={styles.permissionBtn} onPress={onRequestPermission}>
      <Text style={styles.permissionBtnText}>Allow Camera</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.permissionCancel} onPress={onClose}>
      <Text style={styles.permissionCancelText}>Cancel</Text>
    </TouchableOpacity>
  </View>
);

export default CameraPermissionState;
