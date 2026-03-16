// Inline error component: renders compact validation and field-level error text.
import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { colors, spacing, typography } from "../../styles/theme";

type Props = {
  message?: string | null;
  style?: StyleProp<TextStyle>;
};

export default function InlineError({ message, style }: Props) {
  if (!message) {
    return null;
  }

  return <Text style={[styles.error, style]}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: {
    marginTop: spacing.xs,
    color: colors.error,
    fontSize: typography.fontSize.sm,
    fontWeight: "500",
  },
});
