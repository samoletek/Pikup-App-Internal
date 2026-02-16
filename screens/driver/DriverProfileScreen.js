import React, { useEffect, useRef, useState } from "react";
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
import {
  borderRadius,
  colors,
  sizing,
  spacing,
  typography,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

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
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);

  useEffect(() => {
    loadDriverProfile();
  }, []);

  const loadDriverProfile = async () => {
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

      if (profile.canReceivePayments || profile.onboardingComplete) {
        loadDriverFeedback();
      }
    } catch (error) {
      console.error("Error loading driver profile:", error);
    }
  };

  const loadDriverFeedback = async () => {
    if (!currentUserId) {
      return;
    }

    setLoadingFeedback(true);
    try {
      const feedback = await getDriverFeedback(currentUserId, 5);
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
                  body: { role: "driver" },
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

  const menuItems = [
    {
      id: "notifications",
      title: "Notifications",
      icon: "notifications-outline",
      onPress: () => navigation.navigate("CustomerSettingsScreen"),
      disabled: false,
    },
    {
      id: "driverPreferences",
      title: "Driver Preferences",
      icon: "options-outline",
      onPress: () => navigation.navigate("DriverPreferencesScreen"),
      disabled: false,
    },
    {
      id: "about",
      title: "About",
      icon: "information-circle-outline",
      onPress: () => navigation.navigate("AboutScreen"),
      disabled: false,
    },
    {
      id: "downloadData",
      title: "Download My Data",
      icon: "download-outline",
      onPress: handleDownloadMyData,
      disabled: downloadingData,
      loading: downloadingData,
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
      {item.loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={item.external ? "open-outline" : "chevron-forward"}
          size={20}
          color={colors.text.tertiary}
        />
      )}
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
            style={styles.quickActionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Help</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate("DriverPaymentSettingsScreen")}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="card-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, !isReadyToEarn && styles.quickActionButtonDisabled]}
            onPress={isReadyToEarn ? handleEarnings : handleResumeOnboarding}
            disabled={!isReadyToEarn}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name="wallet-outline"
                size={24}
                color={!isReadyToEarn ? colors.text.muted : colors.primary}
              />
            </View>
            <Text style={[styles.quickActionLabel, !isReadyToEarn && styles.quickActionLabelDisabled]}>
              Earnings
            </Text>
          </TouchableOpacity>
        </View>

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
    width: sizing.avatarLg,
    height: sizing.avatarLg,
    borderRadius: borderRadius.xl,
  },
  avatarGradient: {
    width: sizing.avatarLg,
    height: sizing.avatarLg,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: colors.white,
    fontSize: sizing.avatarInitialsFontSize,
    fontWeight: typography.fontWeight.bold,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -sizing.verificationBadgeOffset,
    right: -sizing.verificationBadgeOffset,
    width: sizing.verificationBadgeSize,
    height: sizing.verificationBadgeSize,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: sizing.verificationBadgeBorderWidth,
    borderColor: colors.background.secondary,
  },
  verifiedBadgePending: {
    backgroundColor: colors.warning,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: sizing.profileNameFontSize,
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
  verifiedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.xs,
  },
  verifiedTextPending: {
    color: colors.warning,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: sizing.compactGap,
    paddingHorizontal: spacing.md,
    paddingVertical: sizing.compactButtonVerticalPadding,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  editProfileText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
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
    fontSize: sizing.statLabelFontSize,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.muted,
    marginTop: sizing.statLabelMarginTop,
    letterSpacing: sizing.statLabelLetterSpacing,
  },
  statDividerVertical: {
    width: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.sm,
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
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionIcon: {
    position: "relative",
  },
  quickActionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  quickActionLabelDisabled: {
    color: colors.text.muted,
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
