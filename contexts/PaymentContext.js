import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from './AuthContext';
import { appConfig } from '../config/appConfig';
import { logger } from '../services/logger';
import {
  createCustomerPaymentIntent,
  fetchCustomerPaymentMethods,
  getTripPriceEstimate,
} from '../services/CustomerPaymentService';
import {
  clearStoredDefaultPaymentMethod,
  loadStoredPaymentState,
  saveStoredDefaultPaymentMethod,
  saveStoredPaymentMethods,
} from '../services/PaymentLocalStorageService';

const PaymentContext = createContext();

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['succeeded', 'processing', 'requirescapture']);

const isNetworkRequestFailed = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('network request failed');
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export const PaymentProvider = ({ children }) => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || currentUser?.id;

  const loadSavedPaymentMethods = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      setPaymentMethods([]);
      setDefaultPaymentMethod(null);
      return;
    }

    const storedState = await loadStoredPaymentState(targetUserId);
    setPaymentMethods(Array.isArray(storedState.paymentMethods) ? storedState.paymentMethods : []);
    setDefaultPaymentMethod(storedState.defaultPaymentMethod || null);
  }, [userId]);

  const fetchStripePaymentMethods = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setLoading(true);
      const result = await fetchCustomerPaymentMethods();

      if (!result.success) {
        logger.warn('PaymentContext', 'fetchStripePaymentMethods failed', result.error);
        return result;
      }

      const remoteMethods = Array.isArray(result.paymentMethods) ? result.paymentMethods : [];
      const defaultMethod = remoteMethods.find((method) => method?.isDefault) || null;

      setPaymentMethods(remoteMethods);
      setDefaultPaymentMethod(defaultMethod);

      await saveStoredPaymentMethods(targetUserId, remoteMethods);
      if (defaultMethod) {
        await saveStoredDefaultPaymentMethod(targetUserId, defaultMethod);
      } else {
        await clearStoredDefaultPaymentMethod(targetUserId);
      }

      return { success: true, paymentMethods: remoteMethods };
    } catch (error) {
      logger.error('PaymentContext', 'fetchStripePaymentMethods failed unexpectedly', error);
      return { success: false, error: error?.message || 'Failed to fetch payment methods' };
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPaymentMethods([]);
      setDefaultPaymentMethod(null);
      return;
    }

    loadSavedPaymentMethods(userId);
    fetchStripePaymentMethods(userId);
  }, [fetchStripePaymentMethods, loadSavedPaymentMethods, userId]);

  const savePaymentMethod = async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const newMethods = [...paymentMethods, paymentMethod];
      const nextDefault = newMethods.length === 1 ? paymentMethod : defaultPaymentMethod;

      setPaymentMethods(newMethods);
      setDefaultPaymentMethod(nextDefault);

      await saveStoredPaymentMethods(userId, newMethods);
      if (nextDefault) {
        await saveStoredDefaultPaymentMethod(userId, nextDefault);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentContext', 'savePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to save payment method' };
    }
  };

  const removePaymentMethod = async (methodId) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updatedMethods = paymentMethods.filter((method) => method.id !== methodId);
      const nextDefault =
        defaultPaymentMethod?.id === methodId ? (updatedMethods.length > 0 ? updatedMethods[0] : null) : defaultPaymentMethod;

      setPaymentMethods(updatedMethods);
      setDefaultPaymentMethod(nextDefault);

      await saveStoredPaymentMethods(userId, updatedMethods);
      if (nextDefault) {
        await saveStoredDefaultPaymentMethod(userId, nextDefault);
      } else {
        await clearStoredDefaultPaymentMethod(userId);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentContext', 'removePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to remove payment method' };
    }
  };

  const setDefault = async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setDefaultPaymentMethod(paymentMethod);
      await saveStoredDefaultPaymentMethod(userId, paymentMethod);
      return { success: true };
    } catch (error) {
      logger.error('PaymentContext', 'setDefault failed', error);
      return { success: false, error: error?.message || 'Failed to set default payment method' };
    }
  };

  const createPaymentIntent = async (amount, currency = 'usd', rideDetails = {}, paymentMethodId = null) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated', errorCode: null };
    }

    try {
      setLoading(true);
      return await createCustomerPaymentIntent({
        amount,
        currency,
        rideDetails,
        paymentMethodId: paymentMethodId || defaultPaymentMethod?.stripePaymentMethodId || null,
        userId,
        userEmail: currentUser?.email || null,
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (paymentIntentClientSecret, paymentMethodId = null) => {
    let paymentMethodToUse = null;

    try {
      setLoading(true);

      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      paymentMethodToUse = paymentMethodId || defaultPaymentMethod?.stripePaymentMethodId;
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

      return { success: true, paymentIntent };
    } catch (error) {
      logger.error('PaymentContext', 'confirmPayment failed', error);

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
      setLoading(false);
    }
  };

  const getPriceEstimate = async (rideDetails) => getTripPriceEstimate(rideDetails);

  const value = {
    paymentMethods,
    defaultPaymentMethod,
    loading,
    savePaymentMethod,
    removePaymentMethod,
    setDefault,
    createPaymentIntent,
    confirmPayment,
    loadSavedPaymentMethods,
    fetchStripePaymentMethods,
    getPriceEstimate,
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
};
