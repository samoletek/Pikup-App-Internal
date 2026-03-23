import { useCallback, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { appConfig } from '../../config/appConfig';
import {
  createCustomerPaymentIntent,
  getTripPriceEstimate,
} from '../../services/CustomerPaymentService';
import { logFlowError, logFlowInfo, startFlowContext } from '../../services/flowContext';

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['succeeded', 'processing', 'requirescapture']);

const isNetworkRequestFailed = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('network request failed');
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Encapsulates payment-intent creation/confirmation with Stripe and fallback behavior for dev mocks.
 */
export const usePaymentIntents = ({ userId, userEmail, defaultPaymentMethodId }) => {
  const stripe = useStripe();
  const [paymentLoading, setPaymentLoading] = useState(false);

  const createPaymentIntent = useCallback(async (
    amount,
    currency = 'usd',
    rideDetails = {},
    paymentMethodId = null,
    { destinationAccountId = null, applicationFeeAmount = null } = {}
  ) => {
    const flowContext = startFlowContext('payment.createIntent', {
      userId,
      amount,
      currency,
    });
    if (!userId) {
      return { success: false, error: 'User not authenticated', errorCode: null };
    }

    try {
      setPaymentLoading(true);
      logFlowInfo('PaymentIntents', 'create payment intent started', flowContext);
      return await createCustomerPaymentIntent({
        amount,
        currency,
        rideDetails,
        paymentMethodId: paymentMethodId || defaultPaymentMethodId || null,
        userId,
        userEmail: userEmail || null,
        destinationAccountId,
        applicationFeeAmount,
      });
    } catch (error) {
      const normalized = logFlowError(
        'PaymentIntents',
        'create payment intent failed',
        error,
        flowContext,
        'Could not create payment intent'
      );
      return {
        success: false,
        error: normalized.message,
        errorCode: normalized.code,
      };
    } finally {
      setPaymentLoading(false);
    }
  }, [defaultPaymentMethodId, userEmail, userId]);

  const confirmPayment = useCallback(async (paymentIntentClientSecret, paymentMethodId = null) => {
    let paymentMethodToUse = null;
    const flowContext = startFlowContext('payment.confirm', {
      userId,
      hasExplicitPaymentMethod: Boolean(paymentMethodId),
    });

    try {
      setPaymentLoading(true);
      logFlowInfo('PaymentIntents', 'payment confirmation started', flowContext);

      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      paymentMethodToUse = paymentMethodId || defaultPaymentMethodId;
      if (!paymentMethodToUse) {
        throw new Error('No payment method available');
      }

      const { paymentIntent, error } = await stripe.confirmPayment(paymentIntentClientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          paymentMethodId: paymentMethodToUse,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to confirm payment',
          errorCode: error.code || null,
        };
      }

      if (!paymentIntent) {
        return {
          success: false,
          error: 'Payment confirmation returned no payment intent.',
          errorCode: null,
        };
      }

      const normalizedStatus = String(paymentIntent.status || '').toLowerCase().replace(/_/g, '');
      if (!SUCCESSFUL_PAYMENT_STATUSES.has(normalizedStatus)) {
        return {
          success: false,
          error: `Payment not completed (status: ${paymentIntent.status}).`,
          errorCode: null,
        };
      }

      logFlowInfo('PaymentIntents', 'payment confirmation succeeded', {
        ...flowContext,
        status: paymentIntent.status,
      });
      return { success: true, paymentIntent };
    } catch (error) {
      logFlowError(
        'PaymentIntents',
        'payment confirmation failed',
        error,
        flowContext,
        'Payment confirmation failed'
      );

      // TODO(remove before production): keep local confirmation mock only behind dev mock flag.
      if (appConfig.devMocks.enabled && isNetworkRequestFailed(error)) {
        await delay(1000);
        const mockPaymentIntent = {
          id: String(paymentIntentClientSecret || '').split('_secret_')[0],
          status: 'succeeded',
          amount: 4000,
          currency: 'usd',
          payment_method: paymentMethodToUse,
          created: Date.now(),
          description: 'PikUp delivery payment',
        };

        return { success: true, paymentIntent: mockPaymentIntent };
      }

      return {
        success: false,
        error: error?.message || 'Network error',
        errorCode: null,
      };
    } finally {
      setPaymentLoading(false);
    }
  }, [defaultPaymentMethodId, stripe, userId]);

  const getPriceEstimate = useCallback(async (rideDetails) => {
    return getTripPriceEstimate(rideDetails);
  }, []);

  return {
    paymentLoading,
    createPaymentIntent,
    confirmPayment,
    getPriceEstimate,
  };
};
