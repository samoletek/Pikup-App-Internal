// App Switch component: renders its UI and handles related interactions.
import React from "react";
import { Platform, StyleSheet, Switch, View } from "react-native";
import { colors } from "../styles/theme";

export default function AppSwitch({
  value,
  onValueChange,
  disabled = false,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <Switch
        value={Boolean(value)}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border.strong,
          true: colors.primary,
        }}
        ios_backgroundColor={colors.border.strong}
        thumbColor={Platform.OS === "android" ? colors.white : undefined}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 32,
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  switch: {
    alignSelf: "center",
  },
});
