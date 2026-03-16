// Driver Profile Summary Card component: renders its UI and handles related interactions.
import React from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../styles/theme';

export default function DriverProfileSummaryCard({
  profileImage,
  initials,
  isReadyToEarn,
  displayName,
  onEditProfile,
  onProfilePhotoPress,
  completedTrips,
  acceptanceRate,
  ratingValue,
  driverBadges,
  ui,
}) {
  return (
    <View style={ui.profileCard}>
      <View style={ui.profileTopRow}>
        <TouchableOpacity
          style={ui.avatarContainer}
          onPress={onProfilePhotoPress}
        >
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={ui.avatarImage} />
          ) : (
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={ui.avatarGradient}
            >
              <Text style={ui.avatarInitials}>{initials}</Text>
            </LinearGradient>
          )}
          <View
            style={[
              ui.verifiedBadge,
              !isReadyToEarn && ui.verifiedBadgePending,
            ]}
          >
            <Ionicons name="checkmark" size={10} color={colors.white} />
          </View>
        </TouchableOpacity>

        <View style={ui.profileInfo}>
          <Text style={ui.userName}>{displayName}</Text>
          <View style={ui.ratingRow}>
            <Ionicons
              name={isReadyToEarn ? 'checkmark-circle' : 'time'}
              size={14}
              color={isReadyToEarn ? colors.success : colors.warning}
            />
            <Text
              style={[
                ui.verifiedText,
                !isReadyToEarn && ui.verifiedTextPending,
              ]}
            >
              {isReadyToEarn ? 'Verified Driver' : 'Pending Verification'}
            </Text>
          </View>
          <TouchableOpacity
            style={ui.editProfileButton}
            onPress={onEditProfile}
          >
            <Ionicons name="create-outline" size={14} color={colors.primary} />
            <Text style={ui.editProfileText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={ui.statsBar}>
        <View style={ui.statItem}>
          <Text style={ui.statNumber}>{completedTrips}</Text>
          <Text style={ui.statLabel}>TRIPS</Text>
        </View>
        <View style={ui.statDividerVertical} />
        <View style={ui.statItem}>
          <Text style={ui.statNumber}>{acceptanceRate}</Text>
          <Text style={ui.statLabel}>ACCEPTANCE</Text>
        </View>
        <View style={ui.statDividerVertical} />
        <View style={ui.statItem}>
          <Text style={ui.statNumber}>{ratingValue}</Text>
          <Text style={ui.statLabel}>RATING</Text>
        </View>
      </View>

      <View style={ui.badgesBar}>
        {driverBadges.map((badge, index) => (
          <React.Fragment key={badge.id}>
            {index > 0 ? <View style={ui.badgeDividerVertical} /> : null}
            <View style={ui.badgeItem}>
              <View style={ui.badgeInfo}>
                <Ionicons name={badge.icon} size={14} color={badge.activeColor} />
                <Text style={ui.badgeLabel}>{badge.label}</Text>
              </View>
              <View style={ui.badgeChipCount}>
                <Text style={ui.badgeChipCountText}>{badge.count}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
