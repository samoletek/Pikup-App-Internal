// App card component: provides a shared elevated container for grouped content blocks.
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { borderRadius, colors, shadows, spacing } from "../../styles/theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export default function AppCard({ children, style, padded = true }: Props) {
  return <View style={[styles.base, padded ? styles.padded : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    ...shadows.sm,
  },
  padded: {
    padding: spacing.base,
  },
});
