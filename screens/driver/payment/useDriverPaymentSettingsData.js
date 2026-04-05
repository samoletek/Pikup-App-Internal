import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  mergeDriverOnboardingStatus,
  normalizeDriverPaymentState,
  shouldRefreshDriverPaymentStatus,
} from '../../../services/payment/paymentState';

const toMoney = (value) => {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
};

const normalizeMoneyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = cleaned.split('.');
  const decimalPart = decimalParts.join('').slice(0, 2);
  return decimalParts.length > 0
    ? `${integerPart}.${decimalPart}`
    : integerPart;
};

const roundToCents = (value) => Number((Number(value || 0)).toFixed(2));

export default function useDriverPaymentSettingsData({
  createDriverConnectAccount,
  checkDriverOnboardingStatus,
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
  const [payoutAmountInput, setPayoutAmountInput] = useState('');

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

      let resolvedProfile = normalizeDriverPaymentState(profile || {});
      if (
        typeof checkDriverOnboardingStatus === 'function' &&
        shouldRefreshDriverPaymentStatus(resolvedProfile)
      ) {
        const onboardingResult = await checkDriverOnboardingStatus(resolvedProfile.connectAccountId);
        if (onboardingResult?.success) {
          resolvedProfile = mergeDriverOnboardingStatus(resolvedProfile, onboardingResult);
        }
      }

      const metadata = resolvedProfile.metadata || {};

      setPaymentData({
        connectAccountId: resolvedProfile.connectAccountId,
        onboardingComplete: resolvedProfile.onboardingComplete,
        canReceivePayments: resolvedProfile.canReceivePayments,
        onboardingStatus: resolvedProfile.onboardingStatus,
        onboardingRequirements: resolvedProfile.onboardingRequirements,
        disabledReason: resolvedProfile.disabledReason,
        instantPay: metadata.instantPay !== false,
        notificationsEnabled: metadata.notificationsEnabled !== false,
        instantPayoutFeeBps: Number(metadata.instantPayoutFeeBps || 0),
        instantPayoutFeeFlat: Number(metadata.instantPayoutFeeFlat || 0),
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
  }, [
    checkDriverOnboardingStatus,
    currentUserId,
    getDriverPayouts,
    getDriverProfile,
    getDriverStats,
  ]);

  useEffect(() => {
    void loadPaymentData();
  }, [loadPaymentData]);

  const onboardingStatusText = useMemo(() => {
    if (!paymentData?.connectAccountId) return 'Not started';
    if (paymentData.canReceivePayments) return 'Active';
    if (paymentData.onboardingStatus === 'under_review') return 'Under review';
    if (paymentData.onboardingStatus === 'action_required') return 'Action required';
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

  const payoutAmountValue = useMemo(() => {
    const parsed = Number(payoutAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return roundToCents(parsed);
  }, [payoutAmountInput]);

  const payoutFeeEstimate = useMemo(() => {
    if (!paymentData || payoutAmountValue <= 0) {
      return 0;
    }

    const feeBps = Number(paymentData.instantPayoutFeeBps || 0);
    const feeFlat = Number(paymentData.instantPayoutFeeFlat || 0);
    const byPercent = payoutAmountValue * (feeBps / 10000);
    const estimatedFee = Math.max(0, byPercent + feeFlat);
    return roundToCents(estimatedFee);
  }, [paymentData, payoutAmountValue]);

  const payoutNetEstimate = useMemo(() => {
    return Math.max(0, roundToCents(payoutAmountValue - payoutFeeEstimate));
  }, [payoutAmountValue, payoutFeeEstimate]);

  const openPayoutConfirmation = useCallback(async (amount) => {
    if (!currentUserId || !paymentData) return;

    if (!paymentData.connectAccountId) {
      Alert.alert('Setup Required', 'Complete Stripe onboarding first.');
      return;
    }

    if (!paymentData.canReceivePayments) {
      Alert.alert('Account Under Review', 'Your payout account is not ready yet.');
      return;
    }

    const grossAmount = roundToCents(amount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a payout amount greater than $0.00.');
      return;
    }

    if (grossAmount > paymentData.availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You can withdraw up to ${toMoney(paymentData.availableBalance)}.`,
      );
      return;
    }

    const feeBps = Number(paymentData.instantPayoutFeeBps || 0);
    const feeFlat = Number(paymentData.instantPayoutFeeFlat || 0);
    const estimatedFee = roundToCents(Math.max(0, grossAmount * (feeBps / 10000) + feeFlat));
    const estimatedNet = roundToCents(Math.max(0, grossAmount - estimatedFee));

    if (paymentData.availableBalance <= 0) {
      Alert.alert('No Balance', 'No available balance for payout.');
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Gross: ${toMoney(grossAmount)}\nFee: ${toMoney(estimatedFee)}\nNet: ${toMoney(estimatedNet)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setProcessingPayout(true);
            try {
              const result = await requestInstantPayout?.(
                currentUserId,
                grossAmount
              );
              if (!result?.success) {
                throw new Error(result?.error || 'Payout failed');
              }
              const settledFee = Number(result?.feeAmount || 0);
              const settledNet = Number(result?.netAmount || 0);
              Alert.alert(
                'Success',
                `Payout submitted.\nGross: ${toMoney(grossAmount)}\nFee: ${toMoney(settledFee)}\nNet: ${toMoney(settledNet || Math.max(0, grossAmount - settledFee))}`,
              );
              setPayoutAmountInput('');
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

  const handleInstantPayoutAll = useCallback(async () => {
    if (!paymentData) {
      return;
    }
    await openPayoutConfirmation(paymentData.availableBalance);
  }, [openPayoutConfirmation, paymentData]);

  const handleInstantPayoutAmount = useCallback(async () => {
    await openPayoutConfirmation(payoutAmountValue);
  }, [openPayoutConfirmation, payoutAmountValue]);

  const updatePayoutAmountInput = useCallback((value) => {
    setPayoutAmountInput(normalizeMoneyInput(value));
  }, []);

  return {
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
    toMoney,
  };
}
