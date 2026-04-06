// Navigation Instructions Banner component: renders its UI and handles related interactions.
import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;

const parseDistanceMeters = (rawDistance) => {
  if (typeof rawDistance === "number" && Number.isFinite(rawDistance)) {
    return rawDistance;
  }

  if (typeof rawDistance !== "string") {
    return null;
  }

  const normalized = rawDistance.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const parsed = normalized.match(/([\d.]+)\s*(km|m|mi|ft)/);
  if (!parsed) {
    return null;
  }

  const value = Number(parsed[1]);
  const unit = parsed[2];

  if (!Number.isFinite(value)) {
    return null;
  }

  if (unit === "km") {
    return value * 1000;
  }
  if (unit === "m") {
    return value;
  }
  if (unit === "mi") {
    return value * METERS_PER_MILE;
  }
  if (unit === "ft") {
    return value / FEET_PER_METER;
  }

  return null;
};

const formatDistanceImperial = (rawDistance) => {
  const meters = parseDistanceMeters(rawDistance);
  if (!Number.isFinite(meters) || meters < 0) {
    return "Calculating...";
  }

  const feet = meters * FEET_PER_METER;
  if (feet < 1600) {
    return `${Math.max(0, Math.round(feet))} ft`;
  }

  const miles = feet / FEET_PER_MILE;
  if (miles < 1) {
    return `${miles.toFixed(2)} mi`;
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
};

const extractStreetFromInstruction = (instruction = "") => {
  if (typeof instruction !== "string") {
    return "";
  }

  const compact = instruction.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  const streetMatch = compact.match(
    /\b(?:on|onto|toward|towards)\s+(.+?)(?:,|\.|$)/i
  );

  if (streetMatch?.[1]) {
    return streetMatch[1].trim();
  }

  return compact.replace(/[.,]$/, "").trim();
};

const resolveDirectionIcon = ({ maneuverIcon, instruction }) => {
  const allowedIcons = new Set([
    "arrow-up",
    "arrow-back",
    "arrow-forward",
    "return-up-back",
    "refresh",
    "flag",
  ]);
  if (typeof maneuverIcon === "string" && allowedIcons.has(maneuverIcon)) {
    return maneuverIcon;
  }

  const source = `${String(maneuverIcon || "")} ${String(instruction || "")}`.toLowerCase();

  if (source.includes("left")) {
    return "arrow-back";
  }
  if (source.includes("right")) {
    return "arrow-forward";
  }
  if (source.includes("uturn") || source.includes("u-turn")) {
    return "return-up-back";
  }

  return "arrow-up";
};

const resolvePrimaryDistance = ({ distanceToTurn, distanceToDestination }) => {
  const parsedTurnDistanceMeters = parseDistanceMeters(distanceToTurn);
  if (Number.isFinite(parsedTurnDistanceMeters) && parsedTurnDistanceMeters >= 0) {
    return distanceToTurn;
  }

  return distanceToDestination;
};

const NavigationInstructionsBanner = ({
  nextInstruction,
  isNavigating,
  maneuverIcon,
  distanceToDestination,
  distanceToTurn,
  streetName,
  topPadding = 0,
  ui,
}) => {
  if (!nextInstruction || isNavigating) return null;
  const styles = ui || {};
  const distanceValue = resolvePrimaryDistance({
    distanceToTurn,
    distanceToDestination,
  });
  const formattedDistance = formatDistanceImperial(distanceValue);
  const routeStreet = typeof streetName === "string" && streetName.trim().length > 0
    ? streetName.trim()
    : extractStreetFromInstruction(nextInstruction);
  const instructionText = typeof nextInstruction === "string" && nextInstruction.trim().length > 0
    ? nextInstruction.trim()
    : routeStreet;
  const directionIcon = resolveDirectionIcon({
    maneuverIcon,
    instruction: nextInstruction,
  });

  return (
    <View style={styles.navigationContainer}>
      <View style={[styles.navigationHeader, { paddingTop: topPadding }]}>
        <View style={styles.navigationHeaderContent}>
          <View style={styles.maneuverRow}>
            <View style={styles.maneuverTextWrap}>
              <Text style={styles.distanceText} numberOfLines={1}>
                {formattedDistance}
              </Text>
              <Text style={styles.streetText} numberOfLines={1}>
                {instructionText}
              </Text>
            </View>

            <View style={styles.maneuverIconWrap}>
              <Ionicons name={directionIcon} size={28} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

export default NavigationInstructionsBanner;
