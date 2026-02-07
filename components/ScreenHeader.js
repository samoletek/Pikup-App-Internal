import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, shadows } from "../styles/theme";

export default function ScreenHeader({
  title,
  onBack,
  topInset = 0,
  rightContent = null,
  showBack = true,
}) {
  return (
    <View style={[styles.container, { paddingTop: topInset + spacing.sm }]}>
      {showBack ? (
        <TouchableOpacity
          style={styles.sideButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.sideButton} />
      )}

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={styles.rightSlot}>
        {rightContent || <View style={styles.sideButton} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    ...shadows.md,
  },
  sideButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  rightSlot: {
    width: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginHorizontal: spacing.sm,
  },
});
