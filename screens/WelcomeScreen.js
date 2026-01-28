import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';

export default function WelcomeScreen({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState("customer");
  const { currentUser, userType, checkTermsAcceptance, getDriverProfile } = useAuth();

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  // Navigate after successful login
  useEffect(() => {
    console.log('🔍 WelcomeScreen - currentUser:', !!currentUser, 'userType:', userType);

    if (currentUser && userType) {
      console.log('User logged in, navigating...');

      const navigateAfterLogin = async () => {
        try {
          // Check for terms acceptance first
          const termsStatus = await checkTermsAcceptance(currentUser.uid);
          console.log('Terms status:', termsStatus);

          if (termsStatus.needsAcceptance) {
            console.log('Navigating to ConsentGate');
            navigation.replace('ConsentGate', {
              missingVersions: termsStatus.missingVersions,
              role: userType
            });
            return;
          }

          if (userType === "driver") {
            console.log('User is driver, checking profile...');
            const driverProfile = await getDriverProfile(currentUser.uid);
            if (driverProfile?.onboardingComplete) {
              console.log('Navigating to DriverTabs');
              navigation.replace("DriverTabs");
            } else {
              console.log('Navigating to DriverOnboarding');
              navigation.replace("DriverOnboarding");
            }
          } else {
            console.log('Navigating to CustomerTabs');
            navigation.replace("CustomerTabs");
          }
        } catch (error) {
          console.error("Navigation error:", error);
          // Fallback
          if (userType === "driver") navigation.replace("DriverTabs");
          else navigation.replace("CustomerTabs");
        }
      };

      navigateAfterLogin();
    }
  }, [currentUser, userType, navigation]);

  return (
    <LinearGradient
      colors={['#0A0A1F', '#141426']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/pikup-logo.png")}
              style={styles.logo}
              accessible
              accessibilityLabel="PikUp"
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleRoleSelection("customer")}
          >
            <Text style={styles.buttonText}>Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.driverButton]}
            onPress={() => handleRoleSelection("driver")}
          >
            <Text style={styles.buttonText}>Driver</Text>
          </TouchableOpacity>
        </View>

        {/* New Linkble-style Auth Modal */}
        <AuthModal
          visible={modalVisible}
          onClose={closeModal}
          selectedRole={selectedRole}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: 'flex-end',
  },
  logoWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  logoContainer: {
    width: "100%",
    alignItems: "center",
    shadowColor: "rgba(167,123,255,0.6)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: '80%',
    height: 250,
    resizeMode: "contain",
  },
  buttonContainer: {
    width: "100%",
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: "center",
    marginBottom: 50,
  },
  button: {
    backgroundColor: "#A77BFF",
    paddingVertical: 16,
    borderRadius: 30, // Restored pill shape matching Linkble
    width: "40%",
    alignItems: "center",
    shadowColor: "#A77BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  driverButton: {
    backgroundColor: "#7A45FF",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
