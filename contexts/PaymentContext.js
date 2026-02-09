import React, { createContext, useContext, useState, useEffect } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

const PaymentContext = createContext();

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

  const getPaymentMethodsKey = (targetUserId) => `paymentMethods:${targetUserId}`;
  const getDefaultMethodKey = (targetUserId) => `defaultPaymentMethod:${targetUserId}`;

  const loadSavedPaymentMethods = async (targetUserId = userId) => {
    if (!targetUserId) {
      setPaymentMethods([]);
      setDefaultPaymentMethod(null);
      return;
    }

    try {
      const saved = await AsyncStorage.getItem(getPaymentMethodsKey(targetUserId));
      const defaultMethod = await AsyncStorage.getItem(getDefaultMethodKey(targetUserId));

      if (saved) {
        setPaymentMethods(JSON.parse(saved));
      } else {
        setPaymentMethods([]);
      }

      if (defaultMethod) {
        setDefaultPaymentMethod(JSON.parse(defaultMethod));
      } else {
        setDefaultPaymentMethod(null);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  useEffect(() => {
    if (!userId) {
      setPaymentMethods([]);
      setDefaultPaymentMethod(null);
      return;
    }

    loadSavedPaymentMethods(userId);
    fetchStripePaymentMethods(userId);
  }, [userId]);

  // Fetch saved payment methods from Stripe
  const fetchStripePaymentMethods = async (targetUserId = userId) => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      console.log('Fetching payment methods for:', userId);

      console.log('Invoking get-payment-methods Edge Function...');
      const { data, error } = await supabase.functions.invoke('get-payment-methods');

      if (error) {
        throw error;
      }

      console.log('Payment methods fetched:', data.paymentMethods?.length);

      setPaymentMethods(data.paymentMethods || []);
      await AsyncStorage.setItem(getPaymentMethodsKey(targetUserId), JSON.stringify(data.paymentMethods || []));

      // Set default if exists
      const defaultMethod = data.paymentMethods?.find(pm => pm.isDefault);
      if (defaultMethod) {
        setDefaultPaymentMethod(defaultMethod);
        await AsyncStorage.setItem(getDefaultMethodKey(targetUserId), JSON.stringify(defaultMethod));
      } else {
        setDefaultPaymentMethod(null);
        await AsyncStorage.removeItem(getDefaultMethodKey(targetUserId));
      }
    } catch (error) {
      console.error('Error fetching Stripe payment methods:', error);
      // Fallback to local storage on error
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethod = async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const newMethods = [...paymentMethods, paymentMethod];
      setPaymentMethods(newMethods);

      // Set as default if it's the first one
      if (newMethods.length === 1) {
        setDefaultPaymentMethod(paymentMethod);
        await AsyncStorage.setItem(getDefaultMethodKey(userId), JSON.stringify(paymentMethod));
      }

      await AsyncStorage.setItem(getPaymentMethodsKey(userId), JSON.stringify(newMethods));
      return { success: true };
    } catch (error) {
      console.error('Error saving payment method:', error);
      return { success: false, error: error.message };
    }
  };

  const removePaymentMethod = async (methodId) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updatedMethods = paymentMethods.filter(method => method.id !== methodId);
      setPaymentMethods(updatedMethods);

      // If removing default method, set new default
      if (defaultPaymentMethod?.id === methodId) {
        const newDefault = updatedMethods.length > 0 ? updatedMethods[0] : null;
        setDefaultPaymentMethod(newDefault);
        if (newDefault) {
          await AsyncStorage.setItem(getDefaultMethodKey(userId), JSON.stringify(newDefault));
        } else {
          await AsyncStorage.removeItem(getDefaultMethodKey(userId));
        }
      }

      await AsyncStorage.setItem(getPaymentMethodsKey(userId), JSON.stringify(updatedMethods));
      return { success: true };
    } catch (error) {
      console.error('Error removing payment method:', error);
      return { success: false, error: error.message };
    }
  };

  const setDefault = async (paymentMethod) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      setDefaultPaymentMethod(paymentMethod);
      await AsyncStorage.setItem(getDefaultMethodKey(userId), JSON.stringify(paymentMethod));
      return { success: true };
    } catch (error) {
      console.error('Error setting default payment method:', error);
      return { success: false, error: error.message };
    }
  };

  // Create a payment intent for processing payment
  const createPaymentIntent = async (amount, currency = 'usd', rideDetails = {}, paymentMethodId = null) => {
    if (!userId) {
      return { success: false, error: 'User not authenticated', errorCode: null };
    }

    const normalizedAmount = Number(amount);
    if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
      return { success: false, error: 'Invalid payment amount', errorCode: null };
    }

    try {
      setLoading(true);
      console.log(`Creating payment intent for ${normalizedAmount} cents`);

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: normalizedAmount,
          currency,
          userEmail: currentUser?.email,
          userId,
          paymentMethodId: paymentMethodId || defaultPaymentMethod?.stripePaymentMethodId,
          rideDetails,
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        return {
          success: false,
          error: data.error || 'Failed to create payment',
          errorCode: data.code || null,
        };
      }

      console.log('Payment intent created successfully:', data.clientSecret);
      // Construct paymentIntent object similar to what Stripe expects or existing app logic
      return {
        success: true,
        paymentIntent: {
          client_secret: data.clientSecret,
          id: data.paymentIntentId // Ensure Edge Function returns this if needed by app
        }
      };

    } catch (error) {
      console.error('Error creating payment intent:', error);
      return { success: false, error: error.message || 'Network error', errorCode: null };
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (paymentIntentClientSecret, paymentMethodId = null) => {
    try {
      setLoading(true);
      console.log('Confirming payment with client secret:', paymentIntentClientSecret);

      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      const paymentMethodToUse = paymentMethodId || defaultPaymentMethod?.stripePaymentMethodId;

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

      const successfulStatuses = new Set(['Succeeded', 'Processing', 'RequiresCapture']);
      if (!successfulStatuses.has(paymentIntent.status)) {
        return {
          success: false,
          error: `Payment not completed (status: ${paymentIntent.status}).`,
          errorCode: null,
        };
      }

      console.log('Payment confirmed successfully:', paymentIntent);
      return { success: true, paymentIntent };

    } catch (error) {
      console.error('Error confirming payment:', error);

      // Fallback to mock for development/testing
      if (__DEV__ && error.message.includes('Network request failed')) {
        console.log('Falling back to mock payment confirmation for development');

        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create mock successful payment result
        const mockPaymentIntent = {
          id: paymentIntentClientSecret.split('_secret_')[0],
          status: 'succeeded',
          amount: 4000, // Mock amount in cents
          currency: 'usd',
          payment_method: paymentMethodToUse,
          created: Date.now(),
          description: 'PikUp delivery payment'
        };

        return { success: true, paymentIntent: mockPaymentIntent };
      }

      return { success: false, error: error.message || 'Network error', errorCode: null };
    } finally {
      setLoading(false);
    }
  };

  // Optional: Get real-time price estimate from your service
  const getPriceEstimate = async (rideDetails) => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-trip-price', {
        body: { rideDetails }
      });

      if (error) {
        throw error;
      }

      return data || { success: false, error: 'No estimate returned', errorCode: null };
    } catch (error) {
      console.error('Error getting price estimate:', error);
      // Return structured error instead of null
      return {
        success: false,
        error: error.message || 'Network error',
        errorCode: null,
      };
    }
  };

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
    fetchStripePaymentMethods, // New function to sync with Stripe
    getPriceEstimate, // New function for real-time pricing
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};
