import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../styles/theme';

export default function ProfilePhotoSection({
  styles,
  profileImage,
  initials,
  onProfilePhotoPress,
}) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionLabel}>PROFILE PHOTO</Text>
      <View style={[styles.card, styles.photoCard]}>
        <TouchableOpacity style={styles.profilePhotoContainer} onPress={onProfilePhotoPress}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profilePhotoImage} />
          ) : (
            <Text style={styles.profilePhotoText}>{initials}</Text>
          )}
          <View style={styles.editIconOverlay}>
            <Ionicons name="camera" size={15} color={colors.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Tap to change photo</Text>
      </View>
    </View>
  );
}
