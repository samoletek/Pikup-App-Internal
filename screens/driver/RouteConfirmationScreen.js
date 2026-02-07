import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

export default function RouteConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { pickup, dropoff } = route.params || {};
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Furniture");
  const [helpNeeded, setHelpNeeded] = useState("yes");
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const categories = ["Furniture", "Appliance", "Electronic", "Fragile"];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Route Confirmation"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={[
              styles.container,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map-outline" size={26} color={colors.primary} />
                <Text style={styles.mapPlaceholderText}>Route preview</Text>
              </View>

              <Text style={styles.sectionHeader}>Trip Summary</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Pickup From</Text>
                <Text style={styles.address}>{pickup}</Text>
                <Text style={styles.label}>Drop At</Text>
                <Text style={styles.address}>{dropoff}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    Estimated arrival: <Text style={styles.bold}>15 min</Text>
                  </Text>
                  <Text style={styles.meta}>
                    Available helpers: <Text style={styles.bold}>5</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryRow}>
                  {categories.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.pill, category === item && styles.activePill]}
                      onPress={() => setCategory(item)}
                    >
                      <Text style={[styles.pillText, category === item && styles.activePillText]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Describe your items</Text>
                <TextInput
                  multiline
                  textAlignVertical="top"
                  placeholder="Add details here..."
                  placeholderTextColor={colors.text.tertiary}
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={200}
                />
                <Text style={styles.charCount}>{description.length} / 200 characters</Text>

                <Text style={[styles.label, styles.helpLabel]}>
                  Do you need help with loading/unloading?
                </Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, helpNeeded === "yes" && styles.activeToggle]}
                    onPress={() => setHelpNeeded("yes")}
                  >
                    <Text style={helpNeeded === "yes" ? styles.activeToggleText : styles.toggleText}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, helpNeeded === "no" && styles.activeToggle]}
                    onPress={() => setHelpNeeded("no")}
                  >
                    <Text style={helpNeeded === "no" ? styles.activeToggleText : styles.toggleText}>
                      No
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.checkboxRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                    style={styles.checkboxIcon}
                  />
                  <Text style={styles.checkboxText}>Driver assistance requested</Text>
                </View>

                <Text style={styles.label}>Add Photos</Text>
                <View style={styles.uploadBox}>
                  <Ionicons name="camera-outline" size={32} color={colors.text.muted} />
                  <Text style={styles.uploadText}>Add photos of your items</Text>
                </View>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => {}}
                  accessibilityRole="button"
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                  <Text style={styles.uploadBtnText}>Upload Photos</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => navigation.navigate("VehicleSelectionScreen")}
              >
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  flex: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  mapPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.base,
  },
  mapPlaceholderText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.background.secondary,
    padding: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text.secondary,
    marginBottom: spacing.xs + 2,
    fontSize: typography.fontSize.base,
  },
  address: {
    color: colors.text.primary,
    marginBottom: spacing.sm + 2,
    fontSize: typography.fontSize.base,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.base,
  },
  meta: {
    flex: 1,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  bold: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm + 2,
    marginBottom: spacing.base,
  },
  pill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.full,
  },
  activePill: {
    backgroundColor: colors.primary,
  },
  pillText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  activePillText: {
    color: colors.white,
  },
  textArea: {
    backgroundColor: colors.background.tertiary,
    color: colors.text.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm + 2,
    height: 100,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  charCount: {
    color: colors.text.muted,
    fontSize: typography.fontSize.xs + 1,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  helpLabel: {
    marginTop: spacing.lg,
  },
  toggleRow: {
    flexDirection: "row",
    marginVertical: spacing.sm + 2,
    gap: spacing.sm + 2,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  activeToggle: {
    backgroundColor: colors.primaryDark,
  },
  toggleText: {
    color: colors.text.secondary,
  },
  activeToggleText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.sm + 2,
  },
  checkboxIcon: {
    marginRight: spacing.sm,
  },
  checkboxText: {
    color: colors.text.primary,
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border.light,
    borderRadius: borderRadius.sm + 2,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.background.tertiary,
  },
  uploadText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs + 2,
  },
  uploadBtn: {
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  uploadBtnText: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  nextBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    marginTop: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  nextBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
