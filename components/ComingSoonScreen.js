import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "./ScreenHeader";
import {
  colors,
  spacing,
  typography,
} from "../styles/theme";

export default function ComingSoonScreen({
  navigation,
  title,
  topInset = 0,
  iconName = "construct-outline",
  message = "This feature is under development",
  onBack,
}) {
  return (
    <View style={styles.container}>
      <ScreenHeader
        title={title}
        onBack={onBack || (() => navigation.goBack())}
        topInset={topInset}
        showBack
      />

      <View style={styles.content}>
        <Ionicons name={iconName} size={64} color={colors.primary} />
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    textAlign: "center",
  },
});
