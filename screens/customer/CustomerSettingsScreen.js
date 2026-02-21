import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
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

export default function CustomerSettingsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userType } = useAuth();
  const notificationsOnly = route?.params?.notificationsOnly === true;
  const [settings, setSettings] = useState({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      promotions: false,
      tripUpdates: true,
      accountActivity: true,
    },
  });
  const [downloadingData, setDownloadingData] = useState(false);
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

  const renderRow = ({
    icon,
    label,
    onPress,
    loading = false,
    value,
    isLast = false,
    isExternal = false,
  }) => (
    <TouchableOpacity
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.rowLeft}>
        {icon ? <Ionicons name={icon} size={20} color={colors.primary} /> : null}
        <Text style={styles.rowTitle}>{label}</Text>
      </View>

      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={isExternal ? "open-outline" : "chevron-forward"}
            size={18}
            color={colors.text.tertiary}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  const handleDownloadMyData = async () => {
    if (downloadingData) return;

    Alert.alert(
      "Download My Data",
      "This will export all your personal data as a JSON file. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            setDownloadingData(true);
            try {
              const { data: sessionData, error: sessionError } =
                await supabase.auth.getSession();
              if (sessionError || !sessionData?.session?.access_token) {
                throw new Error("Session expired. Please sign in again.");
              }

              const { data, error } = await supabase.functions.invoke(
                "download-user-data",
                {
                  headers: {
                    Authorization: `Bearer ${sessionData.session.access_token}`,
                  },
                  body: { role: isDriver ? "driver" : "customer" },
                }
              );

              if (error) {
                let errorMessage = "Failed to download data.";
                if (error?.context) {
                  try {
                    const errorBody = await error.context.clone().json();
                    errorMessage =
                      errorBody?.error || errorBody?.message || errorMessage;
                  } catch (_) {}
                }
                throw new Error(errorMessage);
              }

              const fileName = `pikup-data-${Date.now()}.json`;
              const fileUri = FileSystem.cacheDirectory + fileName;
              await FileSystem.writeAsStringAsync(
                fileUri,
                JSON.stringify(data, null, 2)
              );

              const sharingAvailable = await Sharing.isAvailableAsync();
              if (!sharingAvailable) {
                Alert.alert(
                  "Sharing Unavailable",
                  "Sharing is not available on this device."
                );
                return;
              }

              await Sharing.shareAsync(fileUri, {
                mimeType: "application/json",
                dialogTitle: "Save Your Data",
                UTI: "public.json",
              });
            } catch (err) {
              console.error("Error downloading user data:", err);
              Alert.alert(
                "Error",
                err?.message || "Failed to download your data. Please try again."
              );
            } finally {
              setDownloadingData(false);
            }
          },
        },
      ]
    );
  };

  const accountRows = notificationsOnly
    ? []
    : isDriver
    ? [
        {
          icon: "person-outline",
          label: "Profile",
          onPress: () => navigation.navigate("PersonalInfoScreen"),
        },
        {
          icon: "options-outline",
          label: "Preferences",
          onPress: () => navigation.navigate("DriverPreferencesScreen"),
        },
        {
          icon: "card-outline",
          label: "Payment",
          onPress: () => navigation.navigate("DriverPaymentSettingsScreen"),
        },
        {
          icon: "notifications-outline",
          label: "Notifications",
          onPress: () =>
            navigation.push("CustomerSettingsScreen", { notificationsOnly: true }),
        },
        {
          icon: "download-outline",
          label: "Download My Data",
          onPress: handleDownloadMyData,
          loading: downloadingData,
        },
      ]
    : [
        {
          icon: "person-outline",
          label: "Profile",
          onPress: () => navigation.navigate("PersonalInfoScreen"),
        },
        {
          icon: "location-outline",
          label: "My Addresses",
          onPress: () => navigation.navigate("CustomerSavedAddressesScreen"),
        },
        {
          icon: "card-outline",
          label: "Payment",
          onPress: () => navigation.navigate("PaymentMethodsScreen"),
        },
        {
          icon: "download-outline",
          label: "Download My Data",
          onPress: handleDownloadMyData,
          loading: downloadingData,
        },
      ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={notificationsOnly ? "Notifications" : "Settings"}
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
          {accountRows.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>ACCOUNT</Text>
              <View style={styles.card}>
                {accountRows.map((row, index) =>
                  renderRow({
                    ...row,
                    isLast: index === accountRows.length - 1,
                  })
                )}
              </View>
            </View>
          )}

          {(!isDriver || notificationsOnly) && (
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
                      <Text style={styles.switchTitle}>{item.title}</Text>
                      <Text style={styles.switchDescription}>{item.description}</Text>
                    </View>
                    <View style={styles.switchControl}>
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
                  </View>
                ))}
              </View>
            </View>
          )}
          {!notificationsOnly && <Text style={styles.versionText}>v{appVersion}</Text>}
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
  row: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginLeft: spacing.md,
  },
  rowValue: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginRight: spacing.xs,
  },
  switchRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  switchInfo: {
    flex: 1,
    paddingRight: spacing.base,
  },
  switchTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  switchDescription: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  switchControl: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  versionText: {
    textAlign: "center",
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    marginTop: spacing.sm,
  },
});
