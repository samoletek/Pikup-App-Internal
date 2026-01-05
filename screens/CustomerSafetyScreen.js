import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CustomerSafetyScreen({ navigation }) {
  const [safetySettings, setSafetySettings] = useState({
    tripSharing: true,
    emergencyContacts: true,
    rideCheck: true,
    audioRecording: false,
    verifyPin: true,
  });

  const toggleSwitch = (setting) => {
    setSafetySettings({
      ...safetySettings,
      [setting]: !safetySettings[setting],
    });
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      "Emergency Call",
      "This will connect you to emergency services. Do you want to proceed?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call Emergency", style: "destructive" },
      ]
    );
  };

  const safetyTips = [
    {
      id: "1",
      title: "Verify Driver and Vehicle",
      description: "Always check the driver's photo, name, and vehicle details before entering.",
      icon: "car-outline",
    },
    {
      id: "2",
      title: "Share Trip Status",
      description: "Let friends or family know your trip details and estimated arrival time.",
      icon: "share-outline",
    },
    {
      id: "3",
      title: "Stay in Well-Lit Areas",
      description: "For pickups and drop-offs, choose well-lit and populated locations.",
      icon: "sunny-outline",
    },
    {
      id: "4",
      title: "Trust Your Instincts",
      description: "If something feels wrong, cancel the ride and request a new one.",
      icon: "shield-checkmark-outline",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Center</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency Section */}
        <TouchableOpacity 
          style={styles.emergencyButton}
          onPress={handleEmergencyCall}
        >
          <View style={styles.emergencyContent}>
            <View style={styles.emergencyIcon}>
              <Ionicons name="call" size={24} color="#fff" />
            </View>
            <View style={styles.emergencyTextContainer}>
              <Text style={styles.emergencyTitle}>Emergency Assistance</Text>
              <Text style={styles.emergencyDescription}>
                Call emergency services immediately
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Safety Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Features</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Trip Sharing</Text>
              <Text style={styles.settingDescription}>
                Share your trip details with trusted contacts
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={safetySettings.tripSharing ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("tripSharing")}
              value={safetySettings.tripSharing}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Emergency Contacts</Text>
              <Text style={styles.settingDescription}>
                Add contacts who can be notified in case of emergency
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={safetySettings.emergencyContacts ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("emergencyContacts")}
              value={safetySettings.emergencyContacts}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Ride Check</Text>
              <Text style={styles.settingDescription}>
                Get notifications if your ride takes unexpected routes
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={safetySettings.rideCheck ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("rideCheck")}
              value={safetySettings.rideCheck}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Audio Recording</Text>
              <Text style={styles.settingDescription}>
                Record audio during rides for safety purposes
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={safetySettings.audioRecording ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("audioRecording")}
              value={safetySettings.audioRecording}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Verify PIN</Text>
              <Text style={styles.settingDescription}>
                Require a PIN from drivers before starting trips
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={safetySettings.verifyPin ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSwitch("verifyPin")}
              value={safetySettings.verifyPin}
            />
          </View>
        </View>

        {/* Trusted Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trusted Contacts</Text>
            <TouchableOpacity>
              <Text style={styles.addText}>Add New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contactsContainer}>
            <View style={styles.contactItem}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>J</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>Jane Smith</Text>
                <Text style={styles.contactRelation}>Family</Text>
              </View>
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="create-outline" size={20} color="#A77BFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.contactItem}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>M</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>Mike Johnson</Text>
                <Text style={styles.contactRelation}>Friend</Text>
              </View>
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="create-outline" size={20} color="#A77BFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Safety Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>

          {safetyTips.map((tip) => (
            <View key={tip.id} style={styles.tipItem}>
              <View style={styles.tipIconContainer}>
                <Ionicons name={tip.icon} size={24} color="#A77BFF" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Report Safety Issue */}
        <TouchableOpacity style={styles.reportButton}>
          <Ionicons name="alert-circle-outline" size={24} color="#A77BFF" />
          <Text style={styles.reportText}>Report a Safety Issue</Text>
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
  emergencyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3D2A2A",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4D3A3A",
  },
  emergencyContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ff4444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  emergencyTextContainer: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 14,
    color: "#ccc",
  },
  section: {
    backgroundColor: "#141426",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 16,
  },
  addText: {
    fontSize: 14,
    color: "#A77BFF",
    fontWeight: "500",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: "#999",
  },
  contactsContainer: {
    marginTop: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A1F3D",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactInitial: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#A77BFF",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  contactRelation: {
    fontSize: 14,
    color: "#999",
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  tipItem: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "#1A1A3A",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2A1F3D",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 14,
    color: "#999",
    lineHeight: 20,
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1A3A",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  reportText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#A77BFF",
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
}); 