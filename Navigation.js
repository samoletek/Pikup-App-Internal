import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "./contexts/AuthContext";
import { colors } from "./styles/theme";
import { stackScreenOptions } from "./navigation/navigationTheme";

// Shared screens
import WelcomeScreen from "./screens/shared/WelcomeScreen";
import AuthScreen from "./screens/shared/AuthScreen";
// RoleSelectionScreen removed - role selection is now on WelcomeScreen
import MessageScreen from "./screens/shared/MessageScreen";
import DeliveryFeedbackScreen from "./screens/shared/DeliveryFeedbackScreen";
// TermsAndPrivacyScreen removed - opens via Linking.openURL now

// Import Tab Navigators
import CustomerTabNavigator from "./navigation/CustomerTabNavigator";
import DriverTabNavigator from "./navigation/DriverTabNavigator";

// Customer screens
import CustomerActivityScreen from "./screens/customer/CustomerActivityScreen";
import CustomerMessagesScreen from "./screens/customer/CustomerMessagesScreen";
import CustomerClaimsScreen from "./screens/customer/CustomerClaimsScreen";
import CustomerHelpScreen from "./screens/customer/CustomerHelpScreen";
import CustomerWalletScreen from "./screens/customer/CustomerWalletScreen";
import CustomerPersonalInfoScreen from "./screens/customer/CustomerPersonalInfoScreen";
import CustomerSafetyScreen from "./screens/customer/CustomerSafetyScreen";
import CustomerSettingsScreen from "./screens/customer/CustomerSettingsScreen";
import PaymentMethodsScreen from "./screens/customer/PaymentMethodsScreen";
import OrderSummaryScreen from "./screens/customer/OrderSummaryScreen";
import CustomerTripDetailsScreen from "./screens/customer/CustomerTripDetailsScreen";

// Driver screens
import DriverMessagesScreen from "./screens/driver/DriverMessagesScreen";
import DriverPreferencesScreen from "./screens/driver/DriverPreferencesScreen";
import DriverEarningsScreen from "./screens/driver/DriverEarningsScreen";
import RouteConfirmationScreen from "./screens/driver/RouteConfirmationScreen";
import EnRouteToPickupScreen from "./screens/driver/EnRouteToPickupScreen";
import GpsNavigationScreen from "./screens/driver/GpsNavigationScreen";
import PickupConfirmationScreen from "./screens/driver/PickupConfirmationScreen";
import DeliveryNavigationScreen from "./screens/driver/DeliveryNavigationScreen";
import DeliveryConfirmationScreen from "./screens/driver/DeliveryConfirmationScreen";
import DriverOnboardingScreen from "./screens/driver/DriverOnboardingScreen";
import DriverOnboardingCompleteScreen from "./screens/driver/DriverOnboardingCompleteScreen";
import DriverPaymentSettingsScreen from "./screens/driver/DriverPaymentSettingsScreen";

const Stack = createNativeStackNavigator();

// 1. Auth Stack (Unauthenticated)
const AuthStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
    <Stack.Screen name="AuthScreen" component={AuthScreen} />
  </Stack.Navigator>
);

// 2. Customer Stack (Authenticated as Customer)
const CustomerStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />

    {/* Customer Specific Screens */}
    <Stack.Screen name="CustomerActivityScreen" component={CustomerActivityScreen} />
    <Stack.Screen name="CustomerMessagesScreen" component={CustomerMessagesScreen} />
    <Stack.Screen name="CustomerClaimsScreen" component={CustomerClaimsScreen} />

    {/* Customer Profile Screens */}
    <Stack.Screen name="CustomerHelpScreen" component={CustomerHelpScreen} />
    <Stack.Screen name="CustomerWalletScreen" component={CustomerWalletScreen} />
    <Stack.Screen name="CustomerPersonalInfoScreen" component={CustomerPersonalInfoScreen} />
    <Stack.Screen name="CustomerSafetyScreen" component={CustomerSafetyScreen} />
    <Stack.Screen name="CustomerSettingsScreen" component={CustomerSettingsScreen} />
    <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />

    {/* Shared / Interaction Screens */}
    <Stack.Screen name="MessageScreen" component={MessageScreen} />
    <Stack.Screen name="DeliveryFeedbackScreen" component={DeliveryFeedbackScreen} />
    <Stack.Screen name="OrderSummaryScreen" component={OrderSummaryScreen} />
    <Stack.Screen name="CustomerTripDetailsScreen" component={CustomerTripDetailsScreen} />
  </Stack.Navigator>
);

// 3. Driver Stack (Authenticated as Driver)
const DriverStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="DriverTabs" component={DriverTabNavigator} />

    {/* Driver Specific Screens */}
    <Stack.Screen name="DriverMessagesScreen" component={DriverMessagesScreen} />
    <Stack.Screen name="DriverPreferencesScreen" component={DriverPreferencesScreen} />
    <Stack.Screen name="DriverEarningsScreen" component={DriverEarningsScreen} />
    <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />
    <Stack.Screen name="CustomerHelpScreen" component={CustomerHelpScreen} />
    <Stack.Screen name="CustomerPersonalInfoScreen" component={CustomerPersonalInfoScreen} />
    <Stack.Screen name="CustomerSafetyScreen" component={CustomerSafetyScreen} />
    <Stack.Screen name="CustomerSettingsScreen" component={CustomerSettingsScreen} />

    {/* Trip Execution Flow */}
    <Stack.Screen name="RouteConfirmationScreen" component={RouteConfirmationScreen} />
    <Stack.Screen name="EnRouteToPickupScreen" component={EnRouteToPickupScreen} />
    <Stack.Screen name="GpsNavigationScreen" component={GpsNavigationScreen} />
    <Stack.Screen name="PickupConfirmationScreen" component={PickupConfirmationScreen} />
    <Stack.Screen name="DeliveryNavigationScreen" component={DeliveryNavigationScreen} />
    <Stack.Screen name="DeliveryConfirmationScreen" component={DeliveryConfirmationScreen} />

    {/* Onboarding */}
    <Stack.Screen name="DriverOnboardingScreen" component={DriverOnboardingScreen} />
    <Stack.Screen name="DriverOnboardingCompleteScreen" component={DriverOnboardingCompleteScreen} />
    <Stack.Screen name="DriverPaymentSettingsScreen" component={DriverPaymentSettingsScreen} />

    {/* Shared */}
    <Stack.Screen name="MessageScreen" component={MessageScreen} />
  </Stack.Navigator>
);

export default function Navigation() {
  const { isInitializing, currentUser, userType } = useAuth();

  console.log('🎯 Navigation render - isInitializing:', isInitializing, 'currentUser:', !!currentUser ? currentUser.email : 'null', 'userType:', userType);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require("./assets/pikup-logo.png")} style={styles.loadingLogo} />
      </View>
    );
  }

  // Strict Role Separation Logic
  if (currentUser && userType === 'driver') {
    return <DriverStack />;
  }

  if (currentUser && userType === 'customer') {
    return <CustomerStack />;
  }

  // Default to Auth Stack if not logged in or role unknown
  return <AuthStack />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
  },
  loadingLogo: {
    width: "80%",
    height: 250,
    resizeMode: "contain",
  },
});
