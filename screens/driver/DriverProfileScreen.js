import React from "react";
import {
  Alert,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuthActions,
  useAuthIdentity,
  useDriverActions,
  useProfileActions,
} from "../../contexts/AuthContext";
import useProfilePhotoActions from "../../hooks/useProfilePhotoActions";
import useDriverProfileData from "../../hooks/useDriverProfileData";
import useCollapsibleTitleSnap from "../../hooks/useCollapsibleTitleSnap";
import useDriverProfilePresentation from "./useDriverProfilePresentation";
import DriverProfileSummaryCard from "../../components/driver/DriverProfileSummaryCard";
import DriverStatusCard from "../../components/driver/DriverStatusCard";
import DriverAccountMenuSection from "../../components/driver/DriverAccountMenuSection";
import CollapsibleMessagesHeader, {
  MESSAGES_TOP_BAR_HEIGHT,
} from "../../components/messages/CollapsibleMessagesHeader";
import styles from "./DriverProfileScreen.styles";
import {
  spacing,
} from "../../styles/theme";

const HEADER_ROW_HEIGHT = 56;
const TITLE_COLLAPSE_DISTANCE = HEADER_ROW_HEIGHT;

export default function DriverProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser, profileImage } = useAuthIdentity();
  const { logout } = useAuthActions();
  const { getDriverProfile, getDriverStats } = useDriverActions();
  const { getUserProfile, getProfileImage, uploadProfileImage, deleteProfileImage } = useProfileActions();
  const currentUserId = currentUser?.uid || currentUser?.id;

  const {
    scrollRef,
    scrollY,
    handleScrollEndDrag,
    handleMomentumScrollEnd,
  } = useCollapsibleTitleSnap({
    collapseDistance: TITLE_COLLAPSE_DISTANCE,
  });

  const {
    driverProfile,
    displayName,
    onboardingStatus,
    driverStats,
  } = useDriverProfileData({
    currentUser,
    currentUserId,
    getDriverProfile,
    getDriverStats,
    getUserProfile,
    getProfileImage,
  });

  const { handleProfilePhotoPress } = useProfilePhotoActions({
    uploadProfileImage,
    deleteProfileImage,
    refreshProfileImage: getProfileImage,
  });

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

  const {
    acceptanceRate,
    completedTrips,
    driverBadges,
    initials,
    isReadyToEarn,
    menuItems,
    ratingValue,
    statusConfig,
  } = useDriverProfilePresentation({
    displayName,
    driverProfile,
    driverStats,
    onboardingStatus,
    onStartOnboarding: handleStartOnboarding,
    onResumeOnboarding: handleResumeOnboarding,
    navigation,
  });

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

        <DriverProfileSummaryCard
          profileImage={profileImage}
          initials={initials}
          isReadyToEarn={isReadyToEarn}
          displayName={displayName}
          onEditProfile={() => navigation.navigate("PersonalInfoScreen")}
          onProfilePhotoPress={handleProfilePhotoPress}
          completedTrips={completedTrips}
          acceptanceRate={acceptanceRate}
          ratingValue={ratingValue}
          driverBadges={driverBadges}
          ui={styles}
        />

        <DriverStatusCard statusConfig={statusConfig} ui={styles} />

        <DriverAccountMenuSection menuItems={menuItems} ui={styles} />

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>
    </View>
  );
}
