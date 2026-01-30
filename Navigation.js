import React from "react";
import { View, Image } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "./contexts/AuthContext";

import WelcomeScreen from "./screens/WelcomeScreen";
import AuthScreen from "./screens/AuthScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";

// Import Tab Navigators
import CustomerTabNavigator from "./navigation/CustomerTabNavigator";
import DriverTabNavigator from "./navigation/DriverTabNavigator";

// Import individual screens for the activity and messages
import CustomerActivityScreen from "./screens/CustomerActivityScreen";
import CustomerMessagesScreen from "./screens/CustomerMessagesScreen";
import DriverMessagesScreen from "./screens/DriverMessagesScreen";

// Import other screens
import DriverPreferencesScreen from "./screens/DriverPreferencesScreen";
import DriverEarningsScreen from "./screens/DriverEarningsScreen";
import PaymentMethodsScreen from "./screens/PaymentMethodsScreen";
import RouteConfirmationScreen from "./screens/RouteConfirmationScreen";
import MessageScreen from "./screens/MessageScreen";
import DeliveryFeedbackScreen from "./screens/DeliveryFeedbackScreen";
import DeliveryTrackingScreen from "./screens/DeliveryTrackingScreen";
import EnRouteToPickupScreen from "./screens/EnRouteToPickupScreen";
import GpsNavigationScreen from "./screens/GpsNavigationScreen";

// NEW SCREENS - Add these imports
import PickupConfirmationScreen from "./screens/PickupConfirmationScreen";
import DeliveryNavigationScreen from "./screens/DeliveryNavigationScreen";
import DeliveryConfirmationScreen from "./screens/DeliveryConfirmationScreen";
import CustomerClaimsScreen from "./screens/CustomerClaimsScreen";

// CUSTOMER PROFILE SCREENS - Add these imports
import CustomerHelpScreen from "./screens/CustomerHelpScreen";
import CustomerWalletScreen from "./screens/CustomerWalletScreen";
import CustomerPersonalInfoScreen from "./screens/CustomerPersonalInfoScreen";
import CustomerSafetyScreen from "./screens/CustomerSafetyScreen";
import CustomerSettingsScreen from "./screens/CustomerSettingsScreen";

// DRIVER ONBOARDING SCREENS - Add these imports
import DriverOnboardingScreen from "./screens/DriverOnboardingScreen";
import DriverOnboardingCompleteScreen from "./screens/DriverOnboardingCompleteScreen";
import DriverPaymentSettingsScreen from "./screens/DriverPaymentSettingsScreen";

// TERMS AND PRIVACY SCREEN
import TermsAndPrivacyScreen from "./screens/TermsAndPrivacyScreen";

const Stack = createNativeStackNavigator();

// 1. Auth Stack (Unauthenticated)
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
    <Stack.Screen name="AuthScreen" component={AuthScreen} />
    <Stack.Screen name="RoleSelectionScreen" component={RoleSelectionScreen} />
    <Stack.Screen name="TermsAndPrivacyScreen" component={TermsAndPrivacyScreen} />
  </Stack.Navigator>
);

// 2. Customer Stack (Authenticated as Customer)
const CustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
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

    {/* Shared / Interaction Screens */}
    <Stack.Screen name="MessageScreen" component={MessageScreen} />
    <Stack.Screen name="DeliveryFeedbackScreen" component={DeliveryFeedbackScreen} />
    <Stack.Screen name="DeliveryTrackingScreen" component={DeliveryTrackingScreen} />
    <Stack.Screen name="TermsAndPrivacyScreen" component={TermsAndPrivacyScreen} />
  </Stack.Navigator>
);

// 3. Driver Stack (Authenticated as Driver)
const DriverStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverTabs" component={DriverTabNavigator} />

    {/* Driver Specific Screens */}
    <Stack.Screen name="DriverMessagesScreen" component={DriverMessagesScreen} />
    <Stack.Screen name="DriverPreferencesScreen" component={DriverPreferencesScreen} />
    <Stack.Screen name="DriverEarningsScreen" component={DriverEarningsScreen} />
    <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />

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
    <Stack.Screen name="TermsAndPrivacyScreen" component={TermsAndPrivacyScreen} />
  </Stack.Navigator>
);

export default function Navigation() {
  const { isInitializing, currentUser, userType } = useAuth();

  console.log('🎯 Navigation render - isInitializing:', isInitializing, 'currentUser:', !!currentUser ? currentUser.email : 'null', 'userType:', userType);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A1F' }}>
        <Image
          source={require('./assets/pikup-logo.png')}
          style={{ width: '80%', height: 250, resizeMode: 'contain' }}
        />
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