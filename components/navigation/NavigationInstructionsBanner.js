// Navigation Instructions Banner component: renders its UI and handles related interactions.
import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../styles/theme";

const NavigationInstructionsBanner = ({
  nextInstruction,
  isNavigating,
  maneuverIcon,
  distanceToTurn,
  topPadding = 0,
  ui,
}) => {
  if (!nextInstruction || isNavigating) return null;
  const styles = ui || {};

  return (
    <View style={styles.navigationContainer}>
      <View style={[styles.navigationHeader, { paddingTop: topPadding }]}>
        <View style={styles.navigationHeaderContent}>
          <Text style={styles.distanceText}>
            {distanceToTurn || "Calculating..."}
          </Text>
          <Text style={styles.instructionText} numberOfLines={2}>
            {nextInstruction}
          </Text>
          <View style={styles.directionArrows}>
            <Ionicons name="arrow-up" size={20} color={colors.white} />
            <Ionicons name="arrow-up" size={20} color={colors.white} />
            <Ionicons name="arrow-up" size={20} color={colors.white} />
            <Ionicons
              name={maneuverIcon}
              size={20}
              color={colors.white}
              style={{ marginLeft: spacing.xs + 1 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default NavigationInstructionsBanner;
