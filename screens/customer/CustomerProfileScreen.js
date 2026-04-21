import React from "react";
import {
  Alert,
  Animated,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuthActions,
  useAuthIdentity,
  useProfileActions,
  useTripActions,
} from "../../contexts/AuthContext";
import useProfilePhotoActions from "../../hooks/useProfilePhotoActions";
import useCollapsibleTitleSnap from "../../hooks/useCollapsibleTitleSnap";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import styles from "./CustomerProfileScreen.styles";
import useCustomerProfileOverview from "./useCustomerProfileOverview";
import {
  colors,
  spacing,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function CustomerProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, profileImage } = useAuthIdentity();
  const { logout } = useAuthActions();
  const { getUserProfile, getProfileImage, uploadProfileImage, deleteProfileImage } = useProfileActions();
  const { getUserPickupRequests } = useTripActions();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const {
    scrollRef,
    scrollY,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
  } = useCollapsibleTitleSnap({ collapseDistance: TITLE_COLLAPSE_DISTANCE });

  const {
    displayName,
    memberSince,
    initials,
    totalTrips,
    reviewsCount,
    ratingValue,
  } = useCustomerProfileOverview({
    currentUser,
    currentUserId,
    getProfileImage,
    getUserPickupRequests,
    getUserProfile,
  });

  const { handleProfilePhotoPress } = useProfilePhotoActions({
    uploadProfileImage,
    deleteProfileImage,
    refreshProfileImage: getProfileImage,
  });

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: "WelcomeScreen" }],
          });
        },
      },
    ]);
  };

  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Account"
        topInset={insets.top}
        showBack={false}
        scrollY={scrollY}
        searchCollapseDistance={0}
        titleCollapseDistance={TITLE_COLLAPSE_DISTANCE}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: spacing.base,
          paddingBottom: insets.bottom + 100,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Large title (collapses on scroll like Activity/Messages) */}
        <View style={styles.largeTitleSection}>
          <Text style={styles.largeTitle}>Account</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleProfilePhotoPress}
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.ratingValue}>{ratingValue}</Text>
                <View style={styles.dotSeparator} />
                <Text style={styles.memberSinceText}>{memberSince}</Text>
              </View>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() =>
                  navigation.navigate("PersonalInfoScreen")
                }
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.editProfileText}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalTrips}</Text>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={styles.statDividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{reviewsCount}</Text>
              <Text style={styles.statLabel}>REVIEWS</Text>
            </View>
            <View style={styles.statDividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{ratingValue}</Text>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
          </View>

        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate("CustomerRewardsScreen")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name="gift-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.quickActionLabel}>Rewards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate("Activity")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name="receipt-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.quickActionLabel}>Activity</Text>
          </TouchableOpacity>
        </View>

        {/* Account Settings */}
        <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>
        <View style={styles.sectionCard}>
          {/* Settings */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="settings-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Settings</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Claims are temporarily hidden in customer UI. */}

          {/* About */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("AboutScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>About</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Help */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="help-circle-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Help</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={[styles.sectionCard, { marginTop: spacing.md }]}>
          <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
            <View style={styles.menuIcon}>
              <Ionicons
                name="log-out-outline"
                size={20}
                color={colors.error}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={[styles.menuTitle, { color: colors.error }]}>
                Sign out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
