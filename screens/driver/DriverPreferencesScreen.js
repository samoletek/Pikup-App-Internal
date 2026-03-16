import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAuthIdentity,
  useDriverActions,
  usePaymentActions,
} from "../../contexts/AuthContext";
import AppSwitch from "../../components/AppSwitch";
import ScreenHeader from "../../components/ScreenHeader";
import {
  colors,
  layout,
  spacing,
} from "../../styles/theme";
import styles from "./DriverPreferencesScreen.styles";
import {
  DRIVER_MODE_OPTIONS,
  DRIVER_PREFERENCE_ITEM_META,
  DRIVER_PREFERENCE_SECTIONS,
  DRIVER_PREFERENCE_TIPS,
} from "./driverPreferences.constants";
import useDriverPreferencesData from "./useDriverPreferencesData";

export default function DriverPreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser } = useAuthIdentity();
  const { getDriverProfile } = useDriverActions();
  const { updateDriverPaymentProfile } = usePaymentActions();
  const userId = currentUser?.uid || currentUser?.id;
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    preferences,
    handleToggleChange,
    getSectionSummary,
  } = useDriverPreferencesData({
    getDriverProfile,
    updateDriverPaymentProfile,
    userId,
  });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Driver Preferences"
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
          <View style={styles.tipsBlock}>
            <Text style={styles.tipsLabel}>TIPS</Text>
            <View style={styles.card}>
              {DRIVER_PREFERENCE_TIPS.map((tip, index) => (
                <View
                  key={tip}
                  style={[
                    styles.tipRow,
                    index === DRIVER_PREFERENCE_TIPS.length - 1 && styles.rowLast,
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {DRIVER_PREFERENCE_SECTIONS.map((section) => {
            const state = preferences[section.sectionKey];
            const summary = getSectionSummary(section.sectionKey);

            return (
              <View key={section.sectionKey} style={styles.sectionBlock}>
                <View style={styles.sectionLabelRow}>
                  <Ionicons
                    name={section.sectionIcon}
                    size={14}
                    color={colors.text.muted}
                  />
                  <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
                  {summary && (
                    <View style={styles.summaryBadge}>
                      <Text style={styles.summaryBadgeText}>
                        {summary.enabled} of {summary.total}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.card}>
                  {section.hasModePicker && (
                    <View style={styles.modePickerContainer}>
                      <Text style={styles.modePickerLabel}>Default Driving Mode</Text>
                      <View style={styles.modePickerRow}>
                        {DRIVER_MODE_OPTIONS.map((option) => {
                          const isSelected =
                            preferences.teamPreferences?.preferredMode === option.value;
                          return (
                            <TouchableOpacity
                              key={option.value}
                              style={[
                                styles.modeOption,
                                isSelected && styles.modeOptionSelected,
                              ]}
                              onPress={() => {
                                handleToggleChange(
                                  "teamPreferences",
                                  "preferredMode",
                                  option.value
                                );
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={option.icon}
                                size={18}
                                color={isSelected ? colors.white : colors.text.muted}
                              />
                              <Text
                                style={[
                                  styles.modeOptionText,
                                  isSelected && styles.modeOptionTextSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {Object.entries(section.items).map(([key, label], index, items) => {
                    const meta = DRIVER_PREFERENCE_ITEM_META[key];
                    const isEnabled = !!state?.[key];
                    const isLast = index === items.length - 1;

                    return (
                      <View
                        key={key}
                        style={[styles.toggleRow, isLast && styles.rowLast]}
                      >
                        <View
                          style={[
                            styles.toggleIconBox,
                            isEnabled && styles.toggleIconBoxActive,
                          ]}
                        >
                          <Ionicons
                            name={meta?.icon || "ellipse-outline"}
                            size={20}
                            color={isEnabled ? colors.primary : colors.text.muted}
                          />
                        </View>
                        <View style={styles.toggleTextCol}>
                          <Text style={styles.toggleLabel}>{label}</Text>
                          {meta?.desc ? (
                            <Text style={styles.toggleDesc}>{meta.desc}</Text>
                          ) : null}
                        </View>
                        <AppSwitch
                          value={isEnabled}
                          onValueChange={(value) => {
                            handleToggleChange(section.sectionKey, key, value);
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
