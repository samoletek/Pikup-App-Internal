// App list-empty component: renders a reusable empty-state block for list views.
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../styles/theme";

type Props = {
  title: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export default function AppListEmpty({
  title,
  subtitle,
  iconName = "document-text-outline",
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name={iconName} size={48} color={colors.text.subtle} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    marginTop: spacing.base,
    marginBottom: spacing.sm,
    textAlign: "center",
    color: colors.text.subtle,
    fontSize: typography.fontSize.md,
    fontWeight: "600",
  },
  subtitle: {
    textAlign: "center",
    color: colors.text.subtle,
    fontSize: typography.fontSize.base,
  },
});
