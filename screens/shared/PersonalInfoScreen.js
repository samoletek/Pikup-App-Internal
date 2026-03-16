import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuthActions,
  useAuthIdentity,
  useProfileActions,
} from "../../contexts/AuthContext";
import useProfilePhotoActions from "../../hooks/useProfilePhotoActions";
import ScreenHeader from "../../components/ScreenHeader";
import PhoneVerificationModal from "../../components/PhoneVerificationModal";
import styles from "./PersonalInfoScreen.styles";
import { colors, layout, spacing } from "../../styles/theme";
import ProfilePhotoSection from "./personalInfo/ProfilePhotoSection";
import BasicInfoSection from "./personalInfo/BasicInfoSection";
import AddressSection from "./personalInfo/AddressSection";
import PrivacySettingsSection from "./personalInfo/PrivacySettingsSection";
import PasswordSection from "./personalInfo/PasswordSection";
import DangerZoneSection from "./personalInfo/DangerZoneSection";
import usePersonalInfoScreenData from "./personalInfo/usePersonalInfoScreenData";

export default function PersonalInfoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, userType, profileImage } = useAuthIdentity();
  const { deleteAccount, changePassword, verifyAccountPassword } = useAuthActions();
  const {
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserProfile,
  } = useProfileActions();

  const userId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const isDriver = userType === "driver";

  const {
    changingPassword,
    deletingAccount,
    fieldsLocked,
    handleChangePassword,
    handleDeleteAccount,
    handlePhoneVerified,
    handleSave,
    hasNameChanges,
    initials,
    passwordData,
    passwordErrors,
    passwordVisibility,
    personalInfo,
    phoneVerifyVisible,
    privacySettings,
    saving,
    setPhoneVerifyVisible,
    togglePasswordVisibility,
    toggleSwitch,
    updateField,
    updatePasswordField,
  } = usePersonalInfoScreenData({
    currentUser,
    isDriver,
    userId,
    getProfileImage,
    getUserProfile,
    updateUserProfile,
    deleteAccount,
    changePassword,
  });

  const { handleProfilePhotoPress } = useProfilePhotoActions({
    uploadProfileImage,
    deleteProfileImage,
    refreshProfileImage: getProfileImage,
  });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Personal Information"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        rightContent={
          hasNameChanges ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.primary} />
              ) : (
                <Ionicons name="checkmark" size={24} color={colors.text.primary} />
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <ProfilePhotoSection
            styles={styles}
            profileImage={profileImage}
            initials={initials}
            onProfilePhotoPress={handleProfilePhotoPress}
          />

          <BasicInfoSection
            styles={styles}
            personalInfo={personalInfo}
            fieldsLocked={fieldsLocked}
            onChangeField={updateField}
            onOpenPhoneVerify={() => setPhoneVerifyVisible(true)}
          />

          <AddressSection
            styles={styles}
            personalInfo={personalInfo}
            onChangeField={updateField}
          />

          <PrivacySettingsSection
            styles={styles}
            privacySettings={privacySettings}
            onToggleSetting={toggleSwitch}
          />

          <PasswordSection
            styles={styles}
            passwordData={passwordData}
            passwordVisibility={passwordVisibility}
            passwordErrors={passwordErrors}
            changingPassword={changingPassword}
            onChangeField={updatePasswordField}
            onToggleVisibility={togglePasswordVisibility}
            onSubmit={handleChangePassword}
          />

          <DangerZoneSection
            styles={styles}
            deletingAccount={deletingAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        </View>
      </ScrollView>

      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={() => setPhoneVerifyVisible(false)}
        onVerified={handlePhoneVerified}
        userId={userId}
        userTable={isDriver ? "drivers" : "customers"}
        requirePassword
        verifyAccountPassword={verifyAccountPassword}
        flowType="phone_change"
        currentPhone={personalInfo.phone}
      />
    </View>
  );
}
