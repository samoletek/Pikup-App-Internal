import { useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

const PROFILE_PICKER_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

export default function useProfilePhotoActions({
  uploadProfileImage,
  deleteProfileImage,
  refreshProfileImage,
}) {
  const uploadSelectedPhoto = useCallback(
    async (imageUri) => {
      if (!imageUri || typeof uploadProfileImage !== "function") {
        Alert.alert("Error", "Profile image upload is unavailable.");
        return;
      }

      try {
        await uploadProfileImage(imageUri);
        if (typeof refreshProfileImage === "function") {
          await refreshProfileImage();
        }
        Alert.alert("Success", "Profile picture updated successfully.");
      } catch (_error) {
        Alert.alert("Error", "Failed to upload profile picture.");
      }
    },
    [refreshProfileImage, uploadProfileImage]
  );

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync(PROFILE_PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    await uploadSelectedPhoto(result.assets[0].uri);
  }, [uploadSelectedPhoto]);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library permission is required to choose photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(PROFILE_PICKER_OPTIONS);
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    await uploadSelectedPhoto(result.assets[0].uri);
  }, [uploadSelectedPhoto]);

  const removePhoto = useCallback(() => {
    Alert.alert("Remove Photo", "Are you sure you want to remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            if (typeof deleteProfileImage !== "function") {
              Alert.alert("Error", "Profile image removal is unavailable.");
              return;
            }

            await deleteProfileImage();
            Alert.alert("Success", "Profile picture removed.");
          } catch (_error) {
            Alert.alert("Error", "Failed to remove profile picture.");
          }
        },
      },
    ]);
  }, [deleteProfileImage]);

  const handleProfilePhotoPress = useCallback(() => {
    Alert.alert("Update Profile Picture", "Choose an option", [
      { text: "Cancel", style: "cancel" },
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Remove Photo", style: "destructive", onPress: removePhoto },
    ]);
  }, [pickImage, removePhoto, takePhoto]);

  return {
    handleProfilePhotoPress,
    pickImage,
    removePhoto,
    takePhoto,
  };
}
