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
import { useAuth } from "../contexts/AuthContext";

export default function CustomerSettingsScreen({ navigation }) {
  const { currentUser } = useAuth();
  
  const [settings, setSettings] = useState({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      promotions: false,
      tripUpdates: true,
      accountActivity: true,
    },
    language: "English",
    currency: "USD",
  });

  const toggleSetting = (category, setting) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [setting]: !settings[category][setting],
      },
    });
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear App Data",
      "This will clear all cached data and reset preferences. This action cannot be undone. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: () => {
            // In a real app, this would clear cached data
            Alert.alert("Success", "App data has been cleared.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerPersonalInfoScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Personal Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="globe-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Language</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{settings.language}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="cash-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Currency</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{settings.currency}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications on your device
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.pushNotifications ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "pushNotifications")}
              value={settings.notifications.pushNotifications}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Email Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications via email
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.emailNotifications ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "emailNotifications")}
              value={settings.notifications.emailNotifications}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>SMS Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications via text message
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.smsNotifications ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "smsNotifications")}
              value={settings.notifications.smsNotifications}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Promotions and Offers</Text>
              <Text style={styles.settingDescription}>
                Receive promotional messages and special offers
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.promotions ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "promotions")}
              value={settings.notifications.promotions}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Trip Updates</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about your trips
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.tripUpdates ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "tripUpdates")}
              value={settings.notifications.tripUpdates}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Account Activity</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about account changes
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#2A2A3B", true: "#2A1F3D" }}
              thumbColor={settings.notifications.accountActivity ? "#A77BFF" : "#f4f3f4"}
              ios_backgroundColor="#2A2A3B"
              onValueChange={() => toggleSetting("notifications", "accountActivity")}
              value={settings.notifications.accountActivity}
            />
          </View>
        </View>


        {/* About and Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About & Legal</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>About PikUp</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('TermsAndPrivacyScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('TermsAndPrivacyScreen')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Data & Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="analytics-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Data Usage</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="download-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Download My Data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.clearDataButton}
            onPress={handleClearData}
          >
            <Text style={styles.clearDataText}>Clear App Data</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>PikUp App v1.0.0</Text>
        </View>

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
  section: {
    backgroundColor: "#141426",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemTitle: {
    fontSize: 16,
    color: "#fff",
    marginLeft: 12,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuItemValue: {
    fontSize: 14,
    color: "#999",
    marginRight: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  clearDataButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  clearDataText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#ff4444",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 14,
    color: "#666",
  },
  bottomSpacing: {
    height: 40,
  },
}); 