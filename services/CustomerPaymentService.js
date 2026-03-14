import { supabase } from '../config/supabase';
import { logger } from './logger';
import { normalizeError } from './errorService';

export const fetchCustomerPaymentMethods = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('get-payment-methods');
    if (error) {
      throw error;
    }

    return {
      success: true,
      paymentMethods: Array.isArray(data?.paymentMethods) ? data.paymentMethods : [],
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load payment methods');
    logger.error('CustomerPaymentService', 'fetchCustomerPaymentMethods failed', normalized, error);
    return {
      success: false,
      paymentMethods: [],
      error: normalized.message,
      errorCode: normalized.code || null,
    };
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
      return { success: false, error: 'Invalid payment amount', errorCode: null };
    }

    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        amount: normalizedAmount,
        currency,
        userEmail,
        userId,
        paymentMethodId: paymentMethodId || null,
        rideDetails,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error || 'Failed to create payment',
        errorCode: data.code || null,
      };
    }

    if (!data?.clientSecret) {
      return {
        success: false,
        error: 'No client secret returned from payment intent',
        errorCode: null,
      };
    }

    return {
      success: true,
      paymentIntent: {
        client_secret: data.clientSecret,
        id: data.paymentIntentId || null,
      },
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Network error');
    logger.error('CustomerPaymentService', 'createCustomerPaymentIntent failed', normalized, error);
    return {
      success: false,
      error: normalized.message,
      errorCode: normalized.code || null,
    };
  }
};

export const getTripPriceEstimate = async (rideDetails = {}) => {
  try {
    const { data, error } = await supabase.functions.invoke('calculate-trip-price', {
      body: { rideDetails },
    });

    if (error) {
      throw error;
    }

    return data || { success: false, error: 'No estimate returned', errorCode: null };
  } catch (error) {
    const normalized = normalizeError(error, 'Network error');
    logger.error('CustomerPaymentService', 'getTripPriceEstimate failed', normalized, error);
    return {
      success: false,
      error: normalized.message,
      errorCode: normalized.code || null,
    };
  }
};
