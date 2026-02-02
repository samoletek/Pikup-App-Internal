import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthModal from '../../components/AuthModal';
import { useAuth } from '../../contexts/AuthContext';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
    console.log('🔍 WelcomeScreen useEffect - currentUser:', !!currentUser, 'userType:', userType, 'currentUser.uid:', currentUser?.uid);

    // Don't navigate if modal is open (AuthModal will handle navigation)
    if (modalVisible) {
      console.log('⏸️ Modal is open, skipping navigation');
      return;
    }

    if (currentUser && userType) {
      console.log('✅ WelcomeScreen - User logged in, navigating...', { userType, uid: currentUser.uid });

      const navigateAfterLogin = async () => {
        try {
          // Check for terms acceptance first
          const termsStatus = await checkTermsAcceptance(currentUser.uid);
          console.log('Terms status:', termsStatus);

          if (termsStatus.needsAcceptance) {
            console.log('Navigating to ConsentGateScreen');
            navigation.replace('ConsentGateScreen', {
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
    } else {
      console.log('⏳ WelcomeScreen - Waiting for auth state...', { hasUser: !!currentUser, userType });
    }
  }, [currentUser, userType, navigation, modalVisible]);

  return (
    <LinearGradient
      colors={['#0A0A1F', '#141426']}
      style={styles.container}
    >
      <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/pikup-logo.png")}
              style={styles.logo}
              accessible
              accessibilityLabel="PikUp"
            />
            <Text style={styles.tagline}>Moving made simple.</Text>
          </View>
        </View>

        {/* Auth Modal */}
        <AuthModal
          visible={modalVisible}
          selectedRole={selectedRole}
          onClose={closeModal}
          navigation={navigation}
        />

        {/* Buttons */}
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
      </View>
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
    paddingBottom: '20%',
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
    width: '60%',
    height: 170,
    resizeMode: "contain",
  },
  tagline: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    marginTop: -10, // Pull it up closer to logos
    textTransform: 'uppercase',
    textAlign: 'center',
    opacity: 0.8, // Slightly more subtle
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
    borderRadius: 30,
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
