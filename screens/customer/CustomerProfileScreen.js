import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";

export default function CustomerProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
    <View style={styles.container}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top,
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: '#0A0A1F'
      }}>
        <Text style={{
          fontSize: 34,
          fontWeight: 'bold',
          color: '#fff'
        }}>
          Account
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card - Airbnb Style */}
        <View style={[styles.profileCard, { marginTop: 0 }]}>
          <View style={styles.profileCardContent}>
            {/* Left Side - Avatar & Info */}
            <View style={styles.profileLeftSide}>
              <TouchableOpacity
                style={styles.avatarContainer}
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
                {/* Verified Badge on Avatar */}
                <View style={styles.verifiedBadgeOnAvatar}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              </TouchableOpacity>

              <Text style={styles.userName}>{displayName}</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#A77BFF" />
                <Text style={styles.ratingText}>{customerProfile?.rating || '5.0'}</Text>
              </View>
            </View>

            {/* Right Side - Stats */}
            <View style={styles.statsColumn}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{customerProfile?.totalTrips || '0'}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{customerProfile?.totalReviews || '0'}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{customerProfile?.yearsOnApp || '1'}</Text>
                <Text style={styles.statLabel}>Years on Pikup</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerHelpScreen")}
          >
            <Ionicons name="help-circle-outline" size={32} color="#A77BFF" />
            <Text style={styles.actionText}>Help</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("CustomerWalletScreen")}
          >
            <Ionicons name="wallet-outline" size={32} color="#A77BFF" />
            <Text style={styles.actionText}>Wallet</Text>
          </TouchableOpacity>
        </View>


        {/* Menu Sections */}
        <View style={styles.menuSections}>
          {/* View Profile */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerPersonalInfoScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>View Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("CustomerSettingsScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* My Addresses */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Home")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="location-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>My Addresses</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* My Orders */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("Activity")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="receipt-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>My Orders</Text>
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

          {/* Claims */}
          <TouchableOpacity style={styles.menuItem} onPress={handleClaimsPress}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Claims</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("TermsAndPrivacyScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("TermsAndPrivacyScreen")}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          {/* About Pikup */}
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={20} color="#A77BFF" />
              <Text style={styles.menuItemTitle}>About Pikup</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
      </ScrollView>
    </View>
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
  profileCard: {
    backgroundColor: "#141426",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    padding: 20,
  },
  profileCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profileLeftSide: {
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileInitials: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#A77BFF",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitialsText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "600",
  },
  verifiedBadgeOnAvatar: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#A77BFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#141426",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "capitalize",
    marginTop: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 4,
  },
  statsColumn: {
    alignItems: "flex-start",
    paddingLeft: 10,
  },
  statItem: {
    paddingVertical: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  statDivider: {
    width: 120,
    height: 1,
    backgroundColor: "#2A2A3B",
  },
  quickActions: {
    flexDirection: "row",
    backgroundColor: "#141426",
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: "space-around",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 8,
  },
  actionDivider: {
    width: 1,
    height: 50,
    backgroundColor: "#2A2A3B",
  },
  menuSections: {
    backgroundColor: "#141426",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    overflow: "hidden",
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
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    color: "#ff4444",
    fontWeight: "500",
    textAlign: "center",
  },
  bottomSpacing: {
    height: 40,
  },
});
