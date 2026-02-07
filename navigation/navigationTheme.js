import { DarkTheme } from "@react-navigation/native";
import { Platform } from "react-native";
import { colors } from "../styles/theme";

export const appNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background.primary,
    card: colors.background.secondary,
    text: colors.text.primary,
    border: colors.border.strong,
    notification: colors.secondary,
  },
};

export const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.background.primary },
  animation: Platform.OS === "ios" ? "default" : "fade_from_bottom",
};
