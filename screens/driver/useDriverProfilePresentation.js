import { useMemo } from "react";
import { DRIVER_RATING_BADGES } from "../../constants/ratingBadges";
import { colors } from "../../styles/theme";

function getDisplayInitials(displayName) {
  return String(displayName || "")
    .split(" ")
    .filter(Boolean)
    .map((namePart) => namePart[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function getDriverStatusConfig({
  isReadyToEarn,
  onboardingStatus,
  onStartOnboarding,
  onResumeOnboarding,
}) {
  if (isReadyToEarn) {
    return {
      title: "Ready to Earn",
      subtitle: "Your account is fully set up",
      icon: "checkmark-circle",
      iconColor: colors.success,
      backgroundColor: colors.background.successSubtle,
      borderColor: colors.success,
      ctaLabel: null,
      onPress: null,
    };
  }

  if (onboardingStatus.connectAccountCreated) {
    return {
      title: "Complete Your Setup",
      subtitle: onboardingStatus.onboardingComplete
        ? "Documents pending review"
        : "Finish verification to start earning",
      icon: "time",
      iconColor: colors.primary,
      backgroundColor: colors.background.elevated,
      borderColor: colors.primary,
      ctaLabel: "Continue",
      onPress: onResumeOnboarding,
    };
  }

  return {
    title: "Setup Required",
    subtitle: "Complete onboarding to start earning",
    icon: "alert-circle",
    iconColor: colors.warning,
    backgroundColor: colors.background.warningSubtle,
    borderColor: colors.warning,
    ctaLabel: "Start",
    onPress: onStartOnboarding,
  };
}

function getMenuItems(navigation) {
  return [
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
}

export default function useDriverProfilePresentation({
  displayName,
  driverProfile,
  driverStats,
  onboardingStatus,
  onStartOnboarding,
  onResumeOnboarding,
  navigation,
}) {
  const initials = useMemo(() => getDisplayInitials(displayName), [displayName]);

  const isReadyToEarn = onboardingStatus.canReceivePayments;
  const completedTrips = String(Number(driverStats.totalTrips) || 0);
  const acceptanceRate = `${Number(driverStats.acceptanceRate) || 0}%`;

  const ratingCount = Number(
    driverProfile?.rating_count ?? driverProfile?.driverProfile?.rating_count ?? 0
  );
  const parsedRating = Number(
    driverProfile?.rating ?? driverProfile?.driverProfile?.rating ?? 0
  );
  const ratingValue = (
    ratingCount > 0 && Number.isFinite(parsedRating)
      ? parsedRating.toFixed(1)
      : "0"
  );

  const driverBadges = useMemo(() => {
    const badgeStats = driverProfile?.badge_stats || {};
    return DRIVER_RATING_BADGES.map((badge) => ({
      ...badge,
      count: Number(badgeStats?.[badge.id] || 0),
    }));
  }, [driverProfile]);

  const statusConfig = useMemo(() => {
    return getDriverStatusConfig({
      isReadyToEarn,
      onboardingStatus,
      onStartOnboarding,
      onResumeOnboarding,
    });
  }, [isReadyToEarn, onboardingStatus, onResumeOnboarding, onStartOnboarding]);

  const menuItems = useMemo(() => getMenuItems(navigation), [navigation]);

  return {
    acceptanceRate,
    completedTrips,
    driverBadges,
    initials,
    isReadyToEarn,
    menuItems,
    ratingValue,
    statusConfig,
  };
}
