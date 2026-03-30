import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredDefaultPaymentMethod,
  loadStoredPaymentState,
  saveStoredDefaultPaymentMethod,
  saveStoredPaymentMethods,
} from '../../services/PaymentLocalStorageService';
import {
  attachCustomerPaymentMethod,
  detachCustomerPaymentMethod,
  fetchCustomerPaymentMethods,
  setCustomerDefaultPaymentMethod,
} from '../../services/CustomerPaymentService';
import { logger } from '../../services/logger';

/**
 * Manages persisted payment methods and background sync with Stripe-backed methods API.
 */
export const useStoredPaymentMethods = ({ userId }) => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(null);
  const [methodsLoading, setMethodsLoading] = useState(false);

  const resetMethodsState = useCallback(() => {
    setPaymentMethods([]);
    setDefaultPaymentMethod(null);
  }, []);

  const loadSavedPaymentMethods = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      resetMethodsState();
      return;
    }

    const storedState = await loadStoredPaymentState(targetUserId);
    setPaymentMethods(Array.isArray(storedState.paymentMethods) ? storedState.paymentMethods : []);
    setDefaultPaymentMethod(storedState.defaultPaymentMethod || null);
  }, [userId, resetMethodsState]);

  const fetchStripePaymentMethods = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setMethodsLoading(true);
      const result = await fetchCustomerPaymentMethods();

      if (!result.success) {
        logger.warn('PaymentMethods', 'fetchStripePaymentMethods failed', result.error);
        return result;
      }

      const remoteMethods = Array.isArray(result.paymentMethods) ? result.paymentMethods : [];

      const nextDefault = remoteMethods.find((method) => method?.isDefault) || null;

      setPaymentMethods(remoteMethods);
      setDefaultPaymentMethod(nextDefault);

      await saveStoredPaymentMethods(targetUserId, remoteMethods);
      if (nextDefault) {
        await saveStoredDefaultPaymentMethod(targetUserId, nextDefault);
      } else {
        await clearStoredDefaultPaymentMethod(targetUserId);
      }

      return { success: true, paymentMethods: remoteMethods };
    } catch (error) {
      logger.error('PaymentMethods', 'fetchStripePaymentMethods failed unexpectedly', error);
      return { success: false, error: error?.message || 'Failed to fetch payment methods' };
    } finally {
      setMethodsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      resetMethodsState();
      return;
    }

    loadSavedPaymentMethods(userId);
    fetchStripePaymentMethods(userId);
  }, [fetchStripePaymentMethods, loadSavedPaymentMethods, resetMethodsState, userId]);

  const savePaymentMethod = useCallback(async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const resolvedPaymentMethodId = String(
        paymentMethod?.stripePaymentMethodId ||
        paymentMethod?.id ||
        ''
      ).trim();
      if (!resolvedPaymentMethodId) {
        return { success: false, error: 'Missing Stripe payment method id' };
      }

      const shouldSetAsDefault = paymentMethods.length === 0 || !defaultPaymentMethod?.id;
      const attachResult = await attachCustomerPaymentMethod(resolvedPaymentMethodId, {
        setAsDefault: shouldSetAsDefault,
      });
      if (!attachResult.success) {
        return { success: false, error: attachResult.error || 'Failed to save payment method' };
      }

      const refreshResult = await fetchStripePaymentMethods(userId);
      if (!refreshResult.success) {
        logger.warn('PaymentMethods', 'savePaymentMethod remote refresh failed', refreshResult.error);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'savePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to save payment method' };
    }
  }, [defaultPaymentMethod?.id, fetchStripePaymentMethods, paymentMethods.length, userId]);

  const removePaymentMethod = useCallback(async (methodId) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const detachResult = await detachCustomerPaymentMethod(methodId);
      if (!detachResult.success) {
        return { success: false, error: detachResult.error || 'Failed to remove payment method' };
      }

      const nextMethods = paymentMethods.filter((method) => method.id !== methodId);
      const nextDefault =
        defaultPaymentMethod?.id === methodId
          ? (nextMethods.length > 0 ? nextMethods[0] : null)
          : defaultPaymentMethod;

      setPaymentMethods(nextMethods);
      setDefaultPaymentMethod(nextDefault);

      await saveStoredPaymentMethods(userId, nextMethods);
      if (nextDefault) {
        await saveStoredDefaultPaymentMethod(userId, nextDefault);
      } else {
        await clearStoredDefaultPaymentMethod(userId);
      }

      const refreshResult = await fetchStripePaymentMethods(userId);
      if (!refreshResult.success) {
        logger.warn('PaymentMethods', 'removePaymentMethod remote refresh failed', refreshResult.error);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'removePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to remove payment method' };
    }
  }, [defaultPaymentMethod, fetchStripePaymentMethods, paymentMethods, userId]);

  const setDefault = useCallback(async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const resolvedPaymentMethodId = String(
        paymentMethod?.stripePaymentMethodId ||
        paymentMethod?.id ||
        ''
      ).trim();
      if (!resolvedPaymentMethodId) {
        return { success: false, error: 'Missing Stripe payment method id' };
      }

      const setDefaultResult = await setCustomerDefaultPaymentMethod(resolvedPaymentMethodId);
      if (!setDefaultResult.success) {
        return {
          success: false,
          error: setDefaultResult.error || 'Failed to set default payment method',
        };
      }

      setDefaultPaymentMethod(paymentMethod);
      await saveStoredDefaultPaymentMethod(userId, paymentMethod);

      const refreshResult = await fetchStripePaymentMethods(userId);
      if (!refreshResult.success) {
        logger.warn('PaymentMethods', 'setDefault remote refresh failed', refreshResult.error);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'setDefault failed', error);
      return { success: false, error: error?.message || 'Failed to set default payment method' };
    }
  }, [fetchStripePaymentMethods, userId]);

  return {
    paymentMethods,
    defaultPaymentMethod,
    methodsLoading,
    savePaymentMethod,
    removePaymentMethod,
    setDefault,
    loadSavedPaymentMethods,
    fetchStripePaymentMethods,
  };
};
