// App form field wrapper: composes shared label, hint, and error rendering for arbitrary inputs.
import React, { ReactNode } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, spacing, typography } from "../../styles/theme";
import InlineError from "./InlineError";

type Props = {
  children: ReactNode;
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  hintStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
};

export default function AppFormField({
  children,
  label,
  required = false,
  error,
  hint,
  containerStyle,
  labelStyle,
  hintStyle,
  errorStyle,
}: Props) {
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      {children}
      <InlineError message={error} style={errorStyle} />
      {!error && hint ? <Text style={[styles.hint, hintStyle]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: "600",
  },
  hint: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});
