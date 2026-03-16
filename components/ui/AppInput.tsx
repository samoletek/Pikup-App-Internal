// App input component: provides consistent labeled text input with inline validation.
import React from "react";
import {
  TouchableOpacity,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";
import InlineError from "./InlineError";

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputWrapperStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
};

export default function AppInput({
  label,
  error,
  required = false,
  containerStyle,
  labelStyle,
  inputWrapperStyle,
  inputStyle,
  errorStyle,
  rightIcon,
  onRightIconPress,
  multiline = false,
  ...inputProps
}: Props) {
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrapper,
          error ? styles.inputWrapperError : null,
          inputWrapperStyle,
        ]}
      >
        <TextInput
          {...inputProps}
          multiline={multiline}
          placeholderTextColor={colors.text.tertiary}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            rightIcon ? styles.inputWithRightIcon : null,
            error ? styles.inputError : null,
            inputStyle,
          ]}
        />
        {rightIcon
          ? onRightIconPress
            ? (
              <TouchableOpacity style={styles.rightIcon} onPress={onRightIconPress}>
                {rightIcon}
              </TouchableOpacity>
            )
            : (
              <View style={styles.rightIcon}>{rightIcon}</View>
            )
          : null}
      </View>
      <InlineError message={error} style={errorStyle} />
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
  inputWrapper: {
    position: "relative",
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    minHeight: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.input,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: colors.error,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xxxl,
  },
  rightIcon: {
    position: "absolute",
    right: spacing.base,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
