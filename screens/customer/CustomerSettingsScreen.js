import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthIdentity } from "../../contexts/AuthContext";
import AppSwitch from "../../components/AppSwitch";
import ScreenHeader from "../../components/ScreenHeader";
import {
  colors,
  layout,
  spacing,
} from "../../styles/theme";
import styles from "./CustomerSettingsScreen.styles";
import { notificationItems } from "./customerSettings.constants";
import useCustomerSettingsData from "./useCustomerSettingsData";
import useLocationSettingsControls from "../../hooks/useLocationSettingsControls";

export default function CustomerSettingsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userType } = useAuthIdentity();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    accountRows,
    appVersion,
    handleBackPress,
    notificationsOnly,
    settings,
    toggleSetting,
  } = useCustomerSettingsData({
    navigation,
    route,
    userType,
  });
  const {
    locationStatus,
    locationTrackingDescription,
    preciseLocationDescription,
    handleLocationTrackingToggle,
    handlePreciseLocationToggle,
    openLocationSettings,
  } = useLocationSettingsControls({
    loggerScope: "CustomerSettingsLocation",
  });

  const renderRow = ({
    rowKey,
    icon,
    label,
    subtitle,
    onPress,
    loading = false,
    value,
    disabled = false,
    lock = false,
    isLast = false,
    isExternal = false,
  }) => (
    <TouchableOpacity
      key={rowKey}
      style={[
        styles.row,
        isLast && styles.rowLast,
        (disabled || loading) && styles.rowDisabled,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      <View style={styles.rowLeft}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={disabled ? colors.text.tertiary : colors.primary}
          />
        ) : null}
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, disabled && styles.rowTitleDisabled]}>{label}</Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, disabled && styles.rowSubtitleDisabled]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, disabled && styles.rowValueDisabled]}>{value}</Text>
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={lock ? "lock-closed" : isExternal ? "open-outline" : "chevron-forward"}
            size={18}
            color={disabled ? colors.text.muted : colors.text.tertiary}
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={notificationsOnly ? "Notifications" : "Settings"}
        onBack={handleBackPress}
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
          {!notificationsOnly && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <View style={styles.switchTitleRow}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.switchTitle}>Location Tracking</Text>
                    </View>
                    <Text style={styles.switchDescription}>
                      {locationTrackingDescription}
                    </Text>
                  </View>
                  <View style={styles.switchControl}>
                    <AppSwitch
                      value={locationStatus.locationTrackingEnabled}
                      onValueChange={handleLocationTrackingToggle}
                      disabled={locationStatus.loading}
                    />
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <View style={styles.switchTitleRow}>
                      <Ionicons
                        name="locate-outline"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.switchTitle}>Precise Location</Text>
                    </View>
                    <Text style={styles.switchDescription}>
                      {preciseLocationDescription}
                    </Text>
                  </View>
                  <View style={styles.switchControl}>
                    <AppSwitch
                      value={locationStatus.preciseLocationEnabled}
                      onValueChange={handlePreciseLocationToggle}
                      disabled={locationStatus.loading}
                    />
                  </View>
                </View>

                {renderRow({
                  rowKey: "open-location-settings",
                  icon: "settings-outline",
                  label: "Open System Location Settings",
                  subtitle: "Manage permission, precise location, and service mode.",
                  onPress: openLocationSettings,
                  isExternal: true,
                  isLast: true,
                })}
              </View>
            </View>
          )}

          {accountRows.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>ACCOUNT</Text>
              <View style={styles.card}>
                {accountRows.map((row, index) =>
                  renderRow({
                    ...row,
                    rowKey: row.key,
                    isLast: index === accountRows.length - 1,
                  })
                )}
              </View>
            </View>
          )}

          {notificationsOnly && (
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
