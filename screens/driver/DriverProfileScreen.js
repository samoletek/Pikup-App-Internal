import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import useProfilePhotoActions from "../../hooks/useProfilePhotoActions";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import styles from "./DriverProfileScreen.styles";
import { DRIVER_RATING_BADGES } from "../../constants/ratingBadges";
import {
  colors,
  spacing,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function DriverProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currentUser,
    logout,
    getDriverProfile,
    getDriverStats,
    getUserProfile,
    profileImage,
    getProfileImage,
    uploadProfileImage,
    deleteProfileImage,
  } = useAuth();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isSnappingRef = useRef(false);

  const [driverProfile, setDriverProfile] = useState(null);
  const [displayName, setDisplayName] = useState("Driver");
  const [onboardingStatus, setOnboardingStatus] = useState({
    connectAccountCreated: false,
    onboardingComplete: false,
    documentsVerified: false,
    canReceivePayments: false,
  });
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    acceptanceRate: 0,
  });
  const { handleProfilePhotoPress } = useProfilePhotoActions({
    uploadProfileImage,
    deleteProfileImage,
    refreshProfileImage: getProfileImage,
  });

  const loadDriverStats = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      const stats = await getDriverStats?.(currentUserId);
      const parsedTotalTrips = Number(stats?.totalTrips);
      const parsedAcceptanceRate = Number(stats?.acceptanceRate);

      setDriverStats({
        totalTrips:
          Number.isFinite(parsedTotalTrips) && parsedTotalTrips > 0
            ? parsedTotalTrips
            : 0,
        acceptanceRate:
          Number.isFinite(parsedAcceptanceRate) && parsedAcceptanceRate > 0
            ? Math.round(parsedAcceptanceRate)
            : 0,
      });
    } catch (error) {
      console.error("Error loading driver stats:", error);
      setDriverStats({
        totalTrips: 0,
        acceptanceRate: 0,
      });
    }
  }, [currentUserId, getDriverStats]);

  const loadDriverProfile = useCallback(async () => {
    try {
      const profile = await getDriverProfile?.(currentUserId);
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

      await loadDriverStats();
    } catch (error) {
      console.error("Error loading driver profile:", error);
    }
  }, [
    currentUser?.email,
    currentUserId,
    getDriverProfile,
    getProfileImage,
    getUserProfile,
    loadDriverStats,
  ]);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    const channel = supabase
      .channel(`driver:profile:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `id=eq.${currentUserId}`,
        },
        (payload) => {
          const nextProfile = payload?.new;
          if (!nextProfile) return;

          const metadata =
            nextProfile?.metadata &&
            typeof nextProfile.metadata === "object" &&
            !Array.isArray(nextProfile.metadata)
              ? nextProfile.metadata
              : {};

          setDriverProfile((prev) => ({
            ...(prev || {}),
            ...nextProfile,
            metadata,
            rating_count: Number.isFinite(Number(nextProfile?.rating_count))
              ? Number(nextProfile.rating_count)
              : Number(prev?.rating_count || 0),
          }));

          setOnboardingStatus({
            connectAccountCreated: !!(
              nextProfile?.stripe_account_id || metadata?.connectAccountId
            ),
            onboardingComplete: Boolean(
              nextProfile?.onboarding_complete ??
              metadata?.onboardingComplete ??
              false
            ),
            documentsVerified: Boolean(metadata?.documentsVerified ?? false),
            canReceivePayments: Boolean(
              nextProfile?.can_receive_payments ??
              metadata?.canReceivePayments ??
              false
            ),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isReadyToEarn = onboardingStatus.canReceivePayments;
  const completedTrips = String(Number(driverStats.totalTrips) || 0);
  const acceptanceRate = `${Number(driverStats.acceptanceRate) || 0}%`;
  const ratingCount = Number(
    driverProfile?.rating_count ?? driverProfile?.driverProfile?.rating_count ?? 0
  );
  const parsedRating = Number(
    driverProfile?.rating ?? driverProfile?.driverProfile?.rating ?? 0
  );
  const ratingValue =
    ratingCount > 0 && Number.isFinite(parsedRating)
      ? parsedRating.toFixed(1)
      : "0";
  const driverBadges = useMemo(() => {
    const badgeStats = driverProfile?.badge_stats || {};
    return DRIVER_RATING_BADGES.map((badge) => ({
      ...badge,
      count: Number(badgeStats?.[badge.id] || 0),
    }));
  }, [driverProfile]);
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

  const menuItems = [
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline",
      onPress: () => navigation.navigate("CustomerSettingsScreen"),
      disabled: false,
    },
    {
      id: "help",
      title: "Help",
      icon: "help-circle-outline",
      onPress: () => navigation.navigate("CustomerHelpScreen"),
      disabled: false,
    },
    {
      id: "about",
      title: "About",
      icon: "information-circle-outline",
      onPress: () => navigation.navigate("AboutScreen"),
      disabled: false,
    },
  ];

  const getSnapOffset = (offsetY) => {
    if (offsetY < 0 || offsetY > TITLE_COLLAPSE_DISTANCE) {
      return null;
    }
    return offsetY < TITLE_COLLAPSE_DISTANCE / 2 ? 0 : TITLE_COLLAPSE_DISTANCE;
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
        searchCollapseDistance={0}
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
        <View style={styles.largeTitleSection}>
          <Text style={styles.largeTitle}>Account</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleProfilePhotoPress}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
              <View
                style={[
                  styles.verifiedBadge,
                  !isReadyToEarn && styles.verifiedBadgePending,
                ]}
              >
                <Ionicons name="checkmark" size={10} color={colors.white} />
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons
                  name={isReadyToEarn ? "checkmark-circle" : "time"}
                  size={14}
                  color={isReadyToEarn ? colors.success : colors.warning}
                />
                <Text
                  style={[
                    styles.verifiedText,
                    !isReadyToEarn && styles.verifiedTextPending,
                  ]}
                >
                  {isReadyToEarn ? "Verified Driver" : "Pending Verification"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => navigation.navigate("PersonalInfoScreen")}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={styles.editProfileText}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{completedTrips}</Text>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={styles.statDividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{acceptanceRate}</Text>
              <Text style={styles.statLabel}>ACCEPTANCE</Text>
            </View>
            <View style={styles.statDividerVertical} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{ratingValue}</Text>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
          </View>

          <View style={styles.badgesBar}>
            {driverBadges.map((badge, index) => (
              <React.Fragment key={badge.id}>
                {index > 0 ? <View style={styles.badgeDividerVertical} /> : null}
                <View style={styles.badgeItem}>
                  <View style={styles.badgeInfo}>
                    <Ionicons name={badge.icon} size={14} color={badge.activeColor} />
                    <Text style={styles.badgeLabel}>{badge.label}</Text>
                  </View>
                  <View style={styles.badgeChipCount}>
                    <Text style={styles.badgeChipCountText}>{badge.count}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
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

        <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>
        <View style={styles.menuSections}>
          {menuItems.map((item, index) =>
            renderMenuItem(item, index === menuItems.length - 1)
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>
    </View>
  );
}
