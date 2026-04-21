import React from "react";
import { View, Image, StyleSheet, ActivityIndicator, Text } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "./contexts/AuthContext";
import { logger } from "./services/logger";
import { colors, spacing } from "./styles/theme";
import { stackScreenOptions } from "./navigation/navigationTheme";

// Shared screens
import WelcomeScreen from "./screens/shared/WelcomeScreen";
import AuthScreen from "./screens/shared/AuthScreen";
import PersonalInfoScreen from "./screens/shared/PersonalInfoScreen";
import AboutScreen from "./screens/shared/AboutScreen";
import ResetPasswordScreen from "./screens/shared/ResetPasswordScreen";
// RoleSelectionScreen removed - role selection is now on WelcomeScreen
import MessageScreen from "./screens/shared/MessageScreen";
// TermsAndPrivacyScreen removed - opens via Linking.openURL now

// Import Tab Navigators
import CustomerTabNavigator from "./navigation/CustomerTabNavigator";
import DriverTabNavigator from "./navigation/DriverTabNavigator";

// Customer screens
import CustomerActivityScreen from "./screens/customer/CustomerActivityScreen";
import CustomerMessagesScreen from "./screens/customer/CustomerMessagesScreen";
import CustomerHelpScreen from "./screens/customer/CustomerHelpScreen";
import CustomerRewardsScreen from "./screens/customer/CustomerRewardsScreen";
import CustomerSavedAddressesScreen from "./screens/customer/CustomerSavedAddressesScreen";
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
import PickupConfirmationScreen from "./screens/driver/PickupConfirmationScreen";
import DeliveryConfirmationScreen from "./screens/driver/DeliveryConfirmationScreen";
import DriverOnboardingScreen from "./screens/driver/DriverOnboardingScreen";
import DriverOnboardingCompleteScreen from "./screens/driver/DriverOnboardingCompleteScreen";
import DriverPaymentSettingsScreen from "./screens/driver/DriverPaymentSettingsScreen";
import DriverRequestDetailsScreen from "./screens/driver/DriverRequestDetailsScreen";
import DriverRecentTripsScreen from "./screens/driver/DriverRecentTripsScreen";

const Stack = createNativeStackNavigator();

// 1. Auth Stack (Unauthenticated)
const AuthStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
    <Stack.Screen name="AuthScreen" component={AuthScreen} />
    <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />
  </Stack.Navigator>
);

// 2. Customer Stack (Authenticated as Customer)
const CustomerStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />

    {/* Customer Specific Screens */}
    <Stack.Screen name="CustomerActivityScreen" component={CustomerActivityScreen} />
    <Stack.Screen name="CustomerMessagesScreen" component={CustomerMessagesScreen} />
    {/* Claims are temporarily hidden in customer UI. */}

    {/* Customer Profile Screens */}
    <Stack.Screen name="CustomerHelpScreen" component={CustomerHelpScreen} />
    <Stack.Screen name="CustomerRewardsScreen" component={CustomerRewardsScreen} />
    <Stack.Screen name="CustomerSavedAddressesScreen" component={CustomerSavedAddressesScreen} />
    <Stack.Screen name="PersonalInfoScreen" component={PersonalInfoScreen} />
    <Stack.Screen name="AboutScreen" component={AboutScreen} />
    <Stack.Screen name="CustomerSafetyScreen" component={CustomerSafetyScreen} />
    <Stack.Screen name="CustomerSettingsScreen" component={CustomerSettingsScreen} />
    <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />
    <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />

    {/* Shared / Interaction Screens */}
    <Stack.Screen name="MessageScreen" component={MessageScreen} />
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
    <Stack.Screen name="PersonalInfoScreen" component={PersonalInfoScreen} />
    <Stack.Screen name="AboutScreen" component={AboutScreen} />
    <Stack.Screen name="CustomerSafetyScreen" component={CustomerSafetyScreen} />
    <Stack.Screen name="CustomerSettingsScreen" component={CustomerSettingsScreen} />
    <Stack.Screen name="ResetPasswordScreen" component={ResetPasswordScreen} />

    {/* Trip Execution Flow */}
    <Stack.Screen name="RouteConfirmationScreen" component={RouteConfirmationScreen} />
    <Stack.Screen name="EnRouteToPickupScreen" component={EnRouteToPickupScreen} />
    <Stack.Screen
      name="PickupConfirmationScreen"
      component={PickupConfirmationScreen}
      options={{ gestureEnabled: false }}
    />
    <Stack.Screen
      name="DeliveryConfirmationScreen"
      component={DeliveryConfirmationScreen}
      options={{ gestureEnabled: false }}
    />
    <Stack.Screen name="DriverRequestDetailsScreen" component={DriverRequestDetailsScreen} />
    <Stack.Screen name="DriverRecentTripsScreen" component={DriverRecentTripsScreen} />

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

  logger.debug(
    'Navigation',
    'render',
    { isInitializing, hasCurrentUser: !!currentUser, userType }
  );

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require("./assets/pikup-logo.png")} style={styles.loadingLogo} />
        <View style={styles.loadingIndicatorRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingLabel}>Loading your account...</Text>
        </View>
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
  loadingIndicatorRow: {
    marginTop: spacing.base,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingLabel: {
    color: colors.text.secondary,
    fontSize: 14,
  },
});
