import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import {
  mergeDriverOnboardingStatus,
  normalizeDriverPaymentState,
  shouldRefreshDriverPaymentStatus,
} from '../../../services/payment/paymentState';
import {
  formatPayoutDate,
  formatPayoutDateTime,
} from '../../../services/payment/payoutAvailabilityFormatting';

const HOLD_REFRESH_GRACE_MS = 10 * 1000;
const MAX_HOLD_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000;

const toMoney = (value) => {
  const amount = Number(value) || 0;
  return `$${amount.toFixed(2)}`;
};

const resolvePayoutAvailableOn = (payout = {}) => {
  if (
    payout.availableOn ||
    payout.available_on ||
    payout.sourceAvailableOn ||
    payout.source_available_on
  ) {
    return (
      payout.availableOn ||
      payout.available_on ||
      payout.sourceAvailableOn ||
      payout.source_available_on
    );
  }

  const sources = Array.isArray(payout.sources) ? payout.sources : [];
  const sourceDates = sources
    .map((source) => source?.availableOn || source?.available_on)
    .filter(Boolean)
    .map((dateValue) => new Date(dateValue))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (sourceDates.length === 0) {
    return null;
  }

  return new Date(Math.max(...sourceDates.map((date) => date.getTime()))).toISOString();
};

const isPayoutPending = (payout = {}) => String(payout.status || '').toLowerCase() === 'pending';

const getPayoutStatusLabel = (payout = {}) => {
  if (isPayoutPending(payout)) {
    const dateLabel = formatPayoutDateTime(resolvePayoutAvailableOn(payout));
    return dateLabel ? `Pending until ${dateLabel}` : 'Pending';
  }

  const status = String(payout.status || 'processed')
    .trim()
    .toLowerCase();
  if (status === 'processed') return 'Processed';
  if (status === 'reversed') return 'Reversed';
  return status ? status.replace(/_/g, ' ') : 'Processed';
};

const getPayoutHoldMessage = (paymentData = {}) => {
  const pendingAmount = Number(paymentData?.pendingBalance || 0);
  if (pendingAmount <= 0) {
    return null;
  }

  const dateLabel = formatPayoutDateTime(paymentData?.pendingUntil);
  return dateLabel
    ? `${toMoney(pendingAmount)} is on Stripe hold until ${dateLabel}.`
    : `${toMoney(pendingAmount)} is still on Stripe hold.`;
};

const normalizeMoneyInput = (value) => {
  const cleaned = String(value || '').replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = cleaned.split('.');
  const decimalPart = decimalParts.join('').slice(0, 2);
  return decimalParts.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
};

const roundToCents = (value) => Number(Number(value || 0).toFixed(2));
const PAYOUT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

const buildPayoutIdempotencyKey = ({ driverId, amountCents }) => {
  const normalizedDriverId = String(driverId || 'unknown').trim() || 'unknown';
  const randomToken = Math.random().toString(36).slice(2, 10);
  return `instant_payout:${normalizedDriverId}:${amountCents}:${Date.now()}:${randomToken}`;
};

export default function useDriverPaymentSettingsData({
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
}) {
  const currentUserId = currentUser?.uid || currentUser?.id;
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [refreshingOnboarding, setRefreshingOnboarding] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const payoutAttemptRef = useRef({ key: null, amountCents: null, createdAt: 0 });
  const appStateRef = useRef(AppState.currentState);
  const pendingStripeOnboardingReturnRef = useRef(false);
  const holdRefreshAttemptRef = useRef(null);

  const resolvePayoutIdempotencyKey = useCallback(
    (grossAmount) => {
      const amountCents = Math.round(Number(grossAmount || 0) * 100);
      const now = Date.now();
      const previousAttempt = payoutAttemptRef.current;
      const canReuseAttemptKey =
        previousAttempt?.key &&
        previousAttempt?.amountCents === amountCents &&
        now - Number(previousAttempt?.createdAt || 0) < PAYOUT_IDEMPOTENCY_TTL_MS;

      if (canReuseAttemptKey) {
        return previousAttempt.key;
      }

      const nextKey = buildPayoutIdempotencyKey({ driverId: currentUserId, amountCents });
      payoutAttemptRef.current = {
        key: nextKey,
        amountCents,
        createdAt: now,
      };
      return nextKey;
    },
    [currentUserId]
  );

  const resetPayoutAttempt = useCallback(() => {
    payoutAttemptRef.current = { key: null, amountCents: null, createdAt: 0 };
  }, []);

  const loadPaymentData = useCallback(
    async ({ silent = false } = {}) => {
      if (!currentUserId) {
        if (!silent) {
          setLoading(false);
        }
        setPaymentData(null);
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      try {
        const [profile, stats, payoutsResult, availabilityResult] = await Promise.all([
          getDriverProfile?.(currentUserId),
          getDriverStats?.(currentUserId),
          getDriverPayouts?.(currentUserId),
          getDriverPayoutAvailability?.(currentUserId),
        ]);

        let resolvedProfile = normalizeDriverPaymentState(profile || {});
        if (
          typeof checkDriverOnboardingStatus === 'function' &&
          shouldRefreshDriverPaymentStatus(resolvedProfile)
        ) {
          const onboardingResult = await checkDriverOnboardingStatus(
            resolvedProfile.connectAccountId
          );
          if (onboardingResult?.success) {
            resolvedProfile = mergeDriverOnboardingStatus(resolvedProfile, onboardingResult);
          }
        }

        const metadata = resolvedProfile.metadata || {};
        const internalBalance = Number(stats?.availableBalance || 0);
        const hasAvailability =
          availabilityResult?.success &&
          Number.isFinite(Number(availabilityResult.availableNowAmount));
        const availableNow = hasAvailability
          ? Number(availabilityResult.availableNowAmount || 0)
          : internalBalance;
        const pendingBalance = hasAvailability
          ? Number(availabilityResult.pendingAmount || 0)
          : Math.max(0, Number(stats?.totalEarnings || 0) - internalBalance);

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
          earnedBalance: internalBalance,
          availableBalance: availableNow,
          pendingBalance,
          pendingUntil: availabilityResult?.pendingUntil || null,
          totalPayouts: Number(stats?.totalPayouts || payoutsResult?.totalPayouts || 0),
          payouts: Array.isArray(payoutsResult?.payouts) ? payoutsResult.payouts : [],
        });
      } catch (error) {
        if (!silent) {
          Alert.alert('Payment Settings', error?.message || 'Failed to load payment data.');
          setPaymentData(null);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      checkDriverOnboardingStatus,
      currentUserId,
      getDriverPayoutAvailability,
      getDriverPayouts,
      getDriverProfile,
      getDriverStats,
    ]
  );

  useEffect(() => {
    void loadPaymentData();
  }, [loadPaymentData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const hasReturnedToForeground =
        (previousState === 'inactive' || previousState === 'background') && nextState === 'active';

      if (hasReturnedToForeground) {
        pendingStripeOnboardingReturnRef.current = false;
        void loadPaymentData({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadPaymentData]);

  useEffect(() => {
    const pendingUntil = paymentData?.pendingUntil;
    const pendingBalance = Number(paymentData?.pendingBalance || 0);

    if (!currentUserId || !pendingUntil || pendingBalance <= 0) {
      holdRefreshAttemptRef.current = null;
      return undefined;
    }

    const pendingUntilMs = new Date(pendingUntil).getTime();
    if (Number.isNaN(pendingUntilMs)) {
      return undefined;
    }

    const delayMs = pendingUntilMs - Date.now() + HOLD_REFRESH_GRACE_MS;
    const refreshKey = `${pendingUntil}:${pendingBalance}`;

    if (delayMs <= 0 && holdRefreshAttemptRef.current === refreshKey) {
      return undefined;
    }

    const boundedDelayMs = delayMs <= 0 ? 1000 : Math.min(delayMs, MAX_HOLD_REFRESH_DELAY_MS);

    const timer = setTimeout(() => {
      holdRefreshAttemptRef.current = refreshKey;
      void loadPaymentData({ silent: true });
    }, boundedDelayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [currentUserId, loadPaymentData, paymentData?.pendingBalance, paymentData?.pendingUntil]);

  const onboardingStatusText = useMemo(() => {
    if (!paymentData?.connectAccountId) return 'Not started';
    if (paymentData.canReceivePayments) return 'Active';
    if (paymentData.onboardingStatus === 'under_review') return 'Under review';
    if (paymentData.onboardingStatus === 'action_required') return 'Action required';
    if (paymentData.onboardingComplete) return 'Under review';
    return 'Incomplete';
  }, [paymentData]);

  const saveToggle = useCallback(
    async (field, value) => {
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
    },
    [currentUserId, updateDriverPaymentProfile]
  );

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
          pendingStripeOnboardingReturnRef.current = true;
          await Linking.openURL(createResult.onboardingUrl);
          return;
        }
      }

      const linkResult = await getDriverOnboardingLink?.(connectAccountId);
      if (!linkResult?.success || !linkResult?.onboardingUrl) {
        throw new Error(linkResult?.error || 'Could not get onboarding link');
      }

      pendingStripeOnboardingReturnRef.current = true;
      await Linking.openURL(linkResult.onboardingUrl);
    } catch (error) {
      pendingStripeOnboardingReturnRef.current = false;
      Alert.alert('Stripe Onboarding', error?.message || 'Unable to start onboarding.');
    } finally {
      setRefreshingOnboarding(false);
    }
  }, [
    createDriverConnectAccount,
    currentUser?.email,
    currentUserId,
    getDriverOnboardingLink,
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

  const openPayoutConfirmation = useCallback(
    async (amount) => {
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

      if (paymentData.availableBalance <= 0) {
        Alert.alert(
          'Funds On Hold',
          getPayoutHoldMessage(paymentData) || 'No funds are available to withdraw right now.'
        );
        return;
      }

      if (grossAmount > paymentData.availableBalance) {
        Alert.alert(
          'Insufficient Balance',
          `You can withdraw up to ${toMoney(paymentData.availableBalance)}.`
        );
        return;
      }

      const feeBps = Number(paymentData.instantPayoutFeeBps || 0);
      const feeFlat = Number(paymentData.instantPayoutFeeFlat || 0);
      const estimatedFee = roundToCents(Math.max(0, grossAmount * (feeBps / 10000) + feeFlat));
      const estimatedNet = roundToCents(Math.max(0, grossAmount - estimatedFee));

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
                const idempotencyKey = resolvePayoutIdempotencyKey(grossAmount);
                const result = await requestInstantPayout?.(currentUserId, grossAmount, {
                  idempotencyKey,
                });
                if (!result?.success) {
                  throw new Error(result?.error || 'Payout failed');
                }
                const settledFee = Number(result?.feeAmount || 0);
                const settledNet = Number(result?.netAmount || 0);
                const availabilityLabel = formatPayoutDate(result?.availableOn);
                const statusLine =
                  result?.status === 'pending' && availabilityLabel
                    ? `\nStripe may show this payout as pending until ${availabilityLabel}.`
                    : '';
                Alert.alert(
                  'Payout Submitted',
                  `Gross: ${toMoney(grossAmount)}\nFee: ${toMoney(settledFee)}\nNet: ${toMoney(settledNet || Math.max(0, grossAmount - settledFee))}${statusLine}`
                );
                setPayoutAmountInput('');
                await loadPaymentData();
                resetPayoutAttempt();
              } catch (error) {
                Alert.alert('Payout Error', error?.message || 'Unable to process payout.');
              } finally {
                setProcessingPayout(false);
              }
            },
          },
        ]
      );
    },
    [
      currentUserId,
      loadPaymentData,
      paymentData,
      requestInstantPayout,
      resolvePayoutIdempotencyKey,
      resetPayoutAttempt,
    ]
  );

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
    getPayoutStatusLabel,
    isPayoutPending,
    formatPayoutDateTime,
    toMoney,
  };
}
