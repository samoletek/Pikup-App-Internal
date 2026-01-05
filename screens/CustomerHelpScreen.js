import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const helpCategories = [
  {
    id: "1",
    title: "Account & Payment",
    icon: "card-outline",
    topics: ["Payment issues", "Account settings", "Billing questions"],
  },
  {
    id: "2",
    title: "Trip Issues",
    icon: "car-outline",
    topics: ["Driver feedback", "Lost items", "Trip adjustments"],
  },
  {
    id: "3",
    title: "Safety & Security",
    icon: "shield-checkmark-outline",
    topics: ["Report safety incident", "Emergency contacts", "Privacy concerns"],
  },
  {
    id: "4",
    title: "Promotions & Rewards",
    icon: "gift-outline",
    topics: ["Promo codes", "Referral program", "Loyalty rewards"],
  },
  {
    id: "5",
    title: "App Issues",
    icon: "bug-outline",
    topics: ["App not working", "Location problems", "Notification issues"],
  },
];

const FAQItems = [
  {
    id: "1",
    question: "How do I update my payment method?",
    answer: "Go to Account > Payment and tap 'Add Payment Method' to add a new card or payment option.",
  },
  {
    id: "2",
    question: "What if my driver doesn't arrive?",
    answer: "If your driver is significantly delayed, you can cancel the trip without penalty or contact support for assistance.",
  },
  {
    id: "3",
    question: "How do I report an item left in a vehicle?",
    answer: "Go to your trip history, select the trip, and tap 'Report Lost Item' to contact the driver.",
  },
];

export default function CustomerHelpScreen({ navigation }) {
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Support Contact */}
        <View style={styles.supportCard}>
          <View style={styles.supportIconContainer}>
            <Ionicons name="headset-outline" size={24} color="#A77BFF" />
          </View>
          <View style={styles.supportContent}>
            <Text style={styles.supportTitle}>24/7 Support</Text>
            <Text style={styles.supportSubtitle}>
              Our team is here to help
            </Text>
          </View>
          <TouchableOpacity style={styles.contactButton}>
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        </View>

        {/* Help Categories */}
        <Text style={styles.sectionTitle}>Help Categories</Text>
        <View style={styles.categoriesContainer}>
          {helpCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => {
                // Handle category selection
              }}
            >
              <View style={styles.categoryIcon}>
                <Ionicons name={category.icon} size={24} color="#A77BFF" />
              </View>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text style={styles.topicsCount}>
                {category.topics.length} topics
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqContainer}>
          {FAQItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.faqItem}
              onPress={() => {
                setExpandedFAQ(expandedFAQ === item.id ? null : item.id);
              }}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={
                    expandedFAQ === item.id
                      ? "chevron-up"
                      : "chevron-down"
                  }
                  size={20}
                  color="#A77BFF"
                />
              </View>
              {expandedFAQ === item.id && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency Section */}
        <TouchableOpacity style={styles.emergencyButton}>
          <Ionicons name="alert-circle-outline" size={24} color="#ff4444" />
          <Text style={styles.emergencyText}>Emergency Help</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#141426",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141426",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2A1F3D",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  supportSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  contactButton: {
    backgroundColor: "#A77BFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contactButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  categoryCard: {
    width: "45%",
    backgroundColor: "#141426",
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A1F3D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  topicsCount: {
    fontSize: 13,
    color: "#999",
  },
  faqContainer: {
    backgroundColor: "#141426",
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    overflow: "hidden",
  },
  faqItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "500",
    color: "#fff",
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
    lineHeight: 20,
  },
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A1F1F",
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#3D2A2A",
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff4444",
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
}); 