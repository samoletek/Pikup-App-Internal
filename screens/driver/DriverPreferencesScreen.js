import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
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
  availability: {
    ...DEFAULT_PREFERENCES.availability,
    ...(candidate?.availability || {}),
  },
});

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
      if (!userId || !getDriverProfile) {
        return;
      }

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
      if (!userId || !updateDriverPaymentProfile) {
        return;
      }

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

  const sections = useMemo(
    () => [
      {
        sectionKey: "pickupPreferences",
        title: "Pickup Types",
        subtitle: "Choose items you can safely move.",
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
        items: {
          truckBed: "Pickup Truck Bed",
          trailer: "Trailer Available",
          largeVan: "Large Van/Box Truck",
          suvSpace: "SUV/Large Cargo Space",
          roofRack: "Roof Rack System",
        },
      },
      {
        sectionKey: "availability",
        title: "Availability",
        subtitle: "Define when you want to receive requests.",
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
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>TIPS</Text>
            <View style={styles.card}>
              {TIPS.map((tip, index) => (
                <View key={tip} style={[styles.tipRow, index === TIPS.length - 1 && styles.rowLast]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {sections.map((section) => {
            const state = preferences[section.sectionKey];
            return (
              <View key={section.sectionKey} style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
                <View style={styles.card}>
                  <View style={styles.sectionIntro}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                  </View>
                  {Object.entries(section.items).map(([key, label], index, items) => (
                    <View
                      key={key}
                      style={[styles.toggleRow, index === items.length - 1 && styles.rowLast]}
                    >
                      <Text style={styles.toggleLabel}>{label}</Text>
                      <AppSwitch
                        value={state?.[key]}
                        onValueChange={(value) =>
                          handleToggleChange(section.sectionKey, key, value)
                        }
                      />
                    </View>
                  ))}
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
  sectionIntro: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    lineHeight: 19,
  },
  toggleRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  toggleLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    marginRight: spacing.base,
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
    lineHeight: 19,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});
