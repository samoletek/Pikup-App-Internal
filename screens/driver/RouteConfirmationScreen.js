import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import {
  layout,
  spacing,
  colors,
} from "../../styles/theme";
import styles from "./RouteConfirmationScreen.styles";

const CATEGORIES = ["Furniture", "Appliance", "Electronic", "Fragile"];

function formatMetaNumber(value, suffix = "") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "N/A";
  }
  return `${parsed}${suffix}`;
}

export default function RouteConfirmationScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    pickup,
    dropoff,
    estimatedArrivalMinutes,
    availableHelpers,
  } = route.params || {};

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [helpNeeded, setHelpNeeded] = useState("yes");
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const etaLabel = useMemo(() => {
    return formatMetaNumber(estimatedArrivalMinutes, " min");
  }, [estimatedArrivalMinutes]);

  const helpersLabel = useMemo(() => {
    return formatMetaNumber(availableHelpers);
  }, [availableHelpers]);

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
                <Text style={styles.address}>{pickup || "Pickup location"}</Text>
                <Text style={styles.label}>Drop At</Text>
                <Text style={styles.address}>{dropoff || "Drop-off location"}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    Estimated arrival: <Text style={styles.bold}>{etaLabel}</Text>
                  </Text>
                  <Text style={styles.meta}>
                    Available helpers: <Text style={styles.bold}>{helpersLabel}</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((item) => (
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
                <AppInput
                  multiline
                  textAlignVertical="top"
                  placeholder="Add details here..."
                  inputStyle={styles.textArea}
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
                  <Text style={styles.checkboxText}>
                    {helpNeeded === "yes"
                      ? "Driver assistance requested"
                      : "No loading assistance requested"}
                  </Text>
                </View>

                <Text style={styles.label}>Add Photos</Text>
                <View style={styles.uploadBox}>
                  <Ionicons name="camera-outline" size={32} color={colors.text.muted} />
                  <Text style={styles.uploadText}>Add photos of your items</Text>
                </View>
                <AppButton
                  title="Upload Photos"
                  style={styles.uploadBtn}
                  labelStyle={styles.uploadBtnText}
                  onPress={() => {}}
                  leftIcon={<Ionicons name="cloud-upload-outline" size={18} color={colors.white} />}
                />
              </View>
              <AppButton
                title="Next"
                style={styles.nextBtn}
                labelStyle={styles.nextBtnText}
                onPress={() => navigation.navigate("VehicleSelectionScreen")}
              />
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}
