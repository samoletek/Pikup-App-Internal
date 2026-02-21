import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import AppSwitch from "../../components/AppSwitch";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const DEFAULT_PREFERENCES = {
  pickupPreferences: {
    smallItems: true,
    mediumItems: true,
    largeItems: false,
    extraLargeItems: false,
    fragileItems: true,
    outdoorItems: true,
  },
  equipment: {
    dolly: false,
    handTruck: false,
    movingStraps: false,
    heavyDutyGloves: true,
    furniturePads: false,
    toolSet: false,
    rope: true,
    tarp: false,
  },
  vehicleSpecs: {
    truckBed: false,
    trailer: false,
    largeVan: false,
    suvSpace: true,
    roofRack: false,
  },
  teamPreferences: {
    preferredMode: "solo",
    willingToHelp: false,
    needsExtraHand: false,
  },
  availability: {
    weekends: true,
    evenings: true,
    shortNotice: false,
    longDistance: false,
  },
};

const mergePreferences = (candidate) => ({
  pickupPreferences: {
    ...DEFAULT_PREFERENCES.pickupPreferences,
    ...(candidate?.pickupPreferences || {}),
  },
  equipment: {
    ...DEFAULT_PREFERENCES.equipment,
    ...(candidate?.equipment || {}),
  },
  vehicleSpecs: {
    ...DEFAULT_PREFERENCES.vehicleSpecs,
    ...(candidate?.vehicleSpecs || {}),
  },
  teamPreferences: {
    ...DEFAULT_PREFERENCES.teamPreferences,
    ...(candidate?.teamPreferences || {}),
  },
  availability: {
    ...DEFAULT_PREFERENCES.availability,
    ...(candidate?.availability || {}),
  },
});

const ITEM_META = {
  smallItems: { icon: "cube-outline", desc: "Boxes, bags, small furniture" },
  mediumItems: { icon: "file-tray-stacked-outline", desc: "Desks, chairs, appliances" },
  largeItems: { icon: "resize-outline", desc: "Sofas, mattresses, large tables" },
  extraLargeItems: { icon: "barbell-outline", desc: "Pianos, hot tubs, 150+ lb items" },
  fragileItems: { icon: "wine-outline", desc: "Glass, electronics, artwork" },
  outdoorItems: { icon: "leaf-outline", desc: "Grills, patio sets, planters" },

  dolly: { icon: "cart-outline", desc: "Standard upright dolly" },
  handTruck: { icon: "construct-outline", desc: "Heavy duty, stair-climbing" },
  movingStraps: { icon: "link-outline", desc: "Shoulder/forearm straps" },
  heavyDutyGloves: { icon: "hand-left-outline", desc: "Cut-resistant work gloves" },
  furniturePads: { icon: "layers-outline", desc: "Blankets for scratch protection" },
  toolSet: { icon: "hammer-outline", desc: "Wrench, screwdriver, pliers" },
  rope: { icon: "git-merge-outline", desc: "Tie-downs and bungee cords" },
  tarp: { icon: "umbrella-outline", desc: "Weather protection covering" },

  truckBed: { icon: "car-sport-outline", desc: "Open bed pickup truck" },
  trailer: { icon: "trail-sign-outline", desc: "Attached or available trailer" },
  largeVan: { icon: "bus-outline", desc: "Cargo van or box truck" },
  suvSpace: { icon: "car-outline", desc: "SUV or large hatchback" },
  roofRack: { icon: "arrow-up-outline", desc: "Roof rails with crossbars" },

  weekends: { icon: "calendar-outline", desc: "Saturday and Sunday" },
  evenings: { icon: "moon-outline", desc: "6 PM \u2013 10 PM shifts" },
  shortNotice: { icon: "flash-outline", desc: "Accept requests within 30 min" },
  longDistance: { icon: "navigate-outline", desc: "Hauls over 50 miles one-way" },

  willingToHelp: { icon: "hand-right-outline", desc: "Offer to help other drivers" },
  needsExtraHand: { icon: "person-add-outline", desc: "Request backup for heavy items" },
};

const MODE_OPTIONS = [
  { value: "solo", label: "Solo", icon: "person-outline" },
  { value: "team", label: "Team", icon: "people-outline" },
  { value: "both", label: "Either", icon: "swap-horizontal-outline" },
];

const TIPS = [
  "Mark only services you can handle safely.",
  "Enabling equipment can increase matching quality.",
  "Keep availability accurate for better request flow.",
];

export default function DriverPreferencesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, getDriverProfile, updateDriverPaymentProfile } = useAuth();
  const userId = currentUser?.uid || currentUser?.id;
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  useEffect(() => {
    let isMounted = true;

    const hydratePreferences = async () => {
      if (!userId || !getDriverProfile) return;

      try {
        const profile = await getDriverProfile(userId);
        const savedPreferences = profile?.metadata?.driverPreferences;

        if (savedPreferences && isMounted) {
          setPreferences(mergePreferences(savedPreferences));
        }
      } catch (error) {
        console.error("Failed to load driver preferences:", error);
      }
    };

    hydratePreferences();

    return () => {
      isMounted = false;
    };
  }, [userId, getDriverProfile]);

  const persistPreferences = useCallback(
    async (nextPreferences) => {
      if (!userId || !updateDriverPaymentProfile) return;

      try {
        await updateDriverPaymentProfile(userId, {
          driverPreferences: {
            ...nextPreferences,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Failed to persist driver preferences:", error);
      }
    },
    [userId, updateDriverPaymentProfile]
  );

  const handleToggleChange = useCallback(
    (sectionKey, key, value) => {
      setPreferences((prev) => {
        const nextPreferences = {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            [key]: value,
          },
        };
        void persistPreferences(nextPreferences);
        return nextPreferences;
      });
    },
    [persistPreferences]
  );

  const getSectionSummary = useCallback(
    (sectionKey) => {
      const state = preferences[sectionKey];
      if (!state) return null;
      const boolEntries = Object.entries(state).filter(
        ([, v]) => typeof v === "boolean"
      );
      const enabled = boolEntries.filter(([, v]) => v).length;
      return { enabled, total: boolEntries.length };
    },
    [preferences]
  );

  const sections = useMemo(
    () => [
      {
        sectionKey: "pickupPreferences",
        title: "Pickup Types",
        subtitle: "Choose items you can safely move.",
        sectionIcon: "cube-outline",
        items: {
          smallItems: "Small Items (under 25 lbs)",
          mediumItems: "Medium Items (25-75 lbs)",
          largeItems: "Large Items (75-150 lbs)",
          extraLargeItems: "Extra Large Items (150+ lbs)",
          fragileItems: "Fragile/Delicate Items",
          outdoorItems: "Outdoor/Garden Items",
        },
      },
      {
        sectionKey: "equipment",
        title: "Equipment",
        subtitle: "Select equipment currently available in your vehicle.",
        sectionIcon: "construct-outline",
        items: {
          dolly: "Dolly/Hand Truck",
          handTruck: "Heavy Duty Hand Truck",
          movingStraps: "Moving Straps",
          heavyDutyGloves: "Heavy Duty Gloves",
          furniturePads: "Furniture Pads/Blankets",
          toolSet: "Basic Tool Set",
          rope: "Rope/Bungee Cords",
          tarp: "Tarp/Protective Covering",
        },
      },
      {
        sectionKey: "vehicleSpecs",
        title: "Vehicle Capabilities",
        subtitle: "Indicate available cargo options.",
        sectionIcon: "car-outline",
        items: {
          truckBed: "Pickup Truck Bed",
          trailer: "Trailer Available",
          largeVan: "Large Van/Box Truck",
          suvSpace: "SUV/Large Cargo Space",
          roofRack: "Roof Rack System",
        },
      },
      {
        sectionKey: "teamPreferences",
        title: "Team / Extra Help",
        subtitle: "Set your default driving mode and help preferences.",
        sectionIcon: "people-outline",
        items: {
          willingToHelp: "Willing to Help Others",
          needsExtraHand: "Request Extra Help on Large Jobs",
        },
        hasModePicker: true,
      },
      {
        sectionKey: "availability",
        title: "Availability",
        subtitle: "Define when you want to receive requests.",
        sectionIcon: "time-outline",
        items: {
          weekends: "Weekend Availability",
          evenings: "Evening Hours (6PM-10PM)",
          shortNotice: "Short Notice Pickups",
          longDistance: "Long Distance Hauls (50+ miles)",
        },
      },
    ],
    []
  );

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
          {/* Tips */}
          <View style={styles.tipsBlock}>
            <Text style={styles.tipsLabel}>TIPS</Text>
            <View style={styles.card}>
              {TIPS.map((tip, index) => (
                <View
                  key={tip}
                  style={[styles.tipRow, index === TIPS.length - 1 && styles.rowLast]}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Sections */}
          {sections.map((section) => {
            const state = preferences[section.sectionKey];
            const summary = getSectionSummary(section.sectionKey);

            return (
              <View key={section.sectionKey} style={styles.sectionBlock}>
                {/* Section label with icon and badge */}
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
                  {/* Mode picker for team section */}
                  {section.hasModePicker && (
                    <View style={styles.modePickerContainer}>
                      <Text style={styles.modePickerLabel}>Default Driving Mode</Text>
                      <View style={styles.modePickerRow}>
                        {MODE_OPTIONS.map((opt) => {
                          const isSelected =
                            preferences.teamPreferences?.preferredMode === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[
                                styles.modeOption,
                                isSelected && styles.modeOptionSelected,
                              ]}
                              onPress={() =>
                                handleToggleChange("teamPreferences", "preferredMode", opt.value)
                              }
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={opt.icon}
                                size={18}
                                color={isSelected ? colors.white : colors.text.muted}
                              />
                              <Text
                                style={[
                                  styles.modeOptionText,
                                  isSelected && styles.modeOptionTextSelected,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Toggle items */}
                  {Object.entries(section.items).map(([key, label], index, items) => {
                    const meta = ITEM_META[key];
                    const isEnabled = !!state?.[key];
                    const isLast =
                      index === items.length - 1;

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
                          {meta?.desc && (
                            <Text style={styles.toggleDesc}>{meta.desc}</Text>
                          )}
                        </View>
                        <AppSwitch
                          value={isEnabled}
                          onValueChange={(value) =>
                            handleToggleChange(section.sectionKey, key, value)
                          }
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

  /* Section header */
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
  },
  summaryBadge: {
    marginLeft: "auto",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
  },
  summaryBadgeText: {
    color: colors.primary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  /* Card */
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },

  /* Toggle row with icon */
  toggleRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  toggleIconBoxActive: {
    backgroundColor: colors.overlayPrimarySoft,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  toggleDesc: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: typography.fontSize.sm * 1.35,
  },

  /* Mode picker (segmented control) */
  modePickerContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  modePickerLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  modePickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.tertiary,
  },
  modeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeOptionText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  modeOptionTextSelected: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },

  /* Tips */
  tipsBlock: {
    marginBottom: spacing.xl,
  },
  tipsLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  tipRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  tipText: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm,
    lineHeight: typography.fontSize.base * 1.35,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});
