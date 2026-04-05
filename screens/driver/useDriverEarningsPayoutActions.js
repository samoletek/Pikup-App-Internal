import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { logger } from '../../services/logger';

const PAYOUT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

const buildPayoutIdempotencyKey = ({ driverId, amountCents }) => {
  const normalizedDriverId = String(driverId || 'unknown').trim() || 'unknown';
  const randomToken = Math.random().toString(36).slice(2, 10);
  return `instant_payout:${normalizedDriverId}:${amountCents}:${Date.now()}:${randomToken}`;
};

const resolveInstantPayoutTitle = (driverProfile = {}) => {
  if (!driverProfile?.connectAccountId) {
    return 'Setup Required';
  }

  if (!driverProfile?.canReceivePayments) {
    return driverProfile?.onboardingStatus === 'action_required'
      ? 'Complete Setup'
      : 'Under Review';
  }

  return 'Payout Now';
};

export default function useDriverEarningsPayoutActions({
  currentUserId,
  driverProfile,
  driverStats,
  loading,
  processInstantPayout,
  loadDriverData,
  navigation,
}) {
  const [payoutLoading, setPayoutLoading] = useState(false);
  const payoutAttemptRef = useRef({ key: null, amountCents: null, createdAt: 0 });

  const openPayoutSettings = useCallback(() => {
    navigation.navigate('DriverPaymentSettingsScreen');
  }, [navigation]);

  const resolvePayoutIdempotencyKey = useCallback((grossAmount) => {
    const amountCents = Math.round(Number(grossAmount || 0) * 100);
    const now = Date.now();
    const previousAttempt = payoutAttemptRef.current;
    const canReuseAttemptKey = (
      previousAttempt?.key &&
      previousAttempt?.amountCents === amountCents &&
      (now - Number(previousAttempt?.createdAt || 0)) < PAYOUT_IDEMPOTENCY_TTL_MS
    );

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
  }, [currentUserId]);

  const resetPayoutAttempt = useCallback(() => {
    payoutAttemptRef.current = { key: null, amountCents: null, createdAt: 0 };
  }, []);

  const instantPayoutTitle = useMemo(
    () => resolveInstantPayoutTitle(driverProfile),
    [driverProfile]
  );

  const handleInstantPayout = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    if (!driverProfile?.connectAccountId) {
      Alert.alert(
        'Setup Required',
        'You need to finish payout setup before you can cash out. Open payout settings to complete Stripe onboarding.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Payout Setup', onPress: openPayoutSettings },
        ]
      );
      return;
    }

    if (!driverProfile?.canReceivePayments) {
      const requiresAction = driverProfile?.onboardingStatus === 'action_required';
      Alert.alert(
        requiresAction ? 'Complete Setup' : 'Account Under Review',
        requiresAction
          ? 'Your payout account still needs a few details before instant payouts can be enabled.'
          : 'Your payout account is still under review. Instant payouts will unlock once verification completes.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: requiresAction ? 'Continue Setup' : 'Open Payout Settings',
            onPress: openPayoutSettings,
          },
        ]
      );
      return;
    }

    if (driverStats.availableBalance <= 0) {
      Alert.alert(
        'No Balance',
        "You don't have any available balance to cash out yet.",
        [
          { text: 'OK', style: 'cancel' },
          { text: 'View Payout Settings', onPress: openPayoutSettings },
        ]
      );
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Gross: $${driverStats.availableBalance.toFixed(2)}\nFee: $0.00\nNet: $${driverStats.availableBalance.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cash Out',
          onPress: async () => {
            setPayoutLoading(true);
            try {
              const idempotencyKey = resolvePayoutIdempotencyKey(driverStats.availableBalance);
              const result = await processInstantPayout?.(
                currentUserId,
                driverStats.availableBalance,
                { idempotencyKey }
              );

              if (result?.success) {
                const feeAmount = Number(result?.feeAmount || 0);
                const netAmount = Number(
                  Number.isFinite(Number(result?.netAmount))
                    ? Number(result.netAmount)
                    : driverStats.availableBalance - feeAmount
                );
                Alert.alert(
                  'Success',
                  `Payout processed.\nGross: $${driverStats.availableBalance.toFixed(2)}\nFee: $${feeAmount.toFixed(2)}\nNet: $${Math.max(0, netAmount).toFixed(2)}`
                );
                await loadDriverData();
                resetPayoutAttempt();
              } else {
                throw new Error(result?.error || 'Payout failed');
              }
            } catch (error) {
              logger.error('DriverEarningsPayoutActions', 'Payout error', error);
              Alert.alert('Error', `Failed to process payout: ${error.message}`);
            } finally {
              setPayoutLoading(false);
            }
          },
        },
      ]
    );
  }, [
    currentUserId,
    driverProfile?.canReceivePayments,
    driverProfile?.connectAccountId,
    driverProfile?.onboardingStatus,
    driverStats.availableBalance,
    loadDriverData,
    openPayoutSettings,
    processInstantPayout,
    resolvePayoutIdempotencyKey,
    resetPayoutAttempt,
  ]);

  const handlePayoutDetails = useCallback(() => {
    openPayoutSettings();
  }, [openPayoutSettings]);

  const isInstantPayoutDisabled = loading || payoutLoading || !currentUserId;

  return {
    handleInstantPayout,
    handlePayoutDetails,
    isInstantPayoutDisabled,
    payoutLoading,
    instantPayoutTitle,
  };
}
