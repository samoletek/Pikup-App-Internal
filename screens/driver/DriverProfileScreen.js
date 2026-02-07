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

export default function DriverProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    logout,
    getDriverProfile,
    getUserProfile,
    profileImage,
    getProfileImage,
    getDriverFeedback,
  } = useAuth();

  const [driverProfile, setDriverProfile] = useState(null);
  const [displayName, setDisplayName] = useState("Driver");
  const [onboardingStatus, setOnboardingStatus] = useState({
    connectAccountCreated: false,
    onboardingComplete: false,
    documentsVerified: false,
    canReceivePayments: false,
  });
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
    try {
      const profile = await getDriverProfile?.(currentUser?.uid);
      setDriverProfile(profile);

      const user = await getUserProfile?.();
      const name =
        user?.name ||
        (user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : currentUser?.email?.split("@")[0] || "Driver");
      setDisplayName(name);

      await getProfileImage?.();

      if (!profile) {
        return;
      }

      setOnboardingStatus({
        connectAccountCreated: !!profile.connectAccountId,
        onboardingComplete: profile.onboardingComplete || false,
        documentsVerified: profile.documentsVerified || false,
        canReceivePayments: profile.canReceivePayments || false,
      });

      if (profile.canReceivePayments || profile.onboardingComplete) {
        loadDriverFeedback();
      }
    } catch (error) {
      console.error("Error loading driver profile:", error);
    }
  };

  const loadDriverFeedback = async () => {
    if (!currentUser?.uid) {
      return;
    }

    setLoadingFeedback(true);
    try {
      const feedback = await getDriverFeedback(currentUser.uid, 5);
      setRecentFeedback(feedback);
    } catch (error) {
      console.error("Error loading feedback:", error);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleStartOnboarding = () => {
    navigation.navigate("DriverOnboardingScreen");
  };

  const handleResumeOnboarding = () => {
    if (onboardingStatus.connectAccountCreated) {
      navigation.navigate("DriverOnboardingResumeScreen");
      return;
    }
    navigation.navigate("DriverOnboardingScreen");
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

  const handleEarnings = () => {
    if (!onboardingStatus.canReceivePayments) {
      Alert.alert(
        "Complete Setup Required",
        "Please complete your driver onboarding to view earnings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Complete Setup", onPress: handleResumeOnboarding },
        ]
      );
      return;
    }
    navigation.navigate("DriverEarningsScreen");
  };

  const handlePaymentSettings = () => {
    if (!onboardingStatus.connectAccountCreated) {
      Alert.alert(
        "Setup Required",
        "Please complete driver onboarding first to manage payment settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Setup", onPress: handleStartOnboarding },
        ]
      );
      return;
    }
    navigation.navigate("DriverPaymentSettingsScreen");
  };

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isReadyToEarn = onboardingStatus.canReceivePayments;
  const completedTrips = isReadyToEarn ? String(driverProfile?.totalTrips || 156) : "--";
  const acceptanceRate = isReadyToEarn
    ? `${driverProfile?.acceptanceRate || 98}%`
    : "--";
  const ratingValue = isReadyToEarn ? String(driverProfile?.rating || "5.0") : "--";

  const statusConfig = isReadyToEarn
    ? {
        title: "Ready to Earn",
        subtitle: "Your account is fully set up",
        icon: "checkmark-circle",
        iconColor: colors.success,
        backgroundColor: colors.background.successSubtle,
        borderColor: colors.success,
        ctaLabel: null,
        onPress: null,
      }
    : onboardingStatus.connectAccountCreated
      ? {
          title: "Complete Your Setup",
          subtitle: onboardingStatus.onboardingComplete
            ? "Documents pending review"
            : "Finish verification to start earning",
          icon: "time",
          iconColor: colors.primary,
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary,
          ctaLabel: "Continue",
          onPress: handleResumeOnboarding,
        }
      : {
          title: "Setup Required",
          subtitle: "Complete onboarding to start earning",
          icon: "alert-circle",
          iconColor: colors.warning,
          backgroundColor: colors.background.warningSubtle,
          borderColor: colors.warning,
          ctaLabel: "Start",
          onPress: handleStartOnboarding,
        };

  const feedbackToRender = recentFeedback.slice(0, 3);

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
                <View
                  style={[
                    styles.verifiedBadgeOnAvatar,
                    !isReadyToEarn && styles.verifiedBadgeOnAvatarPending,
                  ]}
                >
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                </View>
              </TouchableOpacity>

              <Text style={styles.userName}>{displayName}</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.primary} />
                <Text style={styles.ratingText}>{ratingValue}</Text>
                <Text
                  style={[
                    styles.verifiedText,
                    !isReadyToEarn && styles.verifiedTextPending,
                  ]}
                >
                  {isReadyToEarn ? "Verified Driver" : "Pending Verification"}
                </Text>
              </View>
            </View>

            <View style={styles.statsColumn}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{completedTrips}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{acceptanceRate}</Text>
                <Text style={styles.statLabel}>Acceptance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{ratingValue}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={statusConfig.onPress ? 0.8 : 1}
          disabled={!statusConfig.onPress}
          style={[
            styles.statusCard,
            {
              backgroundColor: statusConfig.backgroundColor,
              borderColor: statusConfig.borderColor,
            },
          ]}
          onPress={statusConfig.onPress}
        >
          <View style={styles.statusLeft}>
            <Ionicons name={statusConfig.icon} size={22} color={statusConfig.iconColor} />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>{statusConfig.title}</Text>
              <Text style={styles.statusSubtitle}>{statusConfig.subtitle}</Text>
            </View>
          </View>

          {statusConfig.ctaLabel ? (
            <View style={styles.statusCta}>
              <Text style={styles.statusCtaText}>{statusConfig.ctaLabel}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <Ionicons
              name="help-circle-outline"
              size={32}
              color={colors.primary}
            />
            <Text style={styles.actionText}>Help</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={[styles.actionButton, !isReadyToEarn && styles.actionButtonDisabled]}
            onPress={isReadyToEarn ? handleEarnings : handleResumeOnboarding}
          >
            <Ionicons
              name="wallet-outline"
              size={32}
              color={isReadyToEarn ? colors.primary : colors.text.muted}
            />
            <Text
              style={[
                styles.actionText,
                !isReadyToEarn && styles.actionTextDisabled,
              ]}
            >
              Earnings
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.infoCard, !isReadyToEarn && styles.infoCardDisabled]}
          onPress={isReadyToEarn ? handleEarnings : handleResumeOnboarding}
          activeOpacity={0.85}
        >
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>
              {isReadyToEarn ? "Today's Earnings" : "Earnings Locked"}
            </Text>
            <Text style={styles.infoCardSubtitle}>
              {isReadyToEarn
                ? "Complete more trips to increase earnings"
                : "Complete setup to start earning"}
            </Text>
          </View>
          <View
            style={[
              styles.infoIconCircle,
              !isReadyToEarn && styles.infoIconCircleDisabled,
            ]}
          >
            <Ionicons
              name={isReadyToEarn ? "cash-outline" : "lock-closed-outline"}
              size={22}
              color={isReadyToEarn ? colors.success : colors.text.muted}
            />
          </View>
        </TouchableOpacity>

        {isReadyToEarn ? (
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.feedbackTitle}>Recent Feedback</Text>
              {feedbackToRender.length > 0 ? (
                <Text style={styles.feedbackCount}>
                  {feedbackToRender.length} reviews
                </Text>
              ) : null}
            </View>

            {loadingFeedback ? (
              <Text style={styles.feedbackLoadingText}>Loading feedback...</Text>
            ) : feedbackToRender.length > 0 ? (
              feedbackToRender.map((feedback, index) => (
                <View key={`${feedback.timestamp || "feedback"}-${index}`} style={styles.feedbackItem}>
                  <View style={styles.feedbackStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= (feedback.rating || 5) ? "star" : "star-outline"}
                        size={14}
                        color={star <= (feedback.rating || 5) ? colors.gold : colors.border.light}
                      />
                    ))}
                    <Text style={styles.feedbackDate}>
                      {feedback.timestamp
                        ? new Date(feedback.timestamp).toLocaleDateString()
                        : ""}
                    </Text>
                  </View>
                  <Text style={styles.feedbackComment} numberOfLines={2}>
                    {feedback.comment ? `"${feedback.comment}"` : "No comment provided"}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.feedbackEmpty}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color={colors.text.muted}
                />
                <Text style={styles.feedbackEmptyText}>No feedback yet</Text>
              </View>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.infoCard}
          onPress={() => navigation.navigate("DriverPreferencesScreen")}
          activeOpacity={0.85}
        >
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>PikUp Preferences</Text>
            <Text style={styles.infoCardSubtitle}>
              Set pickup types, equipment and availability
            </Text>
          </View>
          <View style={styles.infoIconCircle}>
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <View style={styles.menuSections}>
          <TouchableOpacity style={styles.menuItem} onPress={handlePaymentSettings}>
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="card-outline"
                size={20}
                color={
                  onboardingStatus.connectAccountCreated
                    ? colors.primary
                    : colors.text.muted
                }
              />
              <Text
                style={[
                  styles.menuItemTitle,
                  !onboardingStatus.connectAccountCreated && styles.menuItemTitleDisabled,
                ]}
              >
                Payment Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerPersonalInfoScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>Personal Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Linking.openURL("https://pikup-app.com/")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>Terms and Privacy</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerSafetyScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.menuItemTitle}>Safety</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
              <Text style={styles.menuItemTitle}>Settings</Text>
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
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  verifiedBadgeOnAvatarPending: {
    backgroundColor: colors.warning,
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
  verifiedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    fontWeight: typography.fontWeight.medium,
  },
  verifiedTextPending: {
    color: colors.warning,
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
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
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
  statusCta: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  statusCtaText: {
    color: colors.text.primary,
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
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginTop: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  actionTextDisabled: {
    color: colors.text.muted,
  },
  actionDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border.strong,
  },
  infoCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
    flexDirection: "row",
    alignItems: "center",
  },
  infoCardDisabled: {
    opacity: 0.7,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  infoCardSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  infoIconCircle: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  infoIconCircleDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  feedbackCard: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    padding: spacing.base,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  feedbackTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  feedbackCount: {
    color: colors.text.link,
    fontSize: typography.fontSize.base,
  },
  feedbackLoadingText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  feedbackItem: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  feedbackStars: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  feedbackDate: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  feedbackComment: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    fontStyle: "italic",
  },
  feedbackEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
  },
  feedbackEmptyText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
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
  menuItemTitleDisabled: {
    color: colors.text.muted,
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
