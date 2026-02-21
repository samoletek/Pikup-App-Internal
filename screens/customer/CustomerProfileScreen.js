import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import { CUSTOMER_RATING_BADGES } from "../../constants/ratingBadges";
import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function CustomerProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    logout,
    getUserProfile,
    getUserPickupRequests,
    profileImage,
    getProfileImage,
    uploadProfileImage,
    deleteProfileImage,
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const [customerProfile, setCustomerProfile] = useState(null);
  const [displayName, setDisplayName] = useState("User");
  const [accountStats, setAccountStats] = useState({
    totalTrips: 0,
    totalSpent: 0,
    avgRating: 5,
  });
  const [memberSince, setMemberSince] = useState("New on Pikup");
  const [downloadingData, setDownloadingData] = useState(false);

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  useEffect(() => {
    loadAccountStats();
  }, [currentUser, customerProfile]);

  useEffect(() => {
    const dateStr =
      customerProfile?.created_at || currentUser?.created_at;
    if (dateStr) {
      const createdYear = new Date(dateStr).getFullYear();
      const currentYear = new Date().getFullYear();
      const years = currentYear - createdYear;
      setMemberSince(years > 0 ? `${years} yr on Pikup` : "New on Pikup");
    }
  }, [customerProfile, currentUser]);

  const loadCustomerProfile = async () => {
    try {
      const profile = await getUserProfile?.(currentUserId);
      setCustomerProfile(profile?.customerProfile || profile || null);

      const firstName = profile?.first_name || profile?.firstName || "";
      const lastName = profile?.last_name || profile?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const name =
        fullName ||
        profile?.name ||
        currentUser?.email?.split("@")[0] ||
        "User";
      setDisplayName(name);

      await getProfileImage?.();
    } catch (error) {
      console.error("Error loading customer profile:", error);
    }
  };

  const loadAccountStats = async () => {
    if (!currentUser) return;
    try {
      const pickupRequests = await getUserPickupRequests?.();
      const requests = Array.isArray(pickupRequests) ? pickupRequests : [];
      const completedTrips = requests.filter(
        (trip) => normalizeTripStatus(trip.status) === TRIP_STATUS.COMPLETED
      );
      const totalSpent = completedTrips.reduce((sum, trip) => {
        const amount = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;
        return sum + amount;
      }, 0);
      const rating =
        Number(
          customerProfile?.rating ||
            customerProfile?.customerProfile?.rating ||
            5
        ) || 5;

      setAccountStats({
        totalTrips: completedTrips.length,
        totalSpent,
        avgRating: rating,
      });
    } catch (error) {
      console.error("Error loading account stats:", error);
    }
  };

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

  const handleDownloadMyData = () => {
    if (downloadingData) return;

    Alert.alert(
      "Download My Data",
      "This will export all your personal data as a JSON file. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            setDownloadingData(true);
            try {
              const { data: sessionData, error: sessionError } =
                await supabase.auth.getSession();
              if (sessionError || !sessionData?.session?.access_token) {
                throw new Error("Session expired. Please sign in again.");
              }

              const { data, error } = await supabase.functions.invoke(
                "download-user-data",
                {
                  headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                  },
                  body: { role: "customer" },
                }
              );

              if (error) {
                let errorMessage = "Failed to download data.";
                if (error?.context) {
                  try {
                    const errorBody = await error.context.clone().json();
                    errorMessage =
                      errorBody?.error || errorBody?.message || errorMessage;
                  } catch (_) {}
                }
                throw new Error(errorMessage);
              }

              const fileName = `pikup-data-${Date.now()}.json`;
              const fileUri = FileSystem.cacheDirectory + fileName;
              await FileSystem.writeAsStringAsync(
                fileUri,
                JSON.stringify(data, null, 2)
              );

              const sharingAvailable = await Sharing.isAvailableAsync();
              if (!sharingAvailable) {
                Alert.alert(
                  "Sharing Unavailable",
                  "Sharing is not available on this device."
                );
                return;
              }

              await Sharing.shareAsync(fileUri, {
                mimeType: "application/json",
                dialogTitle: "Save Your Data",
                UTI: "public.json",
              });
            } catch (err) {
              console.error("Error downloading user data:", err);
              Alert.alert(
                "Error",
                err?.message || "Failed to download your data. Please try again."
              );
            } finally {
              setDownloadingData(false);
            }
          },
        },
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    try {
      await uploadProfileImage?.(result.assets[0].uri);
      Alert.alert("Success", "Profile picture updated successfully.");
      await getProfileImage?.();
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile picture.");
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library permission is required to choose photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    try {
      await uploadProfileImage?.(result.assets[0].uri);
      Alert.alert("Success", "Profile picture updated successfully.");
      await getProfileImage?.();
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile picture.");
    }
  };

  const removePhoto = () => {
    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProfileImage?.();
              Alert.alert("Success", "Profile picture removed.");
            } catch (error) {
              Alert.alert("Error", "Failed to remove profile picture.");
            }
          },
        },
      ]
    );
  };

  const handleProfilePhotoPress = () => {
    Alert.alert("Update Profile Picture", "Choose an option", [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Remove Photo", style: "destructive", onPress: removePhoto },
    ]);
  };

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const totalTrips = String(accountStats.totalTrips || 0);
  const ratingValue = (accountStats.avgRating || 5).toFixed(1);
  const topCustomerBadges = useMemo(() => {
    const badgeStats = customerProfile?.badge_stats || {};
    return CUSTOMER_RATING_BADGES.map((badge) => ({
      ...badge,
      count: Number(badgeStats?.[badge.id] || 0),
    }))
      .filter((badge) => badge.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [customerProfile]);

  /* ── Scroll snap (same pattern as Activity/Messages) ── */
  const titleLockCompensation = scrollY.interpolate({
    inputRange: [0, TITLE_COLLAPSE_DISTANCE],
    outputRange: [0, TITLE_COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TITLE_COLLAPSE_DISTANCE) return null;
    return offsetY < TITLE_COLLAPSE_DISTANCE / 2 ? 0 : TITLE_COLLAPSE_DISTANCE;
  };

  const snapToNearestOffset = (offsetY) => {
    const target = getSnapOffset(offsetY);
    if (target === null || Math.abs(target - offsetY) < 1) return;
    if (!scrollRef.current) return;
    isSnappingRef.current = true;
    scrollRef.current.scrollTo({ y: target, animated: true });
    setTimeout(() => { isSnappingRef.current = false; }, 220);
  };

  const handleScrollEndDrag = (e) => {
    if (isSnappingRef.current) return;
    const vy = e.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(vy) < 0.15) snapToNearestOffset(e.nativeEvent.contentOffset.y);
  };

  const handleMomentumScrollEnd = (e) => {
    if (isSnappingRef.current) return;
    snapToNearestOffset(e.nativeEvent.contentOffset.y);
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
        <Animated.View
          style={[
            styles.largeTitleSection,
            { transform: [{ translateY: titleLockCompensation }] },
          ]}
        >
          <Text style={styles.largeTitle}>Account</Text>
        </Animated.View>

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
              <Text style={styles.statNumber}>{totalTrips}</Text>
              <Text style={styles.statLabel}>REVIEWS</Text>
            </View>
            <View style={styles.statDividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{ratingValue}</Text>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
          </View>

          {topCustomerBadges.length > 0 && (
            <View style={styles.badgesSummary}>
              <Text style={styles.badgesSummaryTitle}>Top feedback badges</Text>
              <View style={styles.badgesSummaryRow}>
                {topCustomerBadges.map((badge) => (
                  <View key={badge.id} style={styles.badgeChip}>
                    <Ionicons name={badge.icon} size={14} color={badge.activeColor} />
                    <Text style={styles.badgeChipText}>{badge.label}</Text>
                    <View style={styles.badgeChipCount}>
                      <Text style={styles.badgeChipCountText}>{badge.count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name="help-circle-outline"
                size={24}
                color={colors.primary}
              />
            </View>
            <Text style={styles.quickActionLabel}>Help</Text>
          </TouchableOpacity>

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
              <View style={styles.notificationDot} />
            </View>
            <Text style={styles.quickActionLabel}>Activity</Text>
          </TouchableOpacity>
        </View>

        {/* Settings — unified card */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.sectionCard}>
          {/* My Addresses */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("CustomerSavedAddressesScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>My Addresses</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Payment Methods */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("PaymentMethodsScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Payment Methods</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Claims */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("CustomerClaimsScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Claims</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Notifications</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

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

          {/* Download My Data */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleDownloadMyData}
            disabled={downloadingData}
          >
            <View style={styles.menuIcon}>
              <Ionicons
                name="download-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Download My Data</Text>
            </View>
            {downloadingData ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.tertiary}
              />
            )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },

  /* Large title */
  largeTitleSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.primary,
    zIndex: 2,
  },
  largeTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.background.secondary,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: "capitalize",
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  ratingValue: {
    fontSize: 15,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
    marginHorizontal: spacing.sm,
  },
  memberSinceText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  editProfileText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  /* Stats Bar */
  statsBar: {
    flexDirection: "row",
    marginTop: spacing.xl,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.muted,
    marginTop: 3,
    letterSpacing: 0.5,
  },
  statDividerVertical: {
    width: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.sm,
  },
  badgesSummary: {
    marginTop: spacing.base,
  },
  badgesSummaryTitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  badgesSummaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  badgeChip: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
  },
  badgeChipText: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.medium,
  },
  badgeChipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeChipCountText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  /* Quick Actions */
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  quickActionIcon: {
    position: "relative",
  },
  quickActionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  notificationDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },

  /* Section Label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    marginTop: spacing.sm,
  },

  /* Section Card */
  sectionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },

  /* Menu Rows */
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    gap: spacing.md,
  },
  menuIcon: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.strong,
    marginLeft: 0,
  },

});
