import React, { createContext, useContext, useMemo } from 'react';
import { useAuthIdentity } from './AuthContext';
import { useStoredPaymentMethods } from '../hooks/payment/useStoredPaymentMethods';
import { usePaymentIntents } from '../hooks/payment/usePaymentIntents';

const PaymentContext = createContext();

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export const PaymentProvider = ({ children }) => {
  const { currentUser } = useAuthIdentity();
  const userId = currentUser?.uid || currentUser?.id;

  const {
    paymentMethods,
    defaultPaymentMethod,
    methodsLoading,
    savePaymentMethod,
    removePaymentMethod,
    setDefault,
    loadSavedPaymentMethods,
    fetchStripePaymentMethods,
  } = useStoredPaymentMethods({ userId });

  const {
    paymentLoading,
    createPaymentIntent,
    confirmPayment,
    getPriceEstimate,
  } = usePaymentIntents({
    userId,
    userEmail: currentUser?.email || null,
    defaultPaymentMethodId: defaultPaymentMethod?.stripePaymentMethodId || null,
  });

  const value = useMemo(() => ({
    paymentMethods,
    defaultPaymentMethod,
    loading: methodsLoading || paymentLoading,
    savePaymentMethod,
    removePaymentMethod,
    setDefault,
    createPaymentIntent,
    confirmPayment,
    loadSavedPaymentMethods,
    fetchStripePaymentMethods,
    getPriceEstimate,
  }), [
    paymentMethods,
    defaultPaymentMethod,
    methodsLoading,
    paymentLoading,
    savePaymentMethod,
    removePaymentMethod,
    setDefault,
    createPaymentIntent,
    confirmPayment,
    loadSavedPaymentMethods,
    fetchStripePaymentMethods,
    getPriceEstimate,
  ]);

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
};
