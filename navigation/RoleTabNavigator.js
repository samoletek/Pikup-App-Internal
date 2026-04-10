import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthIdentity, useMessagingActions } from "../contexts/AuthContext";
import {
  filterCustomerInboxConversations,
  filterDriverInboxConversations,
  isArchivedConversation,
  isSupportUserId,
} from "../services/MessagesInboxService";
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
  const { currentUser, userType } = useAuthIdentity();
  const { getConversations, subscribeToConversations } = useMessagingActions();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const currentUserId = currentUser?.uid || currentUser?.id || null;

  const tabsByRoute = useMemo(
    () => Object.fromEntries(tabs.map((tab) => [tab.name, tab])),
    [tabs]
  );

  const tabBarHeight =
    (Platform.OS === "ios" ? IOS_TAB_BASE_HEIGHT : ANDROID_TAB_BASE_HEIGHT) +
    insets.bottom;
  const tabBarPaddingBottom =
    Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;

  useEffect(() => {
    const isSupportedUserType = userType === "customer" || userType === "driver";
    if (
      !currentUserId ||
      !isSupportedUserType ||
      typeof getConversations !== "function" ||
      typeof subscribeToConversations !== "function"
    ) {
      setHasUnreadMessages(false);
      return undefined;
    }

    let isDisposed = false;
    const unreadKey = userType === "driver" ? "unreadByDriver" : "unreadByCustomer";

    const updateUnreadBadge = (userConversations = []) => {
      if (isDisposed) {
        return;
      }

      const conversationList = Array.isArray(userConversations) ? userConversations : [];
      const visibleConversations = userType === "driver"
        ? filterDriverInboxConversations(conversationList)
        : filterCustomerInboxConversations(conversationList);

      const hasUnread = visibleConversations.some(
        (conversation) => {
          if (Number(conversation?.[unreadKey] || 0) <= 0) {
            return false;
          }

          const supportPeerId =
            userType === "driver" ? conversation?.customerId : conversation?.driverId;
          if (isSupportUserId(supportPeerId)) {
            return true;
          }

          return !isArchivedConversation(conversation);
        }
      );
      setHasUnreadMessages(hasUnread);
    };

    const bootstrapUnreadBadge = async () => {
      const userConversations = await getConversations(currentUserId, userType);
      updateUnreadBadge(userConversations);
    };

    void bootstrapUnreadBadge();
    const unsubscribe = subscribeToConversations(
      currentUserId,
      userType,
      updateUnreadBadge
    );

    return () => {
      isDisposed = true;
      unsubscribe?.();
    };
  }, [currentUserId, getConversations, subscribeToConversations, userType]);

  return (
    <Tab.Navigator
      sceneContainerStyle={styles.sceneContainer}
      screenOptions={({ route }) => {
        const tabConfig = tabsByRoute[route.name];
        const activeIcon = tabConfig?.icon?.active || "ellipse";
        const inactiveIcon = tabConfig?.icon?.inactive || "ellipse-outline";

        const isMessagesTab = route.name === "Messages";

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
          tabBarBadge: isMessagesTab && hasUnreadMessages ? " " : undefined,
          tabBarBadgeStyle: isMessagesTab && hasUnreadMessages ? styles.unreadBadge : undefined,
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
  unreadBadge: {
    minWidth: 10,
    height: 10,
    borderRadius: 5,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: colors.secondary,
    color: "transparent",
    borderWidth: 1,
    borderColor: colors.navigation.tabBarBackground,
  },
});
