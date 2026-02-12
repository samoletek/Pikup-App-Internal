import React from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";

const WEBSITE_URL = "https://pikup-app.com/";
const PRIVACY_URL = WEBSITE_URL;
const TERMS_URL = WEBSITE_URL;

async function openExternalLink(url, label) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Error", `Cannot open ${label}.`);
      return;
    }
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert("Error", `Failed to open ${label}.`);
  }
}

export default function AboutScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.nativeAppVersion ||
    "0.0.0";

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="About"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/pikup-logo.png")}
              style={styles.logo}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate("CustomerHelpScreen")}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.rowTitle}>Help & Support</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate("CustomerSafetyScreen")}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.rowTitle}>Safety</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => openExternalLink(PRIVACY_URL, "Privacy Policy")}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.rowTitle}>Privacy Policy</Text>
              </View>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => openExternalLink(TERMS_URL, "Terms of Service")}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.rowTitle}>Terms of Service</Text>
              </View>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APP</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => openExternalLink(WEBSITE_URL, "Pikup website")}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.rowTitle}>Pikup Website</Text>
              </View>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version {appVersion}</Text>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  brandSection: {
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xl,
    marginBottom: spacing.base,
  },
  logoContainer: {
    width: spacing.xxxl * 2,
    height: spacing.xxxl * 2,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  logo: {
    width: spacing.xxxl * 2 - spacing.xs,
    height: spacing.xxxl * 2 - spacing.xs,
    resizeMode: "contain",
  },
  section: {
    marginBottom: spacing.base,
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    gap: spacing.md,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  rowTitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.strong,
  },
  versionContainer: {
    paddingTop: spacing.base,
    alignItems: "center",
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
});
