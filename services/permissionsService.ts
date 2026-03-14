import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { showConfirmAlert } from "./errorService";

const openSettingsPrompt = (title: string, message: string) => {
  showConfirmAlert(title, message, () => {
    Linking.openSettings();
  }, "Open Settings");
};

export const ensureCameraPermission = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === "granted") return true;

  openSettingsPrompt(
    "Camera Permission",
    "Camera access is required for this action."
  );
  return false;
};

export const ensureMediaLibraryPermission = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === "granted") return true;

  openSettingsPrompt(
    "Photo Library Permission",
    "Photo library access is required for this action."
  );
  return false;
};

export const ensureForegroundLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === "granted") return true;

  openSettingsPrompt(
    "Location Permission",
    "Location access is required for this action."
  );
  return false;
};

export const ensureBackgroundLocationPermission = async () => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status === "granted") return true;

  openSettingsPrompt(
    "Background Location Permission",
    "Background location access is required for this action."
  );
  return false;
};
