import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';

const toMoney = (value) => {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
};

export default function useDriverPaymentSettingsData({
  createDriverConnectAccount,
  currentUser,
  getDriverOnboardingLink,
  getDriverPayouts,
  getDriverProfile,
  getDriverStats,
  requestInstantPayout,
  updateDriverPaymentProfile,
}) {
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
      const connectAccountId =
        profile?.connectAccountId ||
        profile?.stripe_account_id ||
        metadata.connectAccountId ||
        null;
      const canReceivePayments = Boolean(
        profile?.canReceivePayments ||
          profile?.can_receive_payments ||
          metadata.canReceivePayments
      );
      const onboardingComplete = Boolean(
        profile?.onboardingComplete ||
          profile?.onboarding_complete ||
          metadata.onboardingComplete
      );

      setPaymentData({
        connectAccountId,
        onboardingComplete,
        canReceivePayments,
        instantPay: metadata.instantPay !== false,
        notificationsEnabled: metadata.notificationsEnabled !== false,
        weeklyTotal: Number(stats?.weeklyEarnings || 0),
        availableBalance: Number(stats?.availableBalance || 0),
        pendingBalance: Math.max(
          0,
          Number(stats?.totalEarnings || 0) - Number(stats?.availableBalance || 0)
        ),
        totalPayouts: Number(stats?.totalPayouts || payoutsResult?.totalPayouts || 0),
        payouts: Array.isArray(payoutsResult?.payouts) ? payoutsResult.payouts : [],
      });
    } catch (error) {
      Alert.alert('Payment Settings', error?.message || 'Failed to load payment data.');
      setPaymentData(null);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, getDriverPayouts, getDriverProfile, getDriverStats]);

  useEffect(() => {
    void loadPaymentData();
  }, [loadPaymentData]);

  const onboardingStatusText = useMemo(() => {
    if (!paymentData?.connectAccountId) return 'Not started';
    if (paymentData.canReceivePayments) return 'Active';
    if (paymentData.onboardingComplete) return 'Under review';
    return 'Incomplete';
  }, [paymentData]);

  const saveToggle = useCallback(async (field, value) => {
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
  }, [currentUserId, updateDriverPaymentProfile]);

  const ensureStripeOnboarding = useCallback(async () => {
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
  }, [
    createDriverConnectAccount,
    currentUser?.email,
    currentUserId,
    getDriverOnboardingLink,
    loadPaymentData,
    paymentData?.connectAccountId,
  ]);

  const handleInstantPayout = useCallback(async () => {
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
              const result = await requestInstantPayout?.(
                currentUserId,
                paymentData.availableBalance
              );
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
  }, [currentUserId, loadPaymentData, paymentData, requestInstantPayout]);

  return {
    loading,
    onboardingStatusText,
    paymentData,
    processingPayout,
    refreshingOnboarding,
    saveToggle,
    ensureStripeOnboarding,
    handleInstantPayout,
    toMoney,
  };
}
