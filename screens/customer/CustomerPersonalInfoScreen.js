import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

export default function CustomerPersonalInfoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    currentUser,
    profileImage,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserProfile,
    deleteAccount,
    changePassword,
  } = useAuth();
  const userId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const [personalInfo, setPersonalInfo] = useState({
    firstName: "",
    lastName: "",
    email: currentUser?.email || "user@example.com",
    phone: "+1 (555) 123-4567",
    dateOfBirth: "01/15/1990",
    address: "123 Main Street, Apt 4B",
    city: "New York",
    state: "NY",
    zipCode: "10001",
  });
  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareRideInfo: true,
    marketingEmails: false,
    dataCollection: true,
  });
  const [saving, setSaving] = useState(false);
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
        setPersonalInfo((prev) => ({
          ...prev,
          firstName: profile.firstName || prev.firstName || "",
          lastName: profile.lastName || prev.lastName || "",
          email: profile.email || prev.email || currentUser?.email || "",
        }));
      } catch (error) {
        console.error("Error loading profile data:", error);
      }
    };

    loadProfileData();
  }, [userId, getProfileImage, getUserProfile, currentUser?.email]);

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
      setSaving(true);
      const firstName = toTitle((personalInfo.firstName || "").trim());
      const lastName = toTitle((personalInfo.lastName || "").trim());
      if (firstName.length < 2 || lastName.length < 2) {
        Alert.alert("Error", "Please enter your first and last name (minimum 2 characters).");
        setSaving(false);
        return;
      }
      const name = `${firstName} ${lastName}`;
      await updateUserProfile({ firstName, lastName, name });
      setPersonalInfo((prev) => ({ ...prev, firstName, lastName }));
      await getUserProfile(userId);
      Alert.alert("Success", "Your personal information has been updated.");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update your profile.");
    } finally {
      setSaving(false);
    }
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
      await uploadProfileImage(result.assets[0].uri);
      Alert.alert("Success", "Profile picture updated successfully.");
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
      await uploadProfileImage(result.assets[0].uri);
      Alert.alert("Success", "Profile picture updated successfully.");
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
              await deleteProfileImage();
              Alert.alert("Success", "Profile picture removed.");
            } catch (error) {
              Alert.alert("Error", "Failed to remove profile picture.");
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

  const initials = (
    `${personalInfo.firstName?.[0] || ""}${personalInfo.lastName?.[0] || ""}` || "U"
  ).toUpperCase();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Personal Information"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        rightContent={(
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
        )}
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
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.firstName}
                  onChangeText={(value) => updateField("firstName", value)}
                  placeholder="First Name"
                  placeholderTextColor={colors.text.placeholder}
                  textContentType="givenName"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.lastName}
                  onChangeText={(value) => updateField("lastName", value)}
                  placeholder="Last Name"
                  placeholderTextColor={colors.text.placeholder}
                  textContentType="familyName"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
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
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.phone}
                  onChangeText={(value) => updateField("phone", value)}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor={colors.text.placeholder}
                  returnKeyType="next"
                />
              </View>

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.textInput}
                  value={personalInfo.dateOfBirth}
                  onChangeText={(value) => updateField("dateOfBirth", value)}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.text.placeholder}
                />
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
                <Switch
                  trackColor={{ false: colors.border.strong, true: colors.background.brandTint }}
                  thumbColor={privacySettings.shareLocation ? colors.primary : colors.white}
                  ios_backgroundColor={colors.border.strong}
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
                <Switch
                  trackColor={{ false: colors.border.strong, true: colors.background.brandTint }}
                  thumbColor={privacySettings.shareRideInfo ? colors.primary : colors.white}
                  ios_backgroundColor={colors.border.strong}
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
                <Switch
                  trackColor={{ false: colors.border.strong, true: colors.background.brandTint }}
                  thumbColor={privacySettings.marketingEmails ? colors.primary : colors.white}
                  ios_backgroundColor={colors.border.strong}
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
                <Switch
                  trackColor={{ false: colors.border.strong, true: colors.background.brandTint }}
                  thumbColor={privacySettings.dataCollection ? colors.primary : colors.white}
                  ios_backgroundColor={colors.border.strong}
                  onValueChange={() => toggleSwitch("dataCollection")}
                  value={privacySettings.dataCollection}
                />
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordInputRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordTextInput]}
                    value={passwordData.currentPassword}
                    onChangeText={(value) => updatePasswordField("currentPassword", value)}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.text.placeholder}
                    textContentType="password"
                    secureTextEntry={!passwordVisibility.currentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    style={styles.passwordVisibilityButton}
                    onPress={() => togglePasswordVisibility("currentPassword")}
                    accessibilityRole="button"
                    accessibilityLabel={
                      passwordVisibility.currentPassword ? "Hide password" : "Show password"
                    }
                  >
                    <Ionicons
                      name={passwordVisibility.currentPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.currentPassword ? (
                  <Text style={styles.errorText}>{passwordErrors.currentPassword}</Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordTextInput]}
                    value={passwordData.newPassword}
                    onChangeText={(value) => updatePasswordField("newPassword", value)}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.text.placeholder}
                    textContentType="newPassword"
                    secureTextEntry={!passwordVisibility.newPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    style={styles.passwordVisibilityButton}
                    onPress={() => togglePasswordVisibility("newPassword")}
                    accessibilityRole="button"
                    accessibilityLabel={
                      passwordVisibility.newPassword ? "Hide password" : "Show password"
                    }
                  >
                    <Ionicons
                      name={passwordVisibility.newPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.newPassword ? (
                  <Text style={styles.errorText}>{passwordErrors.newPassword}</Text>
                ) : null}
              </View>

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <Text style={styles.inputLabel}>Repeat New Password</Text>
                <View style={styles.passwordInputRow}>
                  <TextInput
                    style={[styles.textInput, styles.passwordTextInput]}
                    value={passwordData.confirmPassword}
                    onChangeText={(value) => updatePasswordField("confirmPassword", value)}
                    placeholder="Repeat new password"
                    placeholderTextColor={colors.text.placeholder}
                    textContentType="newPassword"
                    secureTextEntry={!passwordVisibility.confirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.passwordVisibilityButton}
                    onPress={() => togglePasswordVisibility("confirmPassword")}
                    accessibilityRole="button"
                    accessibilityLabel={
                      passwordVisibility.confirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    <Ionicons
                      name={passwordVisibility.confirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.confirmPassword ? (
                  <Text style={styles.errorText}>{passwordErrors.confirmPassword}</Text>
                ) : null}
              </View>

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
    width: 40,
    height: 40,
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
  inputLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.sm,
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
    marginBottom: 2,
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
    lineHeight: 20,
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
