// App skeleton component: renders a lightweight placeholder block while content loads.
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { borderRadius, colors } from "../../styles/theme";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function AppSkeleton({ width = "100%", height = 16, style }: Props) {
  return <View style={[styles.base, { width, height }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.elevated,
  },
});
