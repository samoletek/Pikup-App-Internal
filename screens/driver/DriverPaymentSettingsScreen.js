import React from 'react';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/ScreenHeader';
import AppSwitch from '../../components/AppSwitch';
import AppButton from '../../components/ui/AppButton';
import ScreenState from '../../components/ui/ScreenState';
import { useDriverPayoutActions } from '../../hooks/useDriverPayoutActions';
import { useAuthIdentity } from '../../contexts/AuthContext';
import { colors, spacing } from '../../styles/theme';
import useDriverPaymentSettingsData from './payment/useDriverPaymentSettingsData';
import styles from './DriverPaymentSettingsScreen.styles';

export default function DriverPaymentSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuthIdentity();
  const {
    getDriverProfile,
    getDriverStats,
    getDriverPayouts,
    requestInstantPayout,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile,
  } = useDriverPayoutActions();

  const {
    loading,
    onboardingStatusText,
    paymentData,
    processingPayout,
    refreshingOnboarding,
    saveToggle,
    ensureStripeOnboarding,
    handleInstantPayout,
    toMoney,
  } = useDriverPaymentSettingsData({
    createDriverConnectAccount,
    currentUser,
    getDriverOnboardingLink,
    getDriverPayouts,
    getDriverProfile,
    getDriverStats,
    requestInstantPayout,
    updateDriverPaymentProfile,
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Payment Settings"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
        />
        <ScreenState loading title="Loading payment settings" subtitle="Syncing Stripe account and payout data." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Payment Settings"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.base,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>Weekly Earnings</Text>
            <Text style={styles.heroAmount}>{toMoney(paymentData?.weeklyTotal)}</Text>
            <Text style={styles.heroSubtext}>
              Available: {toMoney(paymentData?.availableBalance)}
            </Text>
            <Text style={styles.heroSubtext}>
              Total payouts: {toMoney(paymentData?.totalPayouts)}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stripe Connect</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Ionicons name="card" size={20} color={colors.primary} />
                <Text style={styles.rowTitle}>Account status</Text>
              </View>
              <Text style={styles.badge}>{onboardingStatusText}</Text>
            </View>

            <Text style={styles.rowSubtitle}>
              {paymentData?.connectAccountId
                ? `Account: ${paymentData.connectAccountId}`
                : 'No Stripe Connect account yet'}
            </Text>

            <AppButton
              title={
                refreshingOnboarding
                  ? 'Opening...'
                  : paymentData?.connectAccountId
                    ? 'Continue Onboarding'
                    : 'Start Stripe Onboarding'
              }
              onPress={ensureStripeOnboarding}
              loading={refreshingOnboarding}
              style={styles.topButton}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payouts</Text>
          <View style={styles.card}>
            <Text style={styles.metricLabel}>Available Balance</Text>
            <Text style={styles.metricValue}>{toMoney(paymentData?.availableBalance)}</Text>

            <AppButton
              title={processingPayout ? 'Processing...' : 'Cash Out Now'}
              onPress={handleInstantPayout}
              loading={processingPayout}
              disabled={processingPayout || Number(paymentData?.availableBalance || 0) <= 0}
              style={styles.topButton}
            />

            <Text style={styles.noteText}>
              Instant payout sends your available balance to Stripe Connect.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextBlock}>
                <Text style={styles.settingTitle}>Instant Pay</Text>
                <Text style={styles.settingSubtitle}>Enable instant payout controls</Text>
              </View>
              <AppSwitch
                value={paymentData?.instantPay !== false}
                onValueChange={(value) => saveToggle('instantPay', value)}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextBlock}>
                <Text style={styles.settingTitle}>Payment Notifications</Text>
                <Text style={styles.settingSubtitle}>Receive payout updates and alerts</Text>
              </View>
              <AppSwitch
                value={paymentData?.notificationsEnabled !== false}
                onValueChange={(value) => saveToggle('notificationsEnabled', value)}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payouts</Text>
          <View style={styles.card}>
            {Array.isArray(paymentData?.payouts) && paymentData.payouts.length > 0 ? (
              paymentData.payouts.slice(0, 5).map((payout) => (
                <View style={styles.payoutRow} key={payout.id || payout.createdAt}>
                  <View>
                    <Text style={styles.payoutAmount}>{toMoney(payout.amount)}</Text>
                    <Text style={styles.payoutDate}>
                      {new Date(payout.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.payoutStatus}>{payout.status || 'processed'}</Text>
                </View>
              ))
            ) : (
              <ScreenState title="No payouts yet" subtitle="Your payout history will appear here." />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
