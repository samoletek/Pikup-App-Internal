import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, colors, spacing, typography, shadows } from "../styles/theme";

const STANDARD_HEADER_BAR_HEIGHT = 46;

export default function ScreenHeader({
  title,
  onBack,
  topInset = 0,
  rightContent = null,
  showBack = true,
  sideSlotWidth = 36,
}) {
  return (
    <View
      style={[
        styles.container,
        { paddingTop: topInset, height: topInset + STANDARD_HEADER_BAR_HEIGHT },
      ]}
    >
      <View style={[styles.leftSlot, { width: sideSlotWidth }]}>
        {showBack ? (
          <TouchableOpacity
            style={styles.sideButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.sideButton} />
        )}
      </View>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={[styles.rightSlot, { width: sideSlotWidth }]}>
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
    backgroundColor: colors.background.primary,
    ...shadows.md,
  },
  sideButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    justifyContent: "center",
    alignItems: "center",
  },
  leftSlot: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  rightSlot: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginHorizontal: spacing.sm,
  },
});
