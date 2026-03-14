// services/PaymentService.js
// Stripe Connect + payouts + payment profile state

import { supabase } from '../config/supabase';
import { appConfig } from '../config/appConfig';
import { logger } from './logger';
import { normalizeError } from './errorService';

const isNoRowsError = (error) => error?.code === 'PGRST116';

const getUserId = (currentUser) => currentUser?.uid || currentUser?.id || null;

const defaultOnboardingRefreshUrl = `${appConfig.stripe.urlScheme}://driver-onboarding`;
const defaultOnboardingReturnUrl = `${appConfig.stripe.urlScheme}://driver-onboarding-complete`;

const getDriverProfileRow = async (driverId) => {
  if (!driverId) return null;
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data || null;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const periodStartIso = (period = 'week') => {
  const now = new Date();
  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString();
  }

  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);
  return mondayDate.toISOString();
};

/**
 * Create Stripe Connect account for driver.
 */
export const createDriverConnectAccount = async (driverInfo = {}, currentUser = null) => {
  try {
    const driverId = driverInfo.driverId || getUserId(currentUser);
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const refreshUrl = driverInfo.refreshUrl || defaultOnboardingRefreshUrl;
    const returnUrl = driverInfo.returnUrl || defaultOnboardingReturnUrl;

    const { data, error } = await supabase.functions.invoke('create-driver-connect-account', {
      body: {
        driverId,
        email: driverInfo.email || currentUser?.email || null,
        refreshUrl,
        returnUrl,
      },
    });

    if (error) throw error;

    if (!data?.success || !data?.accountId) {
      throw new Error(data?.error || 'Failed to create Stripe Connect account');
    }

    await updateDriverPaymentProfile(driverId, {
      connectAccountId: data.accountId,
      onboardingComplete: false,
      canReceivePayments: false,
      onboardingLastCheckedAt: new Date().toISOString(),
    });

    return {
      success: true,
      connectAccountId: data.accountId,
      onboardingUrl: data.onboardingUrl || null,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to create payout account');
    logger.error('PaymentService', 'createDriverConnectAccount failed', normalized, error);
    return { success: false, error: normalized.message };
  }
};

/**
 * Get Stripe onboarding link for driver.
 */
export const getDriverOnboardingLink = async (
  connectAccountId = null,
  refreshUrl = null,
  returnUrl = null,
  currentUser = null
) => {
  try {
    const driverId = getUserId(currentUser);

    const { data, error } = await supabase.functions.invoke('get-driver-onboarding-link', {
      body: {
        driverId,
        connectAccountId,
        refreshUrl: refreshUrl || defaultOnboardingRefreshUrl,
        returnUrl: returnUrl || defaultOnboardingReturnUrl,
      },
    });

    if (error) throw error;
    if (!data?.success || !data?.onboardingUrl) {
      throw new Error(data?.error || 'Failed to create Stripe onboarding link');
    }

    return {
      success: true,
      onboardingUrl: data.onboardingUrl,
      connectAccountId: data.accountId || connectAccountId || null,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to open Stripe onboarding');
    logger.error('PaymentService', 'getDriverOnboardingLink failed', normalized, error);
    return { success: false, error: normalized.message };
  }
};

/**
 * Update driver payment profile metadata.
 */
export const updateDriverPaymentProfile = async (driverId, updates = {}) => {
  try {
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const now = new Date().toISOString();

    const profile = await getDriverProfileRow(driverId);
    const currentMeta = profile?.metadata || {};

    const newMeta = { ...currentMeta, ...updates, updatedAt: now };
    const columnUpdates = {
      metadata: newMeta,
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(updates, 'onboardingComplete')) {
      columnUpdates.onboarding_complete = Boolean(updates.onboardingComplete);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'canReceivePayments')) {
      columnUpdates.can_receive_payments = Boolean(updates.canReceivePayments);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'connectAccountId')) {
      columnUpdates.stripe_account_id = updates.connectAccountId || null;
    }

    const { data, error } = await supabase
      .from('drivers')
      .update(columnUpdates)
      .eq('id', driverId)
      .select('*')
      .maybeSingle();

    if (error && !isNoRowsError(error)) throw error;
    if (data) return data;

    if (profile) {
      return {
        ...profile,
        ...columnUpdates,
        id: driverId,
        metadata: newMeta,
      };
    }

    const { data: authData } = await supabase.auth.getUser();
    const fallbackEmail = profile?.email || authData?.user?.email || null;
    const upsertPayload = {
      id: driverId,
      ...columnUpdates,
    };

    if (fallbackEmail) {
      upsertPayload.email = fallbackEmail;
    }

    const { data: upsertedData, error: upsertError } = await supabase
      .from('drivers')
      .upsert(upsertPayload)
      .select('*')
      .maybeSingle();

    if (upsertError) throw upsertError;
    return upsertedData || upsertPayload;
  } catch (error) {
    logger.error('PaymentService', 'updateDriverPaymentProfile failed', error);
    throw error;
  }
};

/**
 * Check Stripe onboarding status.
 */
export const checkDriverOnboardingStatus = async (connectAccountId = null, currentUser = null) => {
  try {
    const driverId = getUserId(currentUser);

    const { data, error } = await supabase.functions.invoke('check-driver-onboarding-status', {
      body: {
        driverId,
        connectAccountId,
      },
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Could not load onboarding status');
    }

    if (driverId) {
      await updateDriverPaymentProfile(driverId, {
        connectAccountId: data.accountId || connectAccountId || null,
        onboardingComplete: Boolean(data.onboardingComplete),
        canReceivePayments: Boolean(data.canReceivePayments),
        onboardingLastCheckedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      connectAccountId: data.accountId || connectAccountId || null,
      onboardingComplete: Boolean(data.onboardingComplete),
      canReceivePayments: Boolean(data.canReceivePayments),
      requirements: data.requirements || [],
      status: data.status || (data.onboardingComplete ? 'verified' : 'processing'),
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to verify payout account status');
    logger.error('PaymentService', 'checkDriverOnboardingStatus failed', normalized, error);
    return { success: false, error: normalized.message };
  }
};

/**
 * Get driver earnings history.
 */
export const getDriverEarningsHistory = async (driverId, period = 'week') => {
  try {
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const fromIso = periodStartIso(period);
    const { data, error } = await supabase
      .from('trips')
      .select('id, price, created_at, completed_at, distance_miles, status')
      .eq('driver_id', driverId)
      .eq('status', 'completed')
      .gte('created_at', fromIso)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const earnings = (data || []).map((trip) => {
      const total = toNumber(trip.price, 0);
      const driverAmount = Number((total * 0.75).toFixed(2));

      return {
        id: trip.id,
        amount: driverAmount,
        grossAmount: total,
        distance: toNumber(trip.distance_miles, 0),
        createdAt: trip.created_at,
        completedAt: trip.completed_at,
      };
    });

    return { success: true, earnings };
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to load earnings history');
    logger.error('PaymentService', 'getDriverEarningsHistory failed', normalized, error);
    return { success: false, error: normalized.message, earnings: [] };
  }
};

/**
 * Get driver payouts history from metadata ledger.
 */
export const getDriverPayouts = async (driverId) => {
  try {
    if (!driverId) throw new Error('Driver ID is required');

    const profile = await getDriverProfileRow(driverId);
    const payouts = Array.isArray(profile?.metadata?.payouts) ? profile.metadata.payouts : [];

    return {
      success: true,
      payouts,
      totalPayouts: toNumber(profile?.metadata?.totalPayouts, 0),
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to load payout history');
    logger.error('PaymentService', 'getDriverPayouts failed', normalized, error);
    return { success: false, error: normalized.message, payouts: [] };
  }
};

/**
 * Request instant payout.
 */
export const requestInstantPayout = async (driverId, amount, currentUser = null) => {
  try {
    if (!driverId) {
      throw new Error('Driver ID is required');
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error('Invalid payout amount');
    }

    const profile = await getDriverProfileRow(driverId);
    if (!profile) {
      throw new Error('Driver profile not found');
    }

    const metadata = profile.metadata || {};
    const connectAccountId = profile.stripe_account_id || metadata.connectAccountId;
    if (!connectAccountId) {
      throw new Error('Stripe Connect account is not configured');
    }

    const availableBalance = toNumber(metadata.availableBalance, 0);
    if (normalizedAmount > availableBalance) {
      throw new Error(`Insufficient available balance. Available: $${availableBalance.toFixed(2)}`);
    }

    const transferGroup = `instant_payout:${driverId}:${Date.now()}`;

    const { data, error } = await supabase.functions.invoke('process-payout', {
      body: {
        amount: Number(normalizedAmount.toFixed(2)),
        currency: 'usd',
        connectAccountId,
        transferGroup,
        driverId,
      },
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Instant payout failed');
    }

    const now = new Date().toISOString();
    const payoutRecord = {
      id: data.transferId,
      amount: Number(normalizedAmount.toFixed(2)),
      createdAt: now,
      status: 'processed',
      transferGroup,
      kind: 'instant',
    };

    const currentPayouts = Array.isArray(metadata.payouts) ? metadata.payouts : [];
    const totalPayouts = toNumber(metadata.totalPayouts, 0) + payoutRecord.amount;
    const nextAvailableBalance = Math.max(0, Number((availableBalance - payoutRecord.amount).toFixed(2)));

    await updateDriverPaymentProfile(driverId, {
      payouts: [payoutRecord, ...currentPayouts].slice(0, 100),
      totalPayouts: Number(totalPayouts.toFixed(2)),
      availableBalance: nextAvailableBalance,
      lastPayoutAt: now,
      lastPayoutId: data.transferId,
    });

    return {
      success: true,
      transferId: data.transferId,
      payout: payoutRecord,
      availableBalance: nextAvailableBalance,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to process instant payout');
    logger.error('PaymentService', 'requestInstantPayout failed', normalized, error);
    return { success: false, error: normalized.message };
  }
};

/**
 * Process trip payout through Edge Function.
 */
export const processTripPayout = async (payoutData) => {
  try {
    const { data, error } = await supabase.functions.invoke('process-payout', {
      body: {
        amount: payoutData.amount,
        currency: 'usd',
        connectAccountId: payoutData.connectAccountId,
        transferGroup: payoutData.tripId,
        driverId: payoutData.driverId,
      },
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Payout processing failed');
    }

    return { success: true, transferId: data.transferId };
  } catch (error) {
    const normalized = normalizeError(error, 'Trip payout failed');
    logger.error('PaymentService', 'processTripPayout failed', normalized, error);
    return { success: false, error: normalized.message };
  }
};

/**
 * Create Stripe Identity verification session.
 */
export const createVerificationSession = async (userData, currentUser) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-verification-session', {
      body: {
        userId: currentUser.uid || currentUser.id,
        email: currentUser.email,
        ...userData,
      },
    });

    if (error) {
      throw new Error(error.message || 'Verification session creation failed');
    }

    return data;
  } catch (error) {
    logger.error('PaymentService', 'createVerificationSession failed', error);
    throw error;
  }
};
