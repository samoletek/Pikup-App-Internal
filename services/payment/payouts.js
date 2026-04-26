import { normalizeError } from '../errorService';
import { logger } from '../logger';
import { failureResult, successResult } from '../contracts/result';
import { getDriverStats } from '../driverEarningsService';
import {
  fetchCompletedDriverTrips,
  invokeDriverPayoutAvailability,
  invokeProcessPayout,
} from '../repositories/paymentRepository';
import { resolveDriverPayoutAmount } from '../PricingService';
import { getDriverProfileRow, periodStartIso, toNumber } from './common';

const sanitizeIdempotencyToken = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, '')
    .slice(0, 150);

const toMoney = (value) => `$${toNumber(value, 0).toFixed(2)}`;

const resolvePayoutRequestOptions = (currentUserOrOptions, maybeOptions) => {
  if (maybeOptions && typeof maybeOptions === 'object') {
    return maybeOptions;
  }

  const hasAuthShape = Boolean(
    currentUserOrOptions?.uid || currentUserOrOptions?.id || currentUserOrOptions?.email
  );

  if (!hasAuthShape && currentUserOrOptions && typeof currentUserOrOptions === 'object') {
    return currentUserOrOptions;
  }

  return {};
};

const getEdgeFunctionErrorMessage = async (error, fallbackMessage) => {
  const normalized = normalizeError(error, fallbackMessage);
  const context = error?.context;

  if (!context || typeof context.clone !== 'function') {
    return normalized.message;
  }

  try {
    const payload = await context.clone().json();
    return payload?.error || payload?.message || normalized.message;
  } catch (_jsonError) {
    try {
      const text = await context.clone().text();
      return text || normalized.message;
    } catch (_textError) {
      return normalized.message;
    }
  }
};

const buildPendingFundsMessage = ({ pendingAmount = 0, pendingUntil = null } = {}) => {
  const amount = Number(pendingAmount || 0);
  if (pendingUntil) {
    const date = new Date(pendingUntil);
    const dateLabel = Number.isNaN(date.getTime())
      ? pendingUntil
      : date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });

    return `No funds are available to withdraw right now. ${toMoney(amount)} is on Stripe hold until ${dateLabel}.`;
  }

  return `No funds are available to withdraw right now. ${toMoney(amount)} is still on Stripe hold.`;
};

/**
 * Get driver earnings history.
 */
export const getDriverEarningsHistory = async (driverId, period = 'week') => {
  try {
    if (!driverId) {
      return failureResult('Driver ID is required', null, { earnings: [] });
    }

    const fromIso = periodStartIso(period);
    const { data, error } = await fetchCompletedDriverTrips(driverId, fromIso);

    if (error) {
      const normalized = normalizeError(error, 'Unable to load earnings history');
      logger.error('PaymentService', 'getDriverEarningsHistory failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null, { earnings: [] });
    }

    const earnings = (data || []).map((trip) => {
      const total = toNumber(trip.price, 0);
      const driverAmount = resolveDriverPayoutAmount({
        ...trip,
        pricing: trip.pricing || {},
      });

      return {
        id: trip.id,
        amount: driverAmount,
        grossAmount: total,
        distance: toNumber(trip.distance_miles, 0),
        createdAt: trip.created_at,
        completedAt: trip.completed_at,
      };
    });

    return successResult({ earnings });
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to load earnings history');
    logger.error('PaymentService', 'getDriverEarningsHistory failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null, { earnings: [] });
  }
};

/**
 * Get driver payouts history from metadata ledger.
 */
export const getDriverPayouts = async (driverId) => {
  try {
    if (!driverId) return failureResult('Driver ID is required', null, { payouts: [] });

    const profile = await getDriverProfileRow(driverId);
    const payouts = Array.isArray(profile?.metadata?.payouts) ? profile.metadata.payouts : [];

    return successResult({
      payouts,
      totalPayouts: toNumber(profile?.metadata?.totalPayouts, 0),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to load payout history');
    logger.error('PaymentService', 'getDriverPayouts failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null, { payouts: [] });
  }
};

export const getDriverPayoutAvailability = async (driverId) => {
  try {
    if (!driverId) {
      return failureResult('Driver ID is required', null, {
        balanceAmount: 0,
        availableNowAmount: 0,
        pendingAmount: 0,
      });
    }

    const { data, error } = await invokeDriverPayoutAvailability({ driverId });

    if (error) {
      const errorMessage = await getEdgeFunctionErrorMessage(
        error,
        'Unable to load payout availability'
      );
      return failureResult(errorMessage, null, {
        balanceAmount: 0,
        availableNowAmount: 0,
        pendingAmount: 0,
      });
    }

    if (!data?.success) {
      return failureResult(data?.error || 'Unable to load payout availability', null, {
        balanceAmount: 0,
        availableNowAmount: 0,
        pendingAmount: 0,
      });
    }

    return successResult({
      balanceAmount: toNumber(data.balanceAmount, 0),
      availableNowAmount: toNumber(data.availableNowAmount, 0),
      pendingAmount: toNumber(data.pendingAmount, 0),
      pendingUntil: data.pendingUntil || null,
      pendingUntilUnix: data.pendingUntilUnix || null,
      sources: Array.isArray(data.sources) ? data.sources : [],
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to load payout availability');
    logger.error('PaymentService', 'getDriverPayoutAvailability failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null, {
      balanceAmount: 0,
      availableNowAmount: 0,
      pendingAmount: 0,
    });
  }
};

/**
 * Request instant payout.
 */
export const requestInstantPayout = async (
  driverId,
  amount,
  currentUserOrOptions = null,
  maybeOptions = null
) => {
  try {
    if (!driverId) {
      return failureResult('Driver ID is required');
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return failureResult('Invalid payout amount');
    }

    const profile = await getDriverProfileRow(driverId);
    if (!profile) {
      return failureResult('Driver profile not found');
    }

    const metadata = profile.metadata || {};
    const connectAccountId = profile.stripe_account_id || metadata.connectAccountId;
    if (!connectAccountId) {
      return failureResult('Stripe Connect account is not configured');
    }

    const stats = await getDriverStats(driverId);
    const availableBalance = toNumber(stats?.availableBalance, 0);
    if (normalizedAmount > availableBalance) {
      return failureResult(
        `Insufficient available balance. Available: $${availableBalance.toFixed(2)}`
      );
    }

    const availabilityResult = await getDriverPayoutAvailability(driverId);
    if (availabilityResult?.success) {
      const availableNow = toNumber(availabilityResult.availableNowAmount, 0);
      if (normalizedAmount > availableNow) {
        return failureResult(
          buildPendingFundsMessage({
            pendingAmount: availabilityResult.pendingAmount,
            pendingUntil: availabilityResult.pendingUntil,
          }),
          'payout_funds_pending'
        );
      }
    }

    const payoutMode = 'instant';
    const normalizedAmountCents = Math.round(normalizedAmount * 100);
    const transferGroup = `instant_payout:${driverId}:${normalizedAmountCents}`;
    const requestOptions = resolvePayoutRequestOptions(currentUserOrOptions, maybeOptions);
    const explicitIdempotencyKey = sanitizeIdempotencyToken(requestOptions?.idempotencyKey);
    const idempotencyKey =
      explicitIdempotencyKey ||
      ['instant_payout', driverId, payoutMode, normalizedAmountCents, Date.now()].join(':');

    const { data, error } = await invokeProcessPayout({
      amount: Number(normalizedAmount.toFixed(2)),
      currency: 'usd',
      transferGroup,
      driverId,
      mode: payoutMode,
      idempotencyKey,
    });

    if (error) {
      const errorMessage = await getEdgeFunctionErrorMessage(
        error,
        'Failed to process instant payout'
      );
      const normalized = normalizeError(
        { ...error, message: errorMessage },
        'Failed to process instant payout'
      );
      logger.error('PaymentService', 'requestInstantPayout failed', normalized, error);
      return failureResult(errorMessage, normalized.code || null);
    }
    if (!data?.success) {
      return failureResult(data?.error || 'Instant payout failed');
    }

    const now = new Date().toISOString();
    const feeAmount = Number(Number(data?.feeAmount || 0).toFixed(2));
    const payoutStatus = String(data?.status || 'processed').trim() || 'processed';
    const availableOn = data?.availableOn || null;
    const netAmount = Number(
      Number.isFinite(Number(data?.netAmount))
        ? Number(data.netAmount)
        : Number((normalizedAmount - feeAmount).toFixed(2))
    );
    const payoutRecord = {
      id: data.transferId,
      amount: Number(normalizedAmount.toFixed(2)),
      grossAmount: Number(normalizedAmount.toFixed(2)),
      feeAmount,
      netAmount: Number(netAmount.toFixed(2)),
      createdAt: now,
      status: payoutStatus,
      availableOn,
      transferGroup,
      kind: payoutMode,
      sourceTransactionUsed: Boolean(data?.sourceTransactionUsed),
    };

    const nextAvailableBalance = Math.max(
      0,
      Number((availableBalance - payoutRecord.amount).toFixed(2))
    );

    return successResult({
      transferId: data.transferId,
      payout: payoutRecord,
      availableBalance: nextAvailableBalance,
      feeAmount: payoutRecord.feeAmount,
      netAmount: payoutRecord.netAmount,
      status: payoutStatus,
      availableOn,
      sourceTransactionUsed: Boolean(data?.sourceTransactionUsed),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to process instant payout');
    logger.error('PaymentService', 'requestInstantPayout failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

/**
 * Process trip payout through Edge Function.
 */
export const processTripPayout = async (payoutData) => {
  try {
    const { data, error } = await invokeProcessPayout({
      amount: payoutData.amount,
      currency: 'usd',
      transferGroup: payoutData.tripId,
      driverId: payoutData.driverId,
      mode: 'scheduled',
    });

    if (error) {
      const normalized = normalizeError(error, 'Trip payout failed');
      logger.error('PaymentService', 'processTripPayout failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null);
    }

    if (!data.success) {
      return failureResult(data.error || 'Payout processing failed');
    }

    return successResult({ transferId: data.transferId });
  } catch (error) {
    const normalized = normalizeError(error, 'Trip payout failed');
    logger.error('PaymentService', 'processTripPayout failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};
