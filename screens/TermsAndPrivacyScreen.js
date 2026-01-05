// screens/TermsAndPrivacyScreen.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function TermsAndPrivacyScreen({ navigation }) {
  return (
    <LinearGradient
      colors={["#0A0A1F", "#141426"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#EAEAF2" />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Terms & Privacy</Text>

          {/* Spacer to balance header layout */}
          <View style={{ width: 64 }} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Terms of Service */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms of Service</Text>

            <Text style={styles.sectionText}>
              Welcome to PikUp. Please read these Terms carefully before using our
              application and related services. By creating an account or using the
              app, you agree to these Terms.
            </Text>

            <Text style={styles.subheading}>1. Eligibility</Text>
            <Text style={styles.sectionText}>
              To use the Services, you must:
              {"\n"}• Be at least 18 years old (or the age of majority in your
              jurisdiction).
              {"\n"}• Provide accurate account information.
              {"\n"}• Use the Services in compliance with applicable laws.
            </Text>

            <Text style={styles.subheading}>2. Services Provided</Text>
            <Text style={styles.sectionText}>
              PikUp connects customers with drivers for pickup and delivery. PikUp
              is a technology platform and does not provide transportation services
              itself. Drivers are independent providers.
            </Text>

            <Text style={styles.subheading}>3. User Conduct</Text>
            <Text style={styles.sectionText}>
              You agree not to misuse the Services. Prohibited behaviors include:
              {"\n"}• Fraud, misrepresentation, or illegal activity.
              {"\n"}• Interfering with platform security or operations.
              {"\n"}• Harassment or unsafe behavior towards others.
            </Text>

            <Text style={styles.subheading}>4. Payments & Fees</Text>
            <Text style={styles.sectionText}>
              Pricing, fees, and payment processing details are shown during
              checkout. By confirming a booking, you authorize the applicable
              charges.
            </Text>
          </View>

          {/* Privacy Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Policy</Text>

            <Text style={styles.metaText}>Effective Date: Jan 1, 2025</Text>

            <Text style={styles.sectionText}>
              This Privacy Policy explains how we collect, use, and protect your
              information when you use PikUp.
            </Text>

            <Text style={styles.subheading}>1. Data We Collect</Text>
            <Text style={styles.sectionText}>
              We may collect:
              {"\n"}• Account info (name, email, phone).
              {"\n"}• Location data for routing and safety (with your permission).
              {"\n"}• Usage, device, and diagnostic data to improve the app.
            </Text>

            <Text style={styles.subheading}>2. How We Use Data</Text>
            <Text style={styles.sectionText}>
              We use data to operate and improve the Services, support safety,
              process payments, provide customer support, and comply with legal
              obligations.
            </Text>

            <Text style={styles.subheading}>3. Sharing</Text>
            <Text style={styles.sectionText}>
              We may share data with service providers (e.g., payments, mapping)
              and as required by law. We do not sell your personal data.
            </Text>

            <Text style={styles.subheading}>4. Your Choices</Text>
            <Text style={styles.sectionText}>
              You can update your account info, manage permissions (like location),
              and request data access or deletion where applicable.
            </Text>
          </View>

          {/* Driver Terms (if applicable) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Terms (If You Register as a Driver)</Text>

            <Text style={styles.subheading}>1. Independent Contractor</Text>
            <Text style={styles.sectionText}>
              Drivers are independent contractors and not employees of PikUp.
            </Text>

            <Text style={styles.subheading}>2. Compliance & Safety</Text>
            <Text style={styles.sectionText}>
              Drivers must comply with applicable laws, maintain required licenses
              and insurance, and follow safety guidelines.
            </Text>

            <Text style={styles.subheading}>3. Payouts</Text>
            <Text style={styles.sectionText}>
              Payouts are processed according to the payment settings and schedule
              shown in the app. Fees and commissions may apply.
            </Text>
          </View>

          {/* Footer actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.primaryButtonText}>Return</Text>
            </TouchableOpacity>

            {/* Optional: link out to a hosted version */}
            {/* <TouchableOpacity onPress={() => Linking.openURL('https://your-terms-url')}>
              <Text style={styles.link}>Open in Browser</Text>
            </TouchableOpacity> */}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backLabel: {
    color: "#EAEAF2",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  section: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  subheading: {
    color: "#C9C9D6",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  metaText: {
    color: "#A7A7BC",
    fontSize: 12,
    marginBottom: 6,
  },
  sectionText: {
    color: "#DADAE6",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    marginTop: 22,
    alignItems: "center",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#7B5CFF",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  link: {
    color: "#A77BFF",
    fontSize: 14,
    textDecorationLine: "underline",
    marginTop: 8,
  },
});
