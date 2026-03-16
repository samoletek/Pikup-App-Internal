// App Button component: renders its UI and handles related interactions.
import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export default function AppButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
  labelStyle,
  leftIcon,
  rightIcon,
}: Props) {
  const isDisabled = disabled || loading;
  const variantStyle =
    variant === "secondary"
      ? styles.secondary
      : variant === "danger"
        ? styles.danger
      : variant === "ghost"
        ? styles.ghost
        : styles.primary;

  const variantTextStyle =
    variant === "secondary"
      ? styles.secondaryText
      : variant === "danger"
        ? styles.dangerText
        : variant === "ghost"
          ? styles.ghostText
          : styles.primaryText;
  const indicatorColor =
    variant === "secondary"
      ? colors.text.primary
      : variant === "ghost"
        ? colors.primary
        : colors.white;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, variantStyle, isDisabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text style={[styles.text, variantTextStyle, labelStyle]}>{title}</Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.background.panel,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  danger: {
    backgroundColor: colors.error,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: typography.fontSize.md,
    fontWeight: "600",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  primaryText: {
    color: colors.white,
  },
  secondaryText: {
    color: colors.text.primary,
  },
  dangerText: {
    color: colors.white,
  },
  ghostText: {
    color: colors.primary,
  },
});
