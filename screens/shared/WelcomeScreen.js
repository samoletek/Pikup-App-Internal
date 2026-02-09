import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthModal from '../../components/AuthModal';
import { useAuth } from '../../contexts/AuthContext';
import { colors, layout, spacing, typography } from '../../styles/theme';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState("customer");
  const { currentUser, userType, getDriverProfile } = useAuth();

  const isCompact = width < 370;
  const logoWidth = Math.min(Math.max(width * 0.58, 180), 280);
  const contentMaxWidth = Math.min(layout.authMaxWidth, width - spacing.xl * 2);

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  // Navigate after successful login
  useEffect(() => {
    // Don't navigate if modal is open (AuthModal will handle navigation)
    if (modalVisible) {
      return;
    }

    if (currentUser && userType) {
      const navigateAfterLogin = async () => {
        try {
          if (userType === "driver") {
            const driverProfile = await getDriverProfile(currentUser.uid || currentUser.id);
            if (driverProfile?.onboardingComplete) {
              navigation.replace("DriverTabs");
            } else {
              navigation.replace("DriverOnboardingScreen");
            }
          } else {
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
  }, [currentUser, userType, navigation, modalVisible]);

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={styles.container}
    >
      <View
        style={[
          styles.safeArea,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            maxWidth: contentMaxWidth,
            alignSelf: "center",
          },
        ]}
      >
        <View style={styles.logoWrapper}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/pikup-logo.png")}
              style={[styles.logo, { width: logoWidth }]}
              accessible
              accessibilityLabel="PikUp"
            />
            <Text style={[styles.tagline, isCompact && styles.taglineCompact]}>Moving made simple.</Text>
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
        <View style={[styles.buttonContainer, isCompact && styles.buttonContainerCompact]}>
          <TouchableOpacity
            style={[styles.button, isCompact && styles.buttonCompact]}
            onPress={() => handleRoleSelection("customer")}
          >
            <Text style={styles.buttonText}>Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.driverButton, isCompact && styles.buttonCompact]}
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
    width: "100%",
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    height: 170,
    resizeMode: "contain",
  },
  tagline: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    marginTop: -10, // Pull it up closer to logos
    textTransform: 'uppercase',
    textAlign: 'center',
    opacity: 0.8, // Slightly more subtle
  },
  taglineCompact: {
    fontSize: typography.fontSize.xs + 1,
    letterSpacing: 1.1,
  },
  buttonContainer: {
    width: "100%",
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: "center",
    marginBottom: spacing.xxl + spacing.sm,
    gap: spacing.sm,
  },
  buttonContainerCompact: {
    flexDirection: "column",
    gap: spacing.md,
    marginBottom: spacing.xl + spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.base,
    borderRadius: 30,
    flex: 1,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonCompact: {
    width: "100%",
    flex: 0,
  },
  driverButton: {
    backgroundColor: colors.primaryDark,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
