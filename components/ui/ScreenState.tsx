// Screen State component: renders its UI and handles related interactions.
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../styles/theme";

type Props = {
  title: string;
  subtitle?: string;
  loading?: boolean;
};

export default function ScreenState({ title, subtitle, loading = false }: Props) {
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: {
    marginTop: spacing.base,
    textAlign: "center",
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
});
