import { logger } from './logger';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';
import {
  ensurePaymentAuthSessionReady,
  invokeAttachPaymentMethod,
  invokeCreatePaymentIntent,
  invokeDetachPaymentMethod,
  invokeGetPaymentMethods,
  invokeSetDefaultPaymentMethod,
  invokeTripPriceEstimate,
} from './repositories/paymentRepository';

const parseEdgeFunctionErrorPayload = async (error) => {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') {
    return null;
  }

  try {
    const cloned = response.clone();
    const payload = await cloned.json();
    if (payload && typeof payload === 'object') {
      const normalizedMessage = String(payload.error || payload.message || '').trim();
      const normalizedCode = String(payload.code || payload.errorCode || '').trim();
      return {
        message: normalizedMessage || null,
        code: normalizedCode || null,
      };
    }
  } catch (_error) {
    // Ignore parse errors and keep original error message.
  }

  return null;
};

const ensureAuthSessionReady = async () => {
  try {
    await ensurePaymentAuthSessionReady();
    return null;
  } catch (error) {
    const normalized = normalizeError(error, 'Auth session is not ready yet');
    return failureResult(normalized.message, 'auth_session_not_ready');
  }
};

export const fetchCustomerPaymentMethods = async () => {
  try {
    const authSessionError = await ensureAuthSessionReady();
    if (authSessionError) {
      return {
        ...authSessionError,
        paymentMethods: [],
      };
    }

    const { data, error } = await invokeGetPaymentMethods();
    if (error) {
      const normalized = normalizeError(error, 'Failed to load payment methods');
      logger.error('CustomerPaymentService', 'fetchCustomerPaymentMethods failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null, {
        paymentMethods: [],
      });
    }

    return successResult({
      paymentMethods: Array.isArray(data?.paymentMethods) ? data.paymentMethods : [],
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load payment methods');
    logger.error('CustomerPaymentService', 'fetchCustomerPaymentMethods failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null, {
      paymentMethods: [],
    });
  }
};

export const attachCustomerPaymentMethod = async (paymentMethodId, { setAsDefault = false } = {}) => {
  try {
    const authSessionError = await ensureAuthSessionReady();
    if (authSessionError) {
      return authSessionError;
    }

    const resolvedPaymentMethodId = String(paymentMethodId || '').trim();
    if (!resolvedPaymentMethodId) {
      return failureResult('paymentMethodId is required', 'payment_method_required');
    }

    const { data, error } = await invokeAttachPaymentMethod({
      paymentMethodId: resolvedPaymentMethodId,
      setAsDefault: Boolean(setAsDefault),
    });

    if (error || data?.error) {
      const edgePayload = await parseEdgeFunctionErrorPayload(error);
      const normalized = normalizeError(
        edgePayload?.message
          ? { ...(error || data || {}), message: edgePayload.message, code: edgePayload.code || undefined }
          : (error || data),
        'Failed to attach payment method'
      );
      logger.error('CustomerPaymentService', 'attachCustomerPaymentMethod failed', normalized, {
        rawError: error || data,
        edgePayload,
      });
      return failureResult(normalized.message, normalized.code || null);
    }

    return successResult({
      paymentMethodId: resolvedPaymentMethodId,
      defaultPaymentMethodId: data?.defaultPaymentMethodId || null,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to attach payment method');
    logger.error('CustomerPaymentService', 'attachCustomerPaymentMethod failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const detachCustomerPaymentMethod = async (paymentMethodId) => {
  try {
    const authSessionError = await ensureAuthSessionReady();
    if (authSessionError) {
      return authSessionError;
    }

    const resolvedPaymentMethodId = String(paymentMethodId || '').trim();
    if (!resolvedPaymentMethodId) {
      return failureResult('paymentMethodId is required', 'payment_method_required');
    }

    const { data, error } = await invokeDetachPaymentMethod({
      paymentMethodId: resolvedPaymentMethodId,
    });

    if (error || data?.error) {
      const edgePayload = await parseEdgeFunctionErrorPayload(error);
      const normalized = normalizeError(
        edgePayload?.message
          ? { ...(error || data || {}), message: edgePayload.message, code: edgePayload.code || undefined }
          : (error || data),
        'Failed to remove payment method'
      );
      logger.error('CustomerPaymentService', 'detachCustomerPaymentMethod failed', normalized, {
        rawError: error || data,
        edgePayload,
      });
      return failureResult(normalized.message, normalized.code || null);
    }

    return successResult({
      detachedPaymentMethodId: data?.detachedPaymentMethodId || resolvedPaymentMethodId,
      defaultPaymentMethodId: data?.defaultPaymentMethodId || null,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to remove payment method');
    logger.error('CustomerPaymentService', 'detachCustomerPaymentMethod failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const setCustomerDefaultPaymentMethod = async (paymentMethodId) => {
  try {
    const authSessionError = await ensureAuthSessionReady();
    if (authSessionError) {
      return authSessionError;
    }

    const resolvedPaymentMethodId = String(paymentMethodId || '').trim();
    if (!resolvedPaymentMethodId) {
      return failureResult('paymentMethodId is required', 'payment_method_required');
    }

    const { data, error } = await invokeSetDefaultPaymentMethod({
      paymentMethodId: resolvedPaymentMethodId,
    });

    if (error || data?.error) {
      const edgePayload = await parseEdgeFunctionErrorPayload(error);
      const normalized = normalizeError(
        edgePayload?.message
          ? { ...(error || data || {}), message: edgePayload.message, code: edgePayload.code || undefined }
          : (error || data),
        'Failed to set default payment method'
      );
      logger.error('CustomerPaymentService', 'setCustomerDefaultPaymentMethod failed', normalized, {
        rawError: error || data,
        edgePayload,
      });
      return failureResult(normalized.message, normalized.code || null);
    }

    return successResult({
      defaultPaymentMethodId: data?.defaultPaymentMethodId || resolvedPaymentMethodId,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to set default payment method');
    logger.error('CustomerPaymentService', 'setCustomerDefaultPaymentMethod failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const createCustomerPaymentIntent = async ({
  amount,
  currency = 'usd',
  rideDetails = {},
  paymentMethodId = null,
  userId = null,
  userEmail = null,
  destinationAccountId = null,
  applicationFeeAmount = null,
}) => {
  try {
    const normalizedAmount = Number(amount);
    if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
      return failureResult('Invalid payment amount');
    }

    const { data, error } = await invokeCreatePaymentIntent({
      amount: normalizedAmount,
      currency,
      userEmail,
      userId,
      paymentMethodId: paymentMethodId || null,
      rideDetails,
      destinationAccountId: destinationAccountId || null,
      applicationFeeAmount: applicationFeeAmount != null ? applicationFeeAmount : null,
    });

    if (error) {
      const normalized = normalizeError(error, 'Failed to create payment intent');
      logger.error('CustomerPaymentService', 'createCustomerPaymentIntent failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null);
    }

    if (data?.error) {
      return failureResult(data.error || 'Failed to create payment', data.code || null);
    }

    if (!data?.clientSecret) {
      return failureResult('No client secret returned from payment intent');
    }

    return successResult({
      paymentIntent: {
        client_secret: data.clientSecret,
        id: data.paymentIntentId || null,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Network error');
    logger.error('CustomerPaymentService', 'createCustomerPaymentIntent failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const getTripPriceEstimate = async (rideDetails = {}) => {
  try {
    const { data, error } = await invokeTripPriceEstimate(rideDetails);

    if (error) {
      const normalized = normalizeError(error, 'Failed to load trip estimate');
      logger.error('CustomerPaymentService', 'getTripPriceEstimate failed', normalized, error);
      return failureResult(normalized.message, normalized.code || null);
    }

    return data || failureResult('No estimate returned');
  } catch (error) {
    const normalized = normalizeError(error, 'Network error');
    logger.error('CustomerPaymentService', 'getTripPriceEstimate failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};
