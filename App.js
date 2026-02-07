import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LogBox, NativeModules, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import { PaymentProvider } from './contexts/PaymentContext';

import { NotificationProvider } from './contexts/NotificationContext';
import Navigation from './Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import { appNavigationTheme } from './navigation/navigationTheme';
import { colors } from './styles/theme';

// Suppress known Mapbox library warnings
LogBox.ignoreLogs([
  'Warning: Invalid prop `sourceID`',
  'Warning: Invalid prop `sourceID` supplied to `React.Fragment`'
]);

// Stripe Configuration - Use environment variables
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const MERCHANT_ID = process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID || 'merchant.com.pikup';
const URL_SCHEME = process.env.EXPO_PUBLIC_URL_SCHEME || 'pikup';

// Ensure Stripe key is provided
if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in environment variables');
}

// Debug: Check if MapboxNavigation native module is available
console.log('🔍 Available Native Modules:', Object.keys(NativeModules).filter(key =>
  key.toLowerCase().includes('mapbox') || key.toLowerCase().includes('navigation')
));
if (NativeModules.MapboxNavigation) {
  console.log('✅ MapboxNavigation native module found!');
} else {
  console.log('❌ MapboxNavigation native module NOT found');
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.appRoot}>
        <ErrorBoundary>
          <NavigationContainer theme={appNavigationTheme}>
            <StripeProvider
              publishableKey={STRIPE_PUBLISHABLE_KEY}
              merchantId={MERCHANT_ID}
              urlScheme={URL_SCHEME}
            >
              <AuthProvider>
                <PaymentProvider>
                  <NotificationProvider>
                    <Navigation />
                  </NotificationProvider>
                </PaymentProvider>
              </AuthProvider>
            </StripeProvider>
          </NavigationContainer>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});
