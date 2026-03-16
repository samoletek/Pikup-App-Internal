import { logger } from './logger';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';
import {
  invokeCreatePaymentIntent,
  invokeGetPaymentMethods,
  invokeTripPriceEstimate,
} from './repositories/paymentRepository';

export const fetchCustomerPaymentMethods = async () => {
  try {
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

export const createCustomerPaymentIntent = async ({
  amount,
  currency = 'usd',
  rideDetails = {},
  paymentMethodId = null,
  userId = null,
  userEmail = null,
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
