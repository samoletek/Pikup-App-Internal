import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, typography } from "../styles/theme";

const Tab = createBottomTabNavigator();
const IOS_TAB_BASE_HEIGHT = 58;
const ANDROID_TAB_BASE_HEIGHT = 62;

function TabBarBackground() {
  if (Platform.OS !== "ios") {
    return <View style={styles.androidTabBarBackground} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView tint="dark" intensity={42} style={StyleSheet.absoluteFill} />
      <View style={styles.iosTabBarOverlay} />
    </View>
  );
}

export default function RoleTabNavigator({ tabs }) {
  const insets = useSafeAreaInsets();

  const tabsByRoute = useMemo(
    () => Object.fromEntries(tabs.map((tab) => [tab.name, tab])),
    [tabs]
  );

  const tabBarHeight =
    (Platform.OS === "ios" ? IOS_TAB_BASE_HEIGHT : ANDROID_TAB_BASE_HEIGHT) +
    insets.bottom;
  const tabBarPaddingBottom =
    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  return (
    <Tab.Navigator
      sceneContainerStyle={styles.sceneContainer}
      screenOptions={({ route }) => {
        const tabConfig = tabsByRoute[route.name];
        const activeIcon = tabConfig?.icon?.active || "ellipse";
        const inactiveIcon = tabConfig?.icon?.inactive || "ellipse-outline";

        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.navigation.tabBarInactive,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabBarHeight,
              paddingBottom: tabBarPaddingBottom,
              backgroundColor:
                Platform.OS === "ios"
                  ? "transparent"
                  : colors.navigation.tabBarBackground,
            },
          ],
          tabBarBackground: () => <TabBarBackground />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? activeIcon : inactiveIcon}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={tab.options}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  sceneContainer: {
    backgroundColor: colors.background.primary,
  },
  tabBar: {
    borderTopWidth: 0,
    paddingTop: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 14,
  },
  tabBarLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  iosTabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navigation.tabBarBackground,
  },
  androidTabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navigation.tabBarBackground,
  },
});
