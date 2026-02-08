import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
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

export default function CustomerProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    logout,
    getUserProfile,
    getUserPickupRequests,
    profileImage,
    getProfileImage,
  } = useAuth();

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const [searchText, setSearchText] = useState("");
  const [customerProfile, setCustomerProfile] = useState(null);
  const [displayName, setDisplayName] = useState("User");
  const [accountStats, setAccountStats] = useState({
    totalTrips: 0,
    totalSpent: 0,
    avgRating: 5,
  });

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  useEffect(() => {
    loadAccountStats();
  }, [currentUser, customerProfile]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: SEARCH_COLLAPSE_DISTANCE,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const loadCustomerProfile = async () => {
    try {
      const profile = await getUserProfile?.(currentUser?.uid);
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
    if (!currentUser) {
      return;
    }

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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const totalTrips = String(accountStats.totalTrips || 0);
  const totalSpent = `$${Math.round(accountStats.totalSpent || 0)}`;
  const ratingValue = (accountStats.avgRating || 5).toFixed(1);

  const quickActions = useMemo(
    () => [
      {
        id: "help",
        title: "Help",
        icon: "help-circle-outline",
        keywords: "support assistance",
        onPress: () => navigation.navigate("CustomerHelpScreen"),
      },
      {
        id: "wallet",
        title: "Wallet",
        icon: "wallet-outline",
        keywords: "payment cards balance",
        onPress: () => navigation.navigate("CustomerWalletScreen"),
      },
    ],
    [navigation]
  );

  const accountItems = useMemo(
    () => [
      {
        id: "profile",
        title: "View Profile",
        icon: "person-outline",
        keywords: "name avatar personal info",
        onPress: () => navigation.navigate("CustomerPersonalInfoScreen"),
      },
      {
        id: "notifications",
        title: "Notifications",
        icon: "notifications-outline",
        keywords: "alerts push settings",
        onPress: () => navigation.navigate("CustomerSettingsScreen"),
      },

      {
        id: "settings",
        title: "Settings",
        icon: "settings-outline",
        keywords: "preferences account",
        onPress: () => navigation.navigate("CustomerSettingsScreen"),
      },
      {
        id: "claims",
        title: "Claims",
        icon: "shield-outline",
        keywords: "issues report support",
        onPress: () => navigation.navigate("CustomerClaimsScreen"),
      },
      {
        id: "terms",
        title: "Terms of Service",
        icon: "document-text-outline",
        keywords: "legal documents",
        external: true,
        onPress: () => Linking.openURL("https://pikup-app.com/"),
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        icon: "lock-closed-outline",
        keywords: "privacy legal policy",
        external: true,
        onPress: () => Linking.openURL("https://pikup-app.com/"),
      },
      {
        id: "about",
        title: "About Pikup",
        icon: "information-circle-outline",
        keywords: "version app info",
        onPress: () => { },
      },
    ],
    [navigation]
  );

  const query = searchText.trim().toLowerCase();
  const filteredQuickActions = useMemo(() => {
    if (!query) {
      return quickActions;
    }

    return quickActions.filter((action) =>
      `${action.title} ${action.keywords}`.toLowerCase().includes(query)
    );
  }, [quickActions, query]);

  const filteredAccountItems = useMemo(() => {
    if (!query) {
      return accountItems;
    }

    return accountItems.filter((item) =>
      `${item.title} ${item.keywords}`.toLowerCase().includes(query)
    );
  }, [accountItems, query]);

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
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={item.icon} size={20} color={colors.primary} />
        <Text style={styles.menuItemTitle}>{item.title}</Text>
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
                <Text style={styles.statNumber}>{totalSpent}</Text>
                <Text style={styles.statLabel}>Spent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{ratingValue}</Text>
                <Text style={styles.statLabel}>Rating</Text>
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

        {filteredQuickActions.length > 0 ? (
          <View style={styles.quickActions}>
            {filteredQuickActions.map((action, index) => (
              <React.Fragment key={action.id}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={action.onPress}
                >
                  <Ionicons name={action.icon} size={32} color={colors.primary} />
                  <Text style={styles.actionText}>{action.title}</Text>
                </TouchableOpacity>
                {index < filteredQuickActions.length - 1 ? (
                  <View style={styles.actionDivider} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {filteredAccountItems.length > 0 ? (
          <View style={styles.menuSections}>
            {filteredAccountItems.map((item, index) =>
              renderMenuItem(item, index === filteredAccountItems.length - 1)
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
  },
  logoutButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
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
});
