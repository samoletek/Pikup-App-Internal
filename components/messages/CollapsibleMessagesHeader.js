// Collapsible Messages Header component: renders its UI and handles related interactions.
import React from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

export const MESSAGES_TOP_BAR_HEIGHT = 46;

export default function CollapsibleMessagesHeader({
  title,
  topInset = 0,
  showBack = false,
  onBack,
  scrollY,
  searchCollapseDistance = 56,
  titleCollapseDistance = 56,
  rightContent = null,
  sideSlotWidth = 36,
}) {
  const inlineTitleStart =
    searchCollapseDistance + titleCollapseDistance * 0.45;
  const inlineTitleEnd = searchCollapseDistance + titleCollapseDistance;
  const titleSideOffset = sideSlotWidth + spacing.base + spacing.sm;
  const inlineTitleOpacity = scrollY.interpolate({
    inputRange: [inlineTitleStart, inlineTitleEnd],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [searchCollapseDistance, inlineTitleEnd],
    outputRange: [0.06, 0.24],
    extrapolate: "clamp",
  });
  const headerDividerOpacity = scrollY.interpolate({
    inputRange: [searchCollapseDistance, inlineTitleEnd],
    outputRange: [0.18, 0.8],
    extrapolate: "clamp",
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { paddingTop: topInset, height: topInset + MESSAGES_TOP_BAR_HEIGHT },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.sideSlot, { width: sideSlotWidth }]}>
          {showBack ? (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.inlineTitleWrap,
            { opacity: inlineTitleOpacity, left: titleSideOffset, right: titleSideOffset },
          ]}
        >
          <Text numberOfLines={1} style={styles.inlineTitle}>
            {title}
          </Text>
        </Animated.View>

        <View style={[styles.sideSlot, { width: sideSlotWidth, alignItems: "flex-end" }]}>
          {rightContent || <View style={styles.iconButton} />}
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.bottomShadow, { opacity: headerShadowOpacity }]}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.bottomDivider, { opacity: headerDividerOpacity }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.primary,
    zIndex: 30,
  },
  topRow: {
    height: MESSAGES_TOP_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background.primary,
    zIndex: 3,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
  },
  sideSlot: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  inlineTitleWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -3,
    height: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 8,
  },
  bottomDivider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.strong,
  },
});
