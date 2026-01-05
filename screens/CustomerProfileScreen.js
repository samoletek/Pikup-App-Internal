import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

export default function CustomerProfileScreen({ navigation }) {
  const { currentUser, logout, getUserProfile, profileImage, getProfileImage } = useAuth();
  const [customerProfile, setCustomerProfile] = useState(null);
  const [displayName, setDisplayName] = useState("User");

  useEffect(() => {
    loadCustomerProfile();
  }, []);

  const loadCustomerProfile = async () => {
    try {
      // Load user profile
      const profile = await getUserProfile?.(currentUser?.uid);
      setCustomerProfile(profile?.customerProfile || null);
      const name =
        profile?.name ||
        (profile?.firstName && profile?.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : currentUser?.email?.split("@")[0] || "User");
      setDisplayName(name);
      
      // Load profile image
      await getProfileImage?.();
    } catch (error) {
      console.error('Error loading customer profile:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: "WelcomeScreen" }],
          });
        },
      },
    ]);
  };

  const handleClaimsPress = () => {
    navigation.navigate("CustomerClaimsScreen");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.nameSection}>
            <Text style={styles.userName}>{displayName}</Text>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('CustomerPersonalInfoScreen')}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileInitials}>
                  <Text style={styles.profileInitialsText}>
                    {displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.ratingSection}>
            <View style={styles.ratingItem}>
              <Ionicons name="star" size={16} color="#A77BFF" />
              <Text style={styles.ratingText}>{customerProfile?.rating || '5.0'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {/* Profile Type Selector */}
          <TouchableOpacity style={styles.profileSelector}>
            <Text style={styles.profileSelectorText}>Personal</Text>
            <Ionicons name="person" size={16} color="#A77BFF" />
            <Ionicons
              name="chevron-down"
              size={20}
              color="#999"
              style={{ marginLeft: "auto" }}
            />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <Ionicons name="help-circle-outline" size={24} color="#A77BFF" />
            <Text style={styles.actionText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerWalletScreen")}
          >
            <Ionicons name="wallet-outline" size={24} color="#A77BFF" />
            <Text style={styles.actionText}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerActivityScreen")}
          >
            <Ionicons name="time-outline" size={24} color="#A77BFF" />
            <Text style={styles.actionText}>Activity</Text>
          </TouchableOpacity>
        </View>

        {/* Promo Section */}
        <View style={styles.promoSection}>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle}>Enjoy 17% off rides</Text>
            <Text style={styles.promoSubtitle}>
              Go rediscover your city for less →
            </Text>
          </View>
          <View style={styles.promoIcon}>
            <Text style={styles.promoIconText}>%</Text>
          </View>
        </View>

        {/* Menu Sections */}
        <View style={styles.menuSections}>
          {/* Payment Options */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerWalletScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="card-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Payment</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Personal Information */}
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

          {/* Claims - NEW */}
          <TouchableOpacity style={styles.menuItem} onPress={handleClaimsPress}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Claims</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Activity */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerActivityScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="time-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Activity</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Messages */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerMessagesScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubble-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Messages</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Terms & Privacy */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("TermsAndPrivacyScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#A77BFF"
              />
              <Text style={styles.menuItemTitle}>Terms & Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#141426",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  profileSection: {
    backgroundColor: "#141426",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  nameSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "capitalize",
  },
  profileButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A3A",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInitials: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#A77BFF",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitialsText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
  },
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  ratingItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: "#2A2A3B",
    marginHorizontal: 12,
  },
  verifiedBadge: {
    backgroundColor: "#1A3A2E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00D4AA",
  },
  profileSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A3A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileSelectorText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
    marginRight: 6,
  },
  quickActions: {
    flexDirection: "row",
    backgroundColor: "#141426",
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: "space-around",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },
  actionText: {
    fontSize: 12,
    color: "#fff",
    marginTop: 4,
  },
  promoSection: {
    backgroundColor: "#141426",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 14,
    color: "#999",
  },
  promoIcon: {
    width: 50,
    height: 50,
    backgroundColor: "#2A1F3D",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  promoIconText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#A77BFF",
  },
  menuSections: {
    backgroundColor: "#141426",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
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
  logoutButton: {
    backgroundColor: "#141426",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  logoutText: {
    fontSize: 16,
    color: "#ff4444",
    fontWeight: "500",
  },
  bottomSpacing: {
    height: 40,
  },
});
