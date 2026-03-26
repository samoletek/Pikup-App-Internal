import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import { useAuthIdentity, useMessagingActions } from "../../contexts/AuthContext";
import { logger } from "../../services/logger";
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from "../../styles/theme";

const FAQS = [
  {
    id: "1",
    question: "How do I book a move?",
    answer: "Go to the Home screen, enter pickup/dropoff details, select a vehicle, and confirm your request.",
  },
  {
    id: "2",
    question: "Can I cancel my request?",
    answer:
      "For now, you can cancel from Activity until loading starts at pickup. Drivers can also cancel at pickup if the address is wrong or if no one is available to help load when self-help was selected.",
  },
  {
    id: "3",
    question: "How are prices calculated?",
    answer: "Prices are based on distance, vehicle type, and current demand in your area.",
  },
];

export default function CustomerHelpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuthIdentity();
  const { createConversation } = useMessagingActions();
  const [expandedFaqId, setExpandedFaqId] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleFaq = (id) => {
    setExpandedFaqId(expandedFaqId === id ? null : id);
  };

  const handleContactSupport = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const currentUserId = currentUser?.uid || currentUser?.id;
      if (!currentUserId) {
        throw new Error("Session expired. Please sign in again.");
      }

      const currentUserName =
        currentUser?.first_name || currentUser?.email?.split("@")[0] || "User";

      // Use 'support' as the driverId for support chats
      // Use a constant UUID for the support driver
      const SUPPORT_DRIVER_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

      let conversationId;
      let usedSupportId = SUPPORT_DRIVER_ID;

      try {
        conversationId = await createConversation(
          null,
          currentUserId,
          SUPPORT_DRIVER_ID,
          currentUserName,
          "Support",
          { suppressLog: true }
        );
      } catch (err) {
        // If hardcoded ID fails (FK constraint), fallback to Self-Chat (Note-to-Self)
        // This allows testing the UI flow without a real support user in DB
        if (err.message && (err.message.includes("foreign key") || err.code === "23503")) {
          logger.warn("CustomerHelpScreen", "Support ID not found, falling back to Self-Support (Note-to-Self)");
          usedSupportId = currentUserId;
          conversationId = await createConversation(
            null,
            currentUserId,
            usedSupportId, // driverId = customerId
            currentUserName,
            "Support",
            { suppressLog: true }
          );
        } else {
          throw err;
        }
      }

      navigation.navigate("MessageScreen", {
        conversationId,
        driverId: usedSupportId,
        driverName: "Support",
      });
    } catch (error) {
      logger.error("CustomerHelpScreen", "Error creating support chat", error);
      Alert.alert("Error", "Could not start support chat. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Help & Support"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq) => {
              const isExpanded = expandedFaqId === faq.id;
              return (
                <TouchableOpacity
                  key={faq.id}
                  style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
                  onPress={() => toggleFaq(faq.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </View>
                  {isExpanded && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>
            Our support team is available 24/7 to assist you.
          </Text>

          <AppButton
            title={loading ? "Starting Chat..." : "Chat with Support"}
            style={[styles.contactButton, loading && styles.contactButtonDisabled]}
            onPress={handleContactSupport}
            disabled={loading}
            leftIcon={<Ionicons name="chatbubbles-outline" size={24} color={colors.white} />}
          />
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
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  faqList: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  faqItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  faqItemExpanded: {
    backgroundColor: colors.background.tertiary,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  contactSection: {
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  contactSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  contactButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    width: "100%",
    justifyContent: "center",
  },
  contactButtonDisabled: {
    opacity: 0.7,
  },
});
