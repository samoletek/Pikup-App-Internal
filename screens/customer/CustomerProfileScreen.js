import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

export default function CustomerProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, logout, getUserProfile, profileImage, getProfileImage } = useAuth();
  const [customerProfile, setCustomerProfile] = useState(null);
  const [displayName, setDisplayName] = useState("User");

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  const loadCustomerProfile = async () => {
    try {
      const profile = await getUserProfile?.(currentUser?.uid);
      setCustomerProfile(profile?.customerProfile || null);

      const name =
        profile?.name ||
        (profile?.firstName && profile?.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : currentUser?.email?.split("@")[0] || "User");
      setDisplayName(name);

      await getProfileImage?.();
    } catch (error) {
      console.error("Error loading customer profile:", error);
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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const ratingValue = String(customerProfile?.rating || "5.0");
  const totalTrips = String(customerProfile?.totalTrips || "0");
  const totalReviews = String(customerProfile?.totalReviews || "0");
  const yearsOnApp = String(customerProfile?.yearsOnApp || "1");

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { marginTop: insets.top + spacing.lg }]}>
          <View style={styles.profileCardContent}>
            <View style={styles.profileLeftSide}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => navigation.navigate("CustomerPersonalInfoScreen")}
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileInitials}>
                    <Text style={styles.profileInitialsText}>{initials}</Text>
                  </View>
                )}

                <View style={styles.verifiedBadgeOnAvatar}>
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              </TouchableOpacity>

              <Text style={styles.userName}>{displayName}</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.primary} />
                <Text style={styles.ratingText}>{ratingValue}</Text>
                <Text style={styles.badgeText}>Trusted Customer</Text>
              </View>
            </View>

            <View style={styles.statsColumn}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalTrips}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalReviews}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{yearsOnApp}</Text>
                <Text style={styles.statLabel}>Years on Pikup</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>Account in Good Standing</Text>
              <Text style={styles.statusSubtitle}>
                Your profile is verified and ready for new trips
              </Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Active</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <Ionicons name="help-circle-outline" size={32} color={colors.primary} />
            <Text style={styles.actionText}>Help</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerWalletScreen")}
          >
            <Ionicons name="wallet-outline" size={32} color={colors.primary} />
            <Text style={styles.actionText}>Wallet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSections}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerPersonalInfoScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>View Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.menuItemTitle}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Home")}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>My Addresses</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Activity")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>My Orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerClaimsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>Claims</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL("https://pikup-app.com/")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.menuItemTitle}>Terms of Service</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL("https://pikup-app.com/")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.menuItemTitle}>Privacy Policy</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.menuItemTitle}>About Pikup</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
      </ScrollView>
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
  profileCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.lg,
  },
  profileCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileLeftSide: {
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.circle,
  },
  profileInitials: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitialsText: {
    color: colors.white,
    fontSize: 34,
    fontWeight: typography.fontWeight.semibold,
  },
  verifiedBadgeOnAvatar: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    textTransform: "capitalize",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  badgeText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  statsColumn: {
    alignItems: "flex-start",
    paddingLeft: spacing.md,
  },
  statItem: {
    paddingVertical: spacing.sm,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 120,
    height: 1,
    backgroundColor: colors.border.strong,
  },
  statusCard: {
    backgroundColor: colors.background.elevated,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  statusTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  statusSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  quickActions: {
    flexDirection: "row",
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-around",
    alignItems: "center",
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },
  actionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginTop: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actionDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border.strong,
  },
  menuSections: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemTitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  logoutButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: "center",
  },
  logoutText: {
    fontSize: typography.fontSize.md,
    color: colors.error,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  bottomSpacing: {
    height: 40,
  },
});
