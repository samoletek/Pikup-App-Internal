import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const SEARCH_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;
const TOTAL_COLLAPSE_DISTANCE =
  SEARCH_COLLAPSE_DISTANCE + TITLE_COLLAPSE_DISTANCE;

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

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const [searchText, setSearchText] = useState("");
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const loadDriverProfile = async () => {
    try {
      const profile = await getDriverProfile?.(currentUser?.uid);
      setDriverProfile(profile);

      const user = await getUserProfile?.();
      const firstName = user?.first_name || user?.firstName || "";
      const lastName = user?.last_name || user?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();
      const name =
        fullName ||
        user?.name ||
        currentUser?.email?.split("@")[0] ||
        "Driver";
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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isReadyToEarn = onboardingStatus.canReceivePayments;
  const completedTrips = isReadyToEarn
    ? String(driverProfile?.totalTrips || 156)
    : "--";
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

  const quickActions = [
    {
      id: "help",
      title: "Help",
      icon: "help-circle-outline",
      keywords: "support assistance",
      onPress: () => navigation.navigate("CustomerHelpScreen"),
      disabled: false,
    },
    {
      id: "earnings",
      title: "Earnings",
      icon: "wallet-outline",
      keywords: "income payouts trips",
      onPress: isReadyToEarn ? handleEarnings : handleResumeOnboarding,
      disabled: !isReadyToEarn,
    },
  ];

  const menuItems = [
    {
      id: "terms",
      title: "Terms and Privacy",
      icon: "document-text-outline",
      keywords: "legal privacy policy",
      onPress: () => Linking.openURL("https://pikup-app.com/"),
      disabled: false,
      external: true,
    },
    {
      id: "safety",
      title: "Safety",
      icon: "shield-checkmark-outline",
      keywords: "safe trust emergency",
      onPress: () => navigation.navigate("CustomerSafetyScreen"),
      disabled: false,
    },
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline",
      keywords: "preferences notifications",
      onPress: () => navigation.navigate("CustomerSettingsScreen"),
      disabled: false,
    },
  ];

  const query = searchText.trim().toLowerCase();
  const filteredQuickActions = !query
    ? quickActions
    : quickActions.filter((action) =>
        `${action.title} ${action.keywords}`.toLowerCase().includes(query)
      );
  const filteredMenuItems = !query
    ? menuItems
    : menuItems.filter((item) =>
        `${item.title} ${item.keywords}`.toLowerCase().includes(query)
      );

  const titleLockCompensation = scrollY.interpolate({
    inputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    outputRange: [0, SEARCH_COLLAPSE_DISTANCE],
    extrapolate: "clamp",
  });

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TOTAL_COLLAPSE_DISTANCE) {
      return null;
    }

    if (offsetY < SEARCH_COLLAPSE_DISTANCE) {
      return offsetY < SEARCH_COLLAPSE_DISTANCE / 2
        ? 0
        : SEARCH_COLLAPSE_DISTANCE;
    }

    const titleProgress = offsetY - SEARCH_COLLAPSE_DISTANCE;
    return titleProgress < TITLE_COLLAPSE_DISTANCE / 2
      ? SEARCH_COLLAPSE_DISTANCE
      : TOTAL_COLLAPSE_DISTANCE;
  };

  const snapToNearestOffset = (offsetY) => {
    const targetOffset = getSnapOffset(offsetY);
    if (targetOffset === null || Math.abs(targetOffset - offsetY) < 1) {
      return;
    }

    if (!scrollRef.current) {
      return;
    }

    isSnappingRef.current = true;
    scrollRef.current.scrollTo({ y: targetOffset, animated: true });
    setTimeout(() => {
      isSnappingRef.current = false;
    }, 220);
  };

  const handleScrollEndDrag = (event) => {
    if (isSnappingRef.current) {
      return;
    }

    const velocityY = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.15) {
      snapToNearestOffset(event.nativeEvent.contentOffset.y);
    }
  };

  const handleMomentumScrollEnd = (event) => {
    if (isSnappingRef.current) {
      return;
    }
    snapToNearestOffset(event.nativeEvent.contentOffset.y);
  };

  const renderMenuItem = (item, isLast) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, isLast && styles.menuItemLast]}
      onPress={item.onPress}
      disabled={item.disabled}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons
          name={item.icon}
          size={20}
          color={item.disabled ? colors.text.muted : colors.primary}
        />
        <Text style={[styles.menuItemTitle, item.disabled && styles.menuItemTitleDisabled]}>
          {item.title}
        </Text>
      </View>
      <Ionicons
        name={item.external ? "open-outline" : "chevron-forward"}
        size={20}
        color={colors.text.tertiary}
      />
    </TouchableOpacity>
  );

  const headerHeight = insets.top + MESSAGES_TOP_BAR_HEIGHT;

  return (
    <View style={styles.container}>
      <CollapsibleMessagesHeader
        title="Account"
        topInset={insets.top}
        showBack={false}
        scrollY={scrollY}
        searchCollapseDistance={SEARCH_COLLAPSE_DISTANCE}
        titleCollapseDistance={TITLE_COLLAPSE_DISTANCE}
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + 90,
          paddingHorizontal: spacing.base,
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
        <Animated.View
          style={[
            styles.largeTitleSection,
            { transform: [{ translateY: titleLockCompensation }] },
          ]}
        >
          <Text style={styles.largeTitle}>Account</Text>
        </Animated.View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search account and settings"
              placeholderTextColor={colors.text.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <View style={styles.profileCard}>
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

        {filteredQuickActions.length > 0 ? (
          <View style={styles.quickActions}>
            {filteredQuickActions.map((action, index) => (
              <React.Fragment key={action.id}>
                <TouchableOpacity
                  style={[styles.actionButton, action.disabled && styles.actionButtonDisabled]}
                  onPress={action.onPress}
                >
                  <Ionicons
                    name={action.icon}
                    size={32}
                    color={action.disabled ? colors.text.muted : colors.primary}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      action.disabled && styles.actionTextDisabled,
                    ]}
                  >
                    {action.title}
                  </Text>
                </TouchableOpacity>
                {index < filteredQuickActions.length - 1 ? (
                  <View style={styles.actionDivider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}

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
                <Text style={styles.feedbackCount}>{feedbackToRender.length} reviews</Text>
              ) : null}
            </View>

            {loadingFeedback ? (
              <Text style={styles.feedbackLoadingText}>Loading feedback...</Text>
            ) : feedbackToRender.length > 0 ? (
              feedbackToRender.map((feedback, index) => (
                <View
                  key={`${feedback.timestamp || "feedback"}-${index}`}
                  style={styles.feedbackItem}
                >
                  <View style={styles.feedbackStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= (feedback.rating || 5) ? "star" : "star-outline"}
                        size={14}
                        color={
                          star <= (feedback.rating || 5)
                            ? colors.gold
                            : colors.border.light
                        }
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

        {filteredMenuItems.length > 0 ? (
          <View style={styles.menuSections}>
            {filteredMenuItems.map((item, index) =>
              renderMenuItem(item, index === filteredMenuItems.length - 1)
            )}
          </View>
        ) : (
          <View style={styles.searchEmptyState}>
            <Ionicons name="search-outline" size={36} color={colors.text.tertiary} />
            <Text style={styles.searchEmptyTitle}>No matches found</Text>
            <Text style={styles.searchEmptySubtitle}>
              Try another keyword for account settings
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
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
  searchSection: {
    height: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    zIndex: 1,
    marginBottom: spacing.sm,
  },
  searchBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  profileCard: {
    backgroundColor: colors.background.secondary,
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
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.strong,
  },
  feedbackStars: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackDate: {
    marginLeft: spacing.sm,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.xs,
  },
  feedbackComment: {
    marginTop: spacing.xs,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
  },
  feedbackEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  feedbackEmptyText: {
    marginLeft: spacing.sm,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  menuSections: {
    backgroundColor: colors.background.secondary,
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
  searchEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    marginBottom: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
  },
  searchEmptyTitle: {
    marginTop: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  searchEmptySubtitle: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  logoutButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  logoutText: {
    color: colors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSpacing: {
    height: spacing.xl,
  },
});
