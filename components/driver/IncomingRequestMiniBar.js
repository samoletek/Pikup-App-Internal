// Incoming Request Mini Bar component: renders its UI and handles related interactions.
import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../styles/theme";

const toMoneyLabel = (value) => {
  if (typeof value === "string" && value.includes("$")) {
    return value;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
};

const IncomingRequestMiniBar = ({
  visible,
  incomingRequest,
  requestTimeRemaining,
  miniBarPulse,
  onExpand,
  formatRequestTime,
  styles,
}) => {
  if (!visible || !incomingRequest) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.miniBar,
        { bottom: spacing.lg },
        {
          borderColor: miniBarPulse.interpolate({
            inputRange: [0, 1],
            outputRange: ["rgba(125,95,255,0.5)", "rgba(125,95,255,0.85)"],
          }),
          shadowColor: miniBarPulse.interpolate({
            inputRange: [0, 1],
            outputRange: ["rgba(125,95,255,0.45)", "rgba(125,95,255,0.75)"],
          }),
          shadowOpacity: miniBarPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 0.85],
          }),
          shadowRadius: miniBarPulse.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 20],
          }),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.miniBarInner}
        onPress={onExpand}
        activeOpacity={0.9}
      >
        <View style={styles.miniBarLeft}>
          <Ionicons
            name="timer-outline"
            size={18}
            color={requestTimeRemaining <= 30 ? colors.error : colors.primary}
          />
          <Text style={[styles.miniBarTimer, { color: requestTimeRemaining <= 30 ? colors.error : colors.primary }]}>
            {formatRequestTime(requestTimeRemaining)}
          </Text>
        </View>
        <Text style={styles.miniBarPrice} numberOfLines={1}>
          {toMoneyLabel(
            incomingRequest.driverPayout ??
              incomingRequest.earnings ??
              incomingRequest.pricing?.driverPayout ??
              incomingRequest.price ??
              0
          )}
        </Text>
        <View style={styles.miniBarExpand}>
          <Ionicons name="chevron-up" size={20} color={colors.text.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default IncomingRequestMiniBar;
