import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { useAuth } from '../../contexts/AuthContext';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../styles/theme';

const toMoney = (value) => {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
};

export default function DriverPaymentSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const {
    getDriverProfile,
    getDriverStats,
    getDriverPayouts,
    requestInstantPayout,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile,
  } = useDriverPayoutActions();

  const currentUserId = currentUser?.uid || currentUser?.id;
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [refreshingOnboarding, setRefreshingOnboarding] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const loadPaymentData = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      setPaymentData(null);
      return;
    }

    setLoading(true);
    try {
      const [profile, stats, payoutsResult] = await Promise.all([
        getDriverProfile?.(currentUserId),
        getDriverStats?.(currentUserId),
        getDriverPayouts?.(currentUserId),
      ]);

      const metadata = profile?.metadata || {};
      const connectAccountId = profile?.connectAccountId || profile?.stripe_account_id || metadata.connectAccountId || null;
      const canReceivePayments = Boolean(profile?.canReceivePayments || profile?.can_receive_payments || metadata.canReceivePayments);
      const onboardingComplete = Boolean(profile?.onboardingComplete || profile?.onboarding_complete || metadata.onboardingComplete);

      setPaymentData({
        connectAccountId,
        onboardingComplete,
        canReceivePayments,
        instantPay: metadata.instantPay !== false,
        notificationsEnabled: metadata.notificationsEnabled !== false,
        weeklyTotal: Number(stats?.weeklyEarnings || 0),
        availableBalance: Number(stats?.availableBalance || 0),
        pendingBalance: Math.max(0, Number(stats?.totalEarnings || 0) - Number(stats?.availableBalance || 0)),
        totalPayouts: Number(stats?.totalPayouts || payoutsResult?.totalPayouts || 0),
        payouts: Array.isArray(payoutsResult?.payouts) ? payoutsResult.payouts : [],
      });
    } catch (error) {
      Alert.alert('Payment Settings', error?.message || 'Failed to load payment data.');
      setPaymentData(null);
    } finally {
      setLoading(false);
    }
  }, [
    currentUserId,
    getDriverProfile,
    getDriverStats,
    getDriverPayouts,
  ]);

  useEffect(() => {
    void loadPaymentData();
  }, [loadPaymentData]);

  const onboardingStatusText = useMemo(() => {
    if (!paymentData?.connectAccountId) return 'Not started';
    if (paymentData.canReceivePayments) return 'Active';
    if (paymentData.onboardingComplete) return 'Under review';
    return 'Incomplete';
  }, [paymentData]);

  const saveToggle = async (field, value) => {
    if (!currentUserId) return;

    setPaymentData((prev) => (prev ? { ...prev, [field]: value } : prev));

    try {
      await updateDriverPaymentProfile?.(currentUserId, {
        [field]: value,
      });
    } catch (error) {
      Alert.alert('Payment Settings', error?.message || 'Unable to save setting.');
      setPaymentData((prev) => (prev ? { ...prev, [field]: !value } : prev));
    }
  };

  const ensureStripeOnboarding = async () => {
    if (!currentUserId) return;

    setRefreshingOnboarding(true);
    try {
      let connectAccountId = paymentData?.connectAccountId || null;

      if (!connectAccountId) {
        const createResult = await createDriverConnectAccount?.({
          driverId: currentUserId,
          email: currentUser?.email,
        });

        if (!createResult?.success || !createResult?.connectAccountId) {
          throw new Error(createResult?.error || 'Could not create Stripe account');
        }

        connectAccountId = createResult.connectAccountId;

        if (createResult.onboardingUrl) {
          await Linking.openURL(createResult.onboardingUrl);
          await loadPaymentData();
          return;
        }
      }

      const linkResult = await getDriverOnboardingLink?.(connectAccountId);
      if (!linkResult?.success || !linkResult?.onboardingUrl) {
        throw new Error(linkResult?.error || 'Could not get onboarding link');
      }

      await Linking.openURL(linkResult.onboardingUrl);
      await loadPaymentData();
    } catch (error) {
      Alert.alert('Stripe Onboarding', error?.message || 'Unable to start onboarding.');
    } finally {
      setRefreshingOnboarding(false);
    }
  };

  const handleInstantPayout = async () => {
    if (!currentUserId || !paymentData) return;

    if (!paymentData.connectAccountId) {
      Alert.alert('Setup Required', 'Complete Stripe onboarding first.');
      return;
    }

    if (!paymentData.canReceivePayments) {
      Alert.alert('Account Under Review', 'Your payout account is not ready yet.');
      return;
    }

    if (paymentData.availableBalance <= 0) {
      Alert.alert('No Balance', 'No available balance for payout.');
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Transfer ${toMoney(paymentData.availableBalance)} now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setProcessingPayout(true);
            try {
              const result = await requestInstantPayout?.(currentUserId, paymentData.availableBalance);
              if (!result?.success) {
                throw new Error(result?.error || 'Payout failed');
              }
              Alert.alert('Success', 'Payout submitted successfully.');
              await loadPaymentData();
            } catch (error) {
              Alert.alert('Payout Error', error?.message || 'Unable to process payout.');
            } finally {
              setProcessingPayout(false);
            }
          },
        },
      ]
    );
  };

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heroLabel: {
    color: colors.white,
    opacity: 0.9,
    fontSize: typography.fontSize.base,
  },
  heroAmount: {
    color: colors.white,
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
  heroSubtext: {
    color: colors.white,
    opacity: 0.9,
    marginTop: spacing.xs,
    fontSize: typography.fontSize.base,
  },
  card: {
    backgroundColor: colors.background.panel,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  rowSubtitle: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  badge: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  topButton: {
    marginTop: spacing.base,
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  metricValue: {
    marginTop: spacing.xs,
    color: colors.text.primary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  noteText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextBlock: {
    flex: 1,
    paddingRight: spacing.base,
  },
  settingTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  settingSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.strong,
    marginVertical: spacing.base,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  payoutAmount: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  payoutDate: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  payoutStatus: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});
