import { normalizeError } from '../errorService';
import { logger } from '../logger';
import { failureResult, successResult } from '../contracts/result';
import {
  invokeCreateDriverConnectAccount,
  invokeDriverOnboardingLink,
  invokeDriverOnboardingStatus,
} from '../repositories/paymentRepository';
import {
  defaultOnboardingRefreshUrl,
  defaultOnboardingReturnUrl,
  getUserId,
} from './common';
import { updateDriverPaymentProfile } from './profile';

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

const syncDriverPaymentProfileBestEffort = async (driverId, updates, scope) => {
  if (!driverId) return;

  try {
    await updateDriverPaymentProfile(driverId, updates);
  } catch (profileError) {
    const normalized = normalizeError(profileError, 'Failed to sync driver payment profile');
    logger.warn('PaymentService', `${scope}: profile sync skipped`, normalized, profileError);
  }
};

/**
 * Create Stripe Connect account for driver.
 */
export const createDriverConnectAccount = async (driverInfo = {}, currentUser = null) => {
  try {
    const driverId = driverInfo.driverId || getUserId(currentUser);
    if (!driverId) {
      return failureResult('Driver ID is required');
    }

    const refreshUrl = driverInfo.refreshUrl || defaultOnboardingRefreshUrl;
    const returnUrl = driverInfo.returnUrl || defaultOnboardingReturnUrl;

    const { data, error } = await invokeCreateDriverConnectAccount(
      {
        driverId,
        email: driverInfo.email || currentUser?.email || null,
        refreshUrl,
        returnUrl,
      },
      currentUser?.accessToken || null
    );

    if (error) {
      const errorMessage = await getEdgeFunctionErrorMessage(error, 'Failed to create payout account');
      logger.error('PaymentService', 'createDriverConnectAccount failed', { message: errorMessage }, error);
      return failureResult(errorMessage);
    }

    if (!data?.success || !data?.accountId) {
      return failureResult(data?.error || 'Failed to create Stripe Connect account');
    }

    await syncDriverPaymentProfileBestEffort(driverId, {
      connectAccountId: data.accountId,
      onboardingComplete: false,
      canReceivePayments: false,
      onboardingLastCheckedAt: new Date().toISOString(),
    }, 'createDriverConnectAccount');

    return successResult({
      connectAccountId: data.accountId,
      onboardingUrl: data.onboardingUrl || null,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to create payout account');
    logger.error('PaymentService', 'createDriverConnectAccount failed', normalized, error);
    return failureResult(normalized.message);
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

    const { data, error } = await invokeDriverOnboardingLink(
      {
        driverId,
        connectAccountId,
        refreshUrl: refreshUrl || defaultOnboardingRefreshUrl,
        returnUrl: returnUrl || defaultOnboardingReturnUrl,
      },
      currentUser?.accessToken || null
    );

    if (error) {
      const errorMessage = await getEdgeFunctionErrorMessage(error, 'Failed to open Stripe onboarding');
      logger.error('PaymentService', 'getDriverOnboardingLink failed', { message: errorMessage }, error);
      return failureResult(errorMessage);
    }
    if (!data?.success || !data?.onboardingUrl) {
      return failureResult(data?.error || 'Failed to create Stripe onboarding link');
    }

    return successResult({
      onboardingUrl: data.onboardingUrl,
      connectAccountId: data.accountId || connectAccountId || null,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to open Stripe onboarding');
    logger.error('PaymentService', 'getDriverOnboardingLink failed', normalized, error);
    return failureResult(normalized.message);
  }
};

/**
 * Check Stripe onboarding status.
 */
export const checkDriverOnboardingStatus = async (connectAccountId = null, currentUser = null) => {
  try {
    const driverId = getUserId(currentUser);

    const { data, error } = await invokeDriverOnboardingStatus(
      {
        driverId,
        connectAccountId,
      },
      currentUser?.accessToken || null
    );

    if (error) {
      const errorMessage = await getEdgeFunctionErrorMessage(error, 'Unable to verify payout account status');
      logger.error('PaymentService', 'checkDriverOnboardingStatus failed', { message: errorMessage }, error);
      return failureResult(errorMessage);
    }
    if (!data?.success) {
      return failureResult(data?.error || 'Could not load onboarding status');
    }

    if (driverId) {
      await syncDriverPaymentProfileBestEffort(
        driverId,
        {
          connectAccountId: data.accountId || connectAccountId || null,
          onboardingComplete: Boolean(data.onboardingComplete),
          canReceivePayments: Boolean(data.canReceivePayments),
          onboardingLastCheckedAt: new Date().toISOString(),
        },
        'checkDriverOnboardingStatus'
      );
    }

    return successResult({
      connectAccountId: data.accountId || connectAccountId || null,
      onboardingComplete: Boolean(data.onboardingComplete),
      canReceivePayments: Boolean(data.canReceivePayments),
      requirements: data.requirements || [],
      status: data.status || (data.onboardingComplete ? 'verified' : 'processing'),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Unable to verify payout account status');
    logger.error('PaymentService', 'checkDriverOnboardingStatus failed', normalized, error);
    return failureResult(normalized.message);
  }
};
