import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredDefaultPaymentMethod,
  loadStoredPaymentState,
  saveStoredDefaultPaymentMethod,
  saveStoredPaymentMethods,
} from '../../services/PaymentLocalStorageService';
import { fetchCustomerPaymentMethods } from '../../services/CustomerPaymentService';
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
      const nextMethods = [...paymentMethods, paymentMethod];
      const nextDefault = nextMethods.length === 1 ? paymentMethod : defaultPaymentMethod;

      setPaymentMethods(nextMethods);
      setDefaultPaymentMethod(nextDefault);

      await saveStoredPaymentMethods(userId, nextMethods);
      if (nextDefault) {
        await saveStoredDefaultPaymentMethod(userId, nextDefault);
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'savePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to save payment method' };
    }
  }, [defaultPaymentMethod, paymentMethods, userId]);

  const removePaymentMethod = useCallback(async (methodId) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
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

      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'removePaymentMethod failed', error);
      return { success: false, error: error?.message || 'Failed to remove payment method' };
    }
  }, [defaultPaymentMethod, paymentMethods, userId]);

  const setDefault = useCallback(async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setDefaultPaymentMethod(paymentMethod);
      await saveStoredDefaultPaymentMethod(userId, paymentMethod);
      return { success: true };
    } catch (error) {
      logger.error('PaymentMethods', 'setDefault failed', error);
      return { success: false, error: error?.message || 'Failed to set default payment method' };
    }
  }, [userId]);

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
