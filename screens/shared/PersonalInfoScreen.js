import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import useProfilePhotoActions from "../../hooks/useProfilePhotoActions";
import AppSwitch from "../../components/AppSwitch";
import ScreenHeader from "../../components/ScreenHeader";
import PhoneVerificationModal from "../../components/PhoneVerificationModal";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const PASSWORD_FIELD_CONFIG = [
  {
    key: "currentPassword",
    label: "Current Password",
    placeholder: "Enter current password",
    textContentType: "password",
    returnKeyType: "next",
  },
  {
    key: "newPassword",
    label: "New Password",
    placeholder: "Enter new password",
    textContentType: "newPassword",
    returnKeyType: "next",
  },
  {
    key: "confirmPassword",
    label: "Repeat New Password",
    placeholder: "Repeat new password",
    textContentType: "newPassword",
    returnKeyType: "done",
  },
];

export default function PersonalInfoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentUser,
    userType,
    profileImage,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserProfile,
    deleteAccount,
    changePassword,
    verifyAccountPassword,
  } = useAuth();
  const userId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const isDriver = userType === "driver";

  const [identityVerified, setIdentityVerified] = useState(false);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    email: currentUser?.email || "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareRideInfo: true,
    marketingEmails: false,
    dataCollection: true,
  });
  const [saving, setSaving] = useState(false);
  const [initialNameState, setInitialNameState] = useState({
    firstName: "",
    lastName: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    general: "",
  });
  const { handleProfilePhotoPress } = useProfilePhotoActions({
    uploadProfileImage,
    deleteProfileImage,
    refreshProfileImage: getProfileImage,
  });

  const toTitle = (value) =>
    value.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        if (!userId) {
          return;
        }

        await getProfileImage();
        const profile = await getUserProfile(userId);
        if (!profile) {
          return;
        }

        const loadedFirstName = toTitle(
          (profile.firstName || profile.first_name || "").trim()
        );
        const loadedLastName = toTitle(
          (profile.lastName || profile.last_name || "").trim()
        );

        setPersonalInfo((prev) => ({
          ...prev,
          firstName: loadedFirstName,
          lastName: loadedLastName,
          email: profile.email || prev.email || currentUser?.email || "",
          phone: profile.phone || profile.phoneNumber || prev.phone,
          dateOfBirth: profile.date_of_birth || profile.dateOfBirth || prev.dateOfBirth,
        }));
        setInitialNameState({
          firstName: loadedFirstName,
          lastName: loadedLastName,
        });
        if (isDriver && profile.identity_verified) {
          setIdentityVerified(true);
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      }
    };

    loadProfileData();
  }, [userId, getProfileImage, getUserProfile, currentUser?.email, isDriver]);

  const updateField = (key, value) => {
    setPersonalInfo((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSwitch = (key) => {
    setPrivacySettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updatePasswordField = (key, value) => {
    setPasswordData((prev) => ({ ...prev, [key]: value }));
    setPasswordErrors((prev) => ({
      ...prev,
      [key]: "",
      general: "",
    }));
  };

  const togglePasswordVisibility = (key) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const validatePasswordForm = () => {
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      general: "",
    };

    if (!passwordData.currentPassword) {
      errors.currentPassword = "Enter your current password.";
    }

    if (!passwordData.newPassword) {
      errors.newPassword = "Enter a new password.";
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters.";
    } else if (passwordData.newPassword === passwordData.currentPassword) {
      errors.newPassword = "New password must be different from current password.";
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Repeat your new password.";
    } else if (passwordData.confirmPassword !== passwordData.newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setPasswordErrors(errors);
    return !errors.currentPassword && !errors.newPassword && !errors.confirmPassword;
  };

  const handleChangePassword = async () => {
    if (changingPassword) {
      return;
    }

    if (!validatePasswordForm()) {
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordErrors({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        general: "",
      });
      Alert.alert("Success", "Your password has been updated.");
    } catch (error) {
      const message = error?.message || "Failed to change password.";

      if (message.toLowerCase().includes("current password")) {
        setPasswordErrors((prev) => ({
          ...prev,
          currentPassword: "Current password is incorrect.",
          general: "",
        }));
      } else {
        setPasswordErrors((prev) => ({
          ...prev,
          general: message,
        }));
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. Delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deletingAccount) {
              return;
            }
            setDeletingAccount(true);
            try {
              await deleteAccount();
              Alert.alert("Account Deleted", "Your account has been deleted.");
            } catch (error) {
              Alert.alert(
                "Error",
                error?.message || "Failed to delete account. Please try again."
              );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      if (saving) {
        return;
      }
      if (!hasNameChanges) {
        return;
      }
      setSaving(true);
      const firstName = toTitle((personalInfo.firstName || "").trim());
      const lastName = toTitle((personalInfo.lastName || "").trim());
      if (firstName.length < 2 || lastName.length < 2) {
        Alert.alert("Error", "Please enter your first and last name (minimum 2 characters).");
        setSaving(false);
        return;
      }
      await updateUserProfile({ firstName, lastName });
      setPersonalInfo((prev) => ({ ...prev, firstName, lastName }));
      setInitialNameState({ firstName, lastName });
      await getUserProfile(userId);
      Alert.alert("Success", "Your personal information has been updated.");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (
    `${personalInfo.firstName?.[0] || ""}${personalInfo.lastName?.[0] || ""}` || "U"
  ).toUpperCase();

  const fieldsLocked = isDriver && identityVerified;
  const normalizedFirstName = toTitle((personalInfo.firstName || "").trim());
  const normalizedLastName = toTitle((personalInfo.lastName || "").trim());
  const hasNameChanges =
    !fieldsLocked &&
    (normalizedFirstName !== initialNameState.firstName ||
      normalizedLastName !== initialNameState.lastName);

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
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={colors.text.primary}
                />
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
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>PROFILE PHOTO</Text>
            <View style={[styles.card, styles.photoCard]}>
              <TouchableOpacity
                style={styles.profilePhotoContainer}
                onPress={handleProfilePhotoPress}
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profilePhotoImage} />
                ) : (
                  <Text style={styles.profilePhotoText}>{initials}</Text>
                )}
                <View style={styles.editIconOverlay}>
                  <Ionicons name="camera" size={15} color={colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to change photo</Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>BASIC INFORMATION</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  {fieldsLocked && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                      <Text style={styles.verifiedBadgeText}>Verified</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
                  value={personalInfo.firstName}
                  onChangeText={(value) => updateField("firstName", value)}
                  editable={!fieldsLocked}
                  placeholder="First Name"
                  placeholderTextColor={colors.text.placeholder}
                  textContentType="givenName"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {fieldsLocked && (
                  <Text style={styles.inputNote}>Verified by identity check</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  {fieldsLocked && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                      <Text style={styles.verifiedBadgeText}>Verified</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
                  value={personalInfo.lastName}
                  onChangeText={(value) => updateField("lastName", value)}
                  editable={!fieldsLocked}
                  placeholder="Last Name"
                  placeholderTextColor={colors.text.placeholder}
                  textContentType="familyName"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {fieldsLocked && (
                  <Text style={styles.inputNote}>Verified by identity check</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.textInput, styles.textInputDisabled]}
                  value={personalInfo.email}
                  editable={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoCapitalize="none"
                />
                <Text style={styles.inputNote}>Email cannot be changed</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TouchableOpacity
                  style={[styles.textInput, styles.phoneRow]}
                  onPress={() => setPhoneVerifyVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.phoneText,
                      !personalInfo.phone && { color: colors.text.placeholder },
                    ]}
                  >
                    {personalInfo.phone || "Add phone number"}
                  </Text>
                  <Ionicons name="create-outline" size={18} color={colors.text.muted} />
                </TouchableOpacity>
                <Text style={styles.inputNote}>
                  Changing phone requires re-verification
                </Text>
              </View>

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  {fieldsLocked && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                      <Text style={styles.verifiedBadgeText}>Verified</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, fieldsLocked && styles.textInputDisabled]}
                  value={personalInfo.dateOfBirth}
                  onChangeText={(value) => updateField("dateOfBirth", value)}
                  editable={!fieldsLocked}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.text.placeholder}
                />
                {fieldsLocked && (
                  <Text style={styles.inputNote}>Verified by identity check</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>ADDRESS</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Street Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.address}
                  onChangeText={(value) => updateField("address", value)}
                  placeholder="Street Address"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.city}
                  onChangeText={(value) => updateField("city", value)}
                  placeholder="City"
                  placeholderTextColor={colors.text.placeholder}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={[styles.rowInputs, styles.inputGroupLast]}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.textInput}
                    value={personalInfo.state}
                    onChangeText={(value) => updateField("state", value)}
                    placeholder="State"
                    placeholderTextColor={colors.text.placeholder}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>ZIP Code</Text>
                  <TextInput
                    style={styles.textInput}
                    value={personalInfo.zipCode}
                    onChangeText={(value) => updateField("zipCode", value)}
                    placeholder="ZIP"
                    placeholderTextColor={colors.text.placeholder}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>PRIVACY SETTINGS</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchTitle}>Share Location</Text>
                  <Text style={styles.switchDescription}>
                    Allow app to access your location while using the service
                  </Text>
                </View>
                <AppSwitch
                  onValueChange={() => toggleSwitch("shareLocation")}
                  value={privacySettings.shareLocation}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchTitle}>Share Ride Information</Text>
                  <Text style={styles.switchDescription}>
                    Allow sharing your trip status with friends and family
                  </Text>
                </View>
                <AppSwitch
                  onValueChange={() => toggleSwitch("shareRideInfo")}
                  value={privacySettings.shareRideInfo}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchTitle}>Marketing Emails</Text>
                  <Text style={styles.switchDescription}>
                    Receive promotional emails and offers
                  </Text>
                </View>
                <AppSwitch
                  onValueChange={() => toggleSwitch("marketingEmails")}
                  value={privacySettings.marketingEmails}
                />
              </View>

              <View style={[styles.switchRow, styles.switchRowLast]}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchTitle}>Data Collection</Text>
                  <Text style={styles.switchDescription}>
                    Allow collection of usage data to improve service quality
                  </Text>
                </View>
                <AppSwitch
                  onValueChange={() => toggleSwitch("dataCollection")}
                  value={privacySettings.dataCollection}
                />
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>
            <View style={styles.card}>
              {PASSWORD_FIELD_CONFIG.map((fieldConfig, index) => {
                const fieldKey = fieldConfig.key;
                const isLastField = index === PASSWORD_FIELD_CONFIG.length - 1;
                const isVisible = Boolean(passwordVisibility[fieldKey]);
                const errorMessage = passwordErrors[fieldKey];

                return (
                  <View
                    key={fieldKey}
                    style={[styles.inputGroup, isLastField && styles.inputGroupLast]}
                  >
                    <Text style={styles.inputLabel}>{fieldConfig.label}</Text>
                    <View style={styles.passwordInputRow}>
                      <TextInput
                        style={[styles.textInput, styles.passwordTextInput]}
                        value={passwordData[fieldKey]}
                        onChangeText={(value) => updatePasswordField(fieldKey, value)}
                        placeholder={fieldConfig.placeholder}
                        placeholderTextColor={colors.text.placeholder}
                        textContentType={fieldConfig.textContentType}
                        secureTextEntry={!isVisible}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType={fieldConfig.returnKeyType}
                      />
                      <TouchableOpacity
                        style={styles.passwordVisibilityButton}
                        onPress={() => togglePasswordVisibility(fieldKey)}
                        accessibilityRole="button"
                        accessibilityLabel={isVisible ? "Hide password" : "Show password"}
                      >
                        <Ionicons
                          name={isVisible ? "eye-off-outline" : "eye-outline"}
                          size={18}
                          color={colors.text.tertiary}
                        />
                      </TouchableOpacity>
                    </View>
                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                  </View>
                );
              })}

              {passwordErrors.general ? (
                <Text style={styles.errorText}>{passwordErrors.general}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.passwordActionButton,
                  changingPassword && styles.passwordActionButtonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                <Text style={styles.passwordActionButtonText}>
                  {changingPassword ? "Updating..." : "Update Password"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>DANGER ZONE</Text>
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={styles.dangerDescription}>
                Deleting your account is permanent and removes access to your profile data.
              </Text>
              <TouchableOpacity
                style={[styles.dangerButton, deletingAccount && styles.dangerButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={styles.dangerButtonText}>
                  {deletingAccount ? "Deleting..." : "Delete Account"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={() => setPhoneVerifyVisible(false)}
        onVerified={() => {
          setPhoneVerifyVisible(false);
          getUserProfile(userId).then((profile) => {
            if (profile) {
              setPersonalInfo((prev) => ({
                ...prev,
                phone: profile.phone || profile.phoneNumber || prev.phone,
              }));
            }
          });
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  sectionBlock: {
    marginBottom: spacing.base,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
    padding: spacing.base,
  },
  photoCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  profilePhotoContainer: {
    position: "relative",
    width: 104,
    height: 104,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  profilePhotoText: {
    fontSize: 34,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  profilePhotoImage: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.circle,
  },
  editIconOverlay: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  photoHint: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  inputGroup: {
    marginBottom: spacing.base,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    gap: spacing.xs,
  },
  verifiedBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  phoneText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  textInput: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  passwordInputRow: {
    position: "relative",
  },
  passwordTextInput: {
    paddingRight: spacing.xxl + spacing.sm,
  },
  passwordVisibilityButton: {
    position: "absolute",
    right: spacing.base - 2,
    top: "50%",
    marginTop: -10,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  textInputDisabled: {
    color: colors.text.muted,
    backgroundColor: colors.background.tertiary,
  },
  inputNote: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  switchRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
    paddingVertical: spacing.sm,
  },
  switchRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  switchInfo: {
    flex: 1,
    paddingRight: spacing.base,
  },
  switchTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginBottom: spacing.xs,
  },
  switchDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  passwordActionButton: {
    marginTop: spacing.base,
    minHeight: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.brandTint,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordActionButtonDisabled: {
    opacity: 0.6,
  },
  passwordActionButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionLabelDanger: {
    color: colors.error,
  },
  dangerCard: {
    borderColor: colors.error,
    backgroundColor: colors.background.secondary,
  },
  dangerDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.35,
  },
  dangerButton: {
    marginTop: spacing.base,
    minHeight: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonDisabled: {
    opacity: 0.6,
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
