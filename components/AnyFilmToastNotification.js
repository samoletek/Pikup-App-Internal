// Any Film Toast Notification component: renders its UI and handles related interactions.
import React, { useCallback, useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "../styles/theme";

export default function AnyFilmToastNotification({
  message,
  type = "info",
  visible,
  onHide,
  duration = 3000,
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);
  const screenWidth = Dimensions.get("window").width;

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  }, [onHide, opacity, translateY]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 12,
          bounciness: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, hideToast, opacity, translateY, visible]);

  if (!visible) return null;

  const iconName =
    type === "error"
      ? "close-circle"
      : type === "warning"
        ? "warning"
      : type === "success"
        ? "checkmark-circle"
        : "information-circle";

  return (
    <PanGestureHandler
      onHandlerStateChange={(event) => {
        if (event.nativeEvent.state === State.END && event.nativeEvent.translationY < -20) {
          hideToast();
        }
      }}
    >
      <Animated.View
        style={[
          styles.wrapper,
          {
            top: insets.top + 16,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.container,
            {
              maxWidth: screenWidth - 40,
            },
          ]}
        >
          <Ionicons name={iconName} size={20} color={colors.text.primary} style={styles.icon} />
          <Text numberOfLines={2} style={styles.message}>
            {message}
          </Text>
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flexShrink: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
});
