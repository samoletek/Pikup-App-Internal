import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { logger } from "../../../services/logger";

const EMPTY_PASSWORD_ERRORS = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  general: "",
};

function toTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitialPersonalInfo(currentUser) {
  return {
    firstName: "",
    lastName: "",
    email: currentUser?.email || "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  };
}

export default function usePersonalInfoScreenData({
  currentUser,
  isDriver,
  userId,
  getProfileImage,
  getUserProfile,
  updateUserProfile,
  deleteAccount,
  changePassword,
}) {
  const [identityVerified, setIdentityVerified] = useState(false);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [personalInfo, setPersonalInfo] = useState(() => getInitialPersonalInfo(currentUser));
  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareRideInfo: true,
    marketingEmails: false,
    dataCollection: true,
  });
  const [initialNameState, setInitialNameState] = useState({
    firstName: "",
    lastName: "",
  });
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
  const [passwordErrors, setPasswordErrors] = useState(EMPTY_PASSWORD_ERRORS);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!userId) {
        return;
      }

      try {
        await getProfileImage?.();
        const profile = await getUserProfile?.(userId);
        if (!profile) {
          return;
        }

        const loadedFirstName = toTitle(profile.firstName || profile.first_name || "");
        const loadedLastName = toTitle(profile.lastName || profile.last_name || "");

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
        logger.error("PersonalInfoScreenData", "Error loading profile data", error);
      }
    };

    void loadProfileData();
  }, [currentUser?.email, getProfileImage, getUserProfile, isDriver, userId]);

  const updateField = useCallback((key, value) => {
    setPersonalInfo((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSwitch = useCallback((key) => {
    setPrivacySettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updatePasswordField = useCallback((key, value) => {
    setPasswordData((prev) => ({ ...prev, [key]: value }));
    setPasswordErrors((prev) => ({
      ...prev,
      [key]: "",
      general: "",
    }));
  }, []);

  const togglePasswordVisibility = useCallback((key) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const validatePasswordForm = useCallback(() => {
    const errors = { ...EMPTY_PASSWORD_ERRORS };

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
  }, [passwordData.confirmPassword, passwordData.currentPassword, passwordData.newPassword]);

  const handleChangePassword = useCallback(async () => {
    if (changingPassword || !validatePasswordForm()) {
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
      setPasswordErrors(EMPTY_PASSWORD_ERRORS);
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
  }, [
    changePassword,
    changingPassword,
    passwordData.currentPassword,
    passwordData.newPassword,
    validatePasswordForm,
  ]);

  const handleDeleteAccount = useCallback(() => {
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
  }, [deleteAccount, deletingAccount]);

  const fieldsLocked = isDriver && identityVerified;
  const normalizedFirstName = toTitle(personalInfo.firstName);
  const normalizedLastName = toTitle(personalInfo.lastName);
  const hasNameChanges = (
    !fieldsLocked &&
    (normalizedFirstName !== initialNameState.firstName ||
      normalizedLastName !== initialNameState.lastName)
  );

  const handleSave = useCallback(async () => {
    if (saving || !hasNameChanges) {
      return;
    }

    try {
      setSaving(true);
      const firstName = toTitle(personalInfo.firstName);
      const lastName = toTitle(personalInfo.lastName);

      if (firstName.length < 2 || lastName.length < 2) {
        Alert.alert("Error", "Please enter your first and last name (minimum 2 characters).");
        return;
      }

      await updateUserProfile({ firstName, lastName });
      setPersonalInfo((prev) => ({ ...prev, firstName, lastName }));
      setInitialNameState({ firstName, lastName });
      await getUserProfile?.(userId);
      Alert.alert("Success", "Your personal information has been updated.");
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to update your profile.");
    } finally {
      setSaving(false);
    }
  }, [
    getUserProfile,
    hasNameChanges,
    personalInfo.firstName,
    personalInfo.lastName,
    saving,
    updateUserProfile,
    userId,
  ]);

  const handlePhoneVerified = useCallback(async () => {
    setPhoneVerifyVisible(false);

    if (!userId) {
      return;
    }

    const profile = await getUserProfile?.(userId);
    if (!profile) {
      return;
    }

    setPersonalInfo((prev) => ({
      ...prev,
      phone: profile.phone || profile.phoneNumber || prev.phone,
    }));
  }, [getUserProfile, userId]);

  const initials = useMemo(() => {
    return (
      `${personalInfo.firstName?.[0] || ""}${personalInfo.lastName?.[0] || ""}` || "U"
    ).toUpperCase();
  }, [personalInfo.firstName, personalInfo.lastName]);

  return {
    changingPassword,
    deletingAccount,
    fieldsLocked,
    handleChangePassword,
    handleDeleteAccount,
    handlePhoneVerified,
    handleSave,
    hasNameChanges,
    identityVerified,
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
  };
}
