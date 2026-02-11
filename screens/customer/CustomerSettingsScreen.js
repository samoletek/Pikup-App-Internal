import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useAuth } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const notificationItems = [
  {
    key: "pushNotifications",
    title: "Push Notifications",
    description: "Receive notifications on your device",
  },
  {
    key: "emailNotifications",
    title: "Email Notifications",
    description: "Receive updates by email",
  },
  {
    key: "smsNotifications",
    title: "SMS Notifications",
    description: "Receive updates by text message",
  },
  {
    key: "promotions",
    title: "Promotions and Offers",
    description: "Get promotional messages and special offers",
  },
  {
    key: "tripUpdates",
    title: "Trip Updates",
    description: "Receive notifications about your trips",
  },
  {
    key: "accountActivity",
    title: "Account Activity",
    description: "Get alerts about account changes",
  },
];

export default function CustomerSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userType } = useAuth();
  const [settings, setSettings] = useState({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      promotions: false,
      tripUpdates: true,
      accountActivity: true,
    },
    language: "English",
    currency: "USD",
  });
  const isDriver = userType === "driver";
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.nativeAppVersion ||
    "0.0.0";

  const toggleSetting = (settingKey) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [settingKey]: !prev.notifications[settingKey],
      },
    }));
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isDriver ? "Notifications" : "Settings"}
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
            <View style={styles.card}>
              {notificationItems.map((item, index) => (
                <View
                  key={item.key}
                  style={[
                    styles.switchRow,
                    index === notificationItems.length - 1 && styles.rowLast,
                  ]}
                >
                  <View style={styles.switchInfo}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.switchDescription}>{item.description}</Text>
                  </View>
                  <Switch
                    trackColor={{
                      false: colors.border.strong,
                      true: colors.background.brandTint,
                    }}
                    thumbColor={
                      settings.notifications[item.key] ? colors.primary : colors.white
                    }
                    ios_backgroundColor={colors.border.strong}
                    onValueChange={() => toggleSetting(item.key)}
                    value={settings.notifications[item.key]}
                  />
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.versionText}>v{appVersion}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  sectionBlock: {
    marginBottom: spacing.base,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  switchRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  switchInfo: {
    flex: 1,
    paddingRight: spacing.base,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: typography.fontWeight.medium,
  },
  switchDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  versionText: {
    textAlign: "center",
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginTop: spacing.sm,
  },
});
