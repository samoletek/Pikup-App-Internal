import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
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
    getDriverPayoutAvailability,
    requestInstantPayout,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    checkDriverOnboardingStatus,
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
    handleInstantPayoutAll,
    handleInstantPayoutAmount,
    payoutAmountInput,
    payoutAmountValue,
    payoutFeeEstimate,
    payoutNetEstimate,
    updatePayoutAmountInput,
    getPayoutStatusLabel,
    isPayoutPending,
    toMoney,
  } = useDriverPaymentSettingsData({
    createDriverConnectAccount,
    checkDriverOnboardingStatus,
    currentUser,
    getDriverOnboardingLink,
    getDriverPayoutAvailability,
    getDriverPayouts,
    getDriverProfile,
    getDriverStats,
    requestInstantPayout,
    updateDriverPaymentProfile,
  });
  const latestPendingPayout = Array.isArray(paymentData?.payouts)
    ? paymentData.payouts.find((payout) => isPayoutPending(payout))
    : null;
  const hasFundsOnHold =
    Number(paymentData?.availableBalance || 0) <= 0 && Number(paymentData?.pendingBalance || 0) > 0;

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Payment Settings"
          onBack={() => navigation.goBack()}
          topInset={insets.top}
          showBack
        />
        <ScreenState
          loading
          title="Loading payment settings"
          subtitle="Syncing Stripe account and payout data."
        />
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
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.heroCard}>
            <Text style={styles.heroLabel}>Weekly Earnings</Text>
            <Text style={styles.heroAmount}>{toMoney(paymentData?.weeklyTotal)}</Text>
            <Text style={styles.heroSubtext}>
              Available now: {toMoney(paymentData?.availableBalance)}
            </Text>
            {Number(paymentData?.pendingBalance || 0) > 0 ? (
              <Text style={styles.heroSubtext}>
                On hold: {toMoney(paymentData?.pendingBalance)}
              </Text>
            ) : null}
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
            <Text style={styles.metricLabel}>Available to Withdraw</Text>
            <Text style={styles.metricValue}>{toMoney(paymentData?.availableBalance)}</Text>
            {Number(paymentData?.earnedBalance || 0) >
            Number(paymentData?.availableBalance || 0) ? (
              <Text style={styles.earnedBalanceNote}>
                Earned balance: {toMoney(paymentData?.earnedBalance)}
              </Text>
            ) : null}
            {latestPendingPayout ? (
              <Text style={styles.pendingPayoutNote}>
                Stripe status: {getPayoutStatusLabel(latestPendingPayout)}
              </Text>
            ) : null}
            {Number(paymentData?.pendingBalance || 0) > 0 ? (
              <Text style={styles.pendingPayoutNote}>
                {paymentData?.pendingUntil
                  ? `On hold until ${new Date(paymentData.pendingUntil).toLocaleDateString(
                      undefined,
                      {
                        month: 'short',
                        day: 'numeric',
                      }
                    )}: ${toMoney(paymentData.pendingBalance)}`
                  : `On Stripe hold: ${toMoney(paymentData.pendingBalance)}`}
              </Text>
            ) : null}

            <AppButton
              title={
                processingPayout
                  ? 'Processing...'
                  : hasFundsOnHold
                    ? 'Funds On Hold'
                    : 'Withdraw All'
              }
              onPress={handleInstantPayoutAll}
              loading={processingPayout}
              disabled={processingPayout || Number(paymentData?.availableBalance || 0) <= 0}
              style={styles.topButton}
            />

            <Text style={styles.metricLabel}>Custom Amount</Text>
            <View style={styles.payoutInputRow}>
              <Text style={styles.payoutCurrencyPrefix}>$</Text>
              <TextInput
                style={styles.payoutInput}
                placeholder="0.00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                value={payoutAmountInput}
                onChangeText={updatePayoutAmountInput}
              />
            </View>

            <View style={styles.payoutBreakdownCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.breakdownLabel}>Gross</Text>
                <Text style={styles.breakdownValue}>{toMoney(payoutAmountValue)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.breakdownLabel}>Fee</Text>
                <Text style={styles.breakdownValue}>{toMoney(payoutFeeEstimate)}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.breakdownLabel}>Net</Text>
                <Text style={styles.breakdownValueStrong}>{toMoney(payoutNetEstimate)}</Text>
              </View>
            </View>

            <AppButton
              title={
                processingPayout
                  ? 'Processing...'
                  : hasFundsOnHold
                    ? 'Funds On Hold'
                    : 'Withdraw Amount'
              }
              onPress={handleInstantPayoutAmount}
              loading={processingPayout}
              disabled={
                processingPayout ||
                Number(paymentData?.availableBalance || 0) <= 0 ||
                Number(payoutAmountValue || 0) <= 0 ||
                Number(payoutAmountValue || 0) > Number(paymentData?.availableBalance || 0)
              }
              style={styles.topButton}
            />

            <Text style={styles.noteText}>
              Only settled Stripe funds are available to withdraw. Card payments can stay on hold
              until Stripe settlement.
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
                  <Text
                    style={[
                      styles.payoutStatus,
                      isPayoutPending(payout) && styles.payoutStatusPending,
                    ]}
                  >
                    {getPayoutStatusLabel(payout)}
                  </Text>
                </View>
              ))
            ) : (
              <ScreenState
                title="No payouts yet"
                subtitle="Your payout history will appear here."
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
