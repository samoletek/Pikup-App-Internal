import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useDemo } from "./contexts/DemoContext";

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
import TestDataScreen from "./screens/TestDataScreen";

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

// TERMS AND PRIVACY SCREEN - Add this import
import TermsAndPrivacyScreen from "./screens/TermsAndPrivacyScreen";
import ConsentGateScreen from "./screens/ConsentGateScreen";

const Stack = createNativeStackNavigator();

export default function Navigation() {
  const navigation = useNavigation();
  const { registerNavigation } = useDemo();

  // Register the navigation function with the demo context
  useEffect(() => {
    if (registerNavigation) {
      registerNavigation((screenName, params) => {
        navigation.navigate(screenName, params);
      });
    }
  }, [navigation, registerNavigation]);

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="WelcomeScreen"
    >
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
      <Stack.Screen name="AuthScreen" component={AuthScreen} />
      <Stack.Screen
        name="RoleSelectionScreen"
        component={RoleSelectionScreen}
      />

      {/* Tab Navigators - Replace individual home screens */}
      <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />
      <Stack.Screen name="DriverTabs" component={DriverTabNavigator} />

      {/* Individual screens that can be accessed from tabs */}
      <Stack.Screen
        name="CustomerActivityScreen"
        component={CustomerActivityScreen}
      />
      <Stack.Screen
        name="CustomerMessagesScreen"
        component={CustomerMessagesScreen}
      />
      <Stack.Screen
        name="CustomerClaimsScreen"
        component={CustomerClaimsScreen}
      />
      <Stack.Screen
        name="DriverMessagesScreen"
        component={DriverMessagesScreen}
      />

      {/* Modal/Overlay screens - Keep these in stack navigation */}
      <Stack.Screen
        name="TestDataScreen"
        component={TestDataScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverPreferencesScreen"
        component={DriverPreferencesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverEarningsScreen"
        component={DriverEarningsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PaymentMethodsScreen"
        component={PaymentMethodsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RouteConfirmationScreen"
        component={RouteConfirmationScreen}
      />
      <Stack.Screen name="MessageScreen" component={MessageScreen} />
      <Stack.Screen
        name="DeliveryTrackingScreen"
        component={DeliveryTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryFeedbackScreen"
        component={DeliveryFeedbackScreen}
      />
      <Stack.Screen
        name="EnRouteToPickupScreen"
        component={EnRouteToPickupScreen}
      />
      <Stack.Screen
        name="GpsNavigationScreen"
        component={GpsNavigationScreen}
      />

      {/* NEW SCREENS - Add these routes */}
      <Stack.Screen
        name="PickupConfirmationScreen"
        component={PickupConfirmationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryNavigationScreen"
        component={DeliveryNavigationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryConfirmationScreen"
        component={DeliveryConfirmationScreen}
        options={{ headerShown: false }}
      />
      
      {/* CUSTOMER PROFILE SCREENS - Add these routes */}
      <Stack.Screen
        name="CustomerHelpScreen"
        component={CustomerHelpScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerWalletScreen"
        component={CustomerWalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPersonalInfoScreen"
        component={CustomerPersonalInfoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerSafetyScreen"
        component={CustomerSafetyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerSettingsScreen"
        component={CustomerSettingsScreen}
        options={{ headerShown: false }}
      />

      {/* DRIVER ONBOARDING SCREENS - Add these new routes */}
      <Stack.Screen
        name="DriverOnboardingScreen"
        component={DriverOnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverOnboardingCompleteScreen"
        component={DriverOnboardingCompleteScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverPaymentSettingsScreen"
        component={DriverPaymentSettingsScreen}
        options={{ headerShown: false }}
      />

      {/* TERMS AND PRIVACY SCREEN - Add this route */}
      <Stack.Screen
        name="TermsAndPrivacyScreen"
        component={TermsAndPrivacyScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConsentGateScreen"
        component={ConsentGateScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}