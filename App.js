import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Linking, LogBox, StyleSheet, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import { PaymentProvider } from './contexts/PaymentContext';

import { NotificationProvider } from './contexts/NotificationContext';
import Navigation from './Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import { appNavigationTheme } from './navigation/navigationTheme';
import { colors } from './styles/theme';
import { appConfig } from './config/appConfig';
import { ensureMapboxConfigured } from './config/mapbox';
import { logger } from './services/logger';

const normalizeDeepLinkUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) return url;

  const hashPayload = url.slice(hashIndex + 1);
  if (!hashPayload || !hashPayload.includes('=')) return url;

  const base = url.slice(0, hashIndex);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${hashPayload}`;
};

// Deep linking configuration
const linking = {
  prefixes: [
    'pikup://',
    'https://pikup-app.com',
    'https://www.pikup-app.com',
  ],
  config: {
    screens: {
      // Customer flow -- referral deep link
      CustomerTabs: {
        screens: {},
      },
      CustomerRewardsScreen: 'invite/:code',
      ResetPasswordScreen: 'reset-password',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return normalizeDeepLinkUrl(url);
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(normalizeDeepLinkUrl(url));
    });
    return () => subscription.remove();
  },
};

// Suppress known Mapbox library warnings
LogBox.ignoreLogs([
  'Warning: Invalid prop `sourceID`',
  'Warning: Invalid prop `sourceID` supplied to `React.Fragment`'
]);

// Stripe Configuration - Use environment variables
const STRIPE_PUBLISHABLE_KEY = appConfig.stripe.publishableKey;
const MERCHANT_ID = appConfig.stripe.merchantId;
const URL_SCHEME = appConfig.stripe.urlScheme;

// Ensure Stripe key is provided
if (!STRIPE_PUBLISHABLE_KEY) {
  logger.error('App', 'Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in environment variables');
}

ensureMapboxConfigured();

export default function App() {
  const colorScheme = useColorScheme();
  const keyboardAppearance = colorScheme === 'dark' ? 'dark' : 'light';

  React.useEffect(() => {
    TextInput.defaultProps = {
      ...(TextInput.defaultProps || {}),
      keyboardAppearance,
    };
  }, [keyboardAppearance]);

  return (
    <SafeAreaProvider>
      <View style={styles.appRoot}>
        <ErrorBoundary>
          <NavigationContainer theme={appNavigationTheme} linking={linking}>
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
