import React, { createContext, useContext, useState, useEffect } from 'react';
import { useStripe } from '@stripe/stripe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

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

  // Configuration - Backend server URL
  // For Android emulator: use 10.0.2.2 if backend is on same machine
  // For Android device: use your machine's IP address (e.g., 192.168.1.100)
  // TODO: Replace with your actual backend URL
  const PAYMENT_SERVICE_URL = 'https://pikup-server.onrender.com'; // Always use Render server

  // Load saved payment methods on app start
  useEffect(() => {
    loadSavedPaymentMethods();
  }, []);

  // Fetch saved payment methods from Stripe when user logs in
  useEffect(() => {
    if (currentUser?.uid) {
      fetchStripePaymentMethods();
    }
  }, [currentUser]);

  const loadSavedPaymentMethods = async () => {
    try {
      const saved = await AsyncStorage.getItem('paymentMethods');
      const defaultMethod = await AsyncStorage.getItem('defaultPaymentMethod');
      
      if (saved) {
        setPaymentMethods(JSON.parse(saved));
      }
      if (defaultMethod) {
        setDefaultPaymentMethod(JSON.parse(defaultMethod));
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  // Fetch saved payment methods from Stripe
  const fetchStripePaymentMethods = async () => {
    if (!currentUser?.uid) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${PAYMENT_SERVICE_URL}/customer-payment-methods/${currentUser.uid}`);
      const data = await response.json();
      
      if (data.success && data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
        await AsyncStorage.setItem('paymentMethods', JSON.stringify(data.paymentMethods));
        
        const defaultMethod = data.paymentMethods.find(
          pm => pm.id === data.defaultPaymentMethodId || pm.isDefault
        );
        if (defaultMethod) {
          setDefaultPaymentMethod(defaultMethod);
          await AsyncStorage.setItem('defaultPaymentMethod', JSON.stringify(defaultMethod));
        }
      }
    } catch (error) {
      console.error('Error fetching Stripe payment methods:', error);
      // Fallback to local storage on error
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethod = async (paymentMethod) => {
    try {
      const newMethods = [...paymentMethods, paymentMethod];
      setPaymentMethods(newMethods);
      
      // Set as default if it's the first one
      if (newMethods.length === 1) {
        setDefaultPaymentMethod(paymentMethod);
        await AsyncStorage.setItem('defaultPaymentMethod', JSON.stringify(paymentMethod));
      }
      
      await AsyncStorage.setItem('paymentMethods', JSON.stringify(newMethods));
      return { success: true };
    } catch (error) {
      console.error('Error saving payment method:', error);
      return { success: false, error: error.message };
    }
  };

  const removePaymentMethod = async (methodId) => {
    try {
      const updatedMethods = paymentMethods.filter(method => method.id !== methodId);
      setPaymentMethods(updatedMethods);
      
      // If removing default method, set new default
      if (defaultPaymentMethod?.id === methodId) {
        const newDefault = updatedMethods.length > 0 ? updatedMethods[0] : null;
        setDefaultPaymentMethod(newDefault);
        await AsyncStorage.setItem('defaultPaymentMethod', JSON.stringify(newDefault));
      }
      
      await AsyncStorage.setItem('paymentMethods', JSON.stringify(updatedMethods));
      return { success: true };
    } catch (error) {
      console.error('Error removing payment method:', error);
      return { success: false, error: error.message };
    }
  };

  const setDefault = async (paymentMethod) => {
    try {
      setDefaultPaymentMethod(paymentMethod);
      await AsyncStorage.setItem('defaultPaymentMethod', JSON.stringify(paymentMethod));
      return { success: true };
    } catch (error) {
      console.error('Error setting default payment method:', error);
      return { success: false, error: error.message };
    }
  };

  // Create a payment intent for processing payment
  const createPaymentIntent = async (amount, currency = 'usd', rideDetails = {}) => {
    try {
      setLoading(true);
      
      console.log(`Creating payment intent for ${amount}`);
      
      // Call your payment service instead of creating mock payment
      const response = await fetch(`${PAYMENT_SERVICE_URL}/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any auth headers you need
          // 'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          userEmail: currentUser?.email,
          userId: currentUser?.uid,
          paymentMethodId: defaultPaymentMethod?.stripePaymentMethodId,
          rideDetails, // Send the full rideDetails object with all insurance data
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || 'Failed to create payment',
          errorCode: body.code || null,
        };
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to create payment intent',
          errorCode: result.code || null,
        };
      }

      console.log('Payment intent created successfully:', result.paymentIntent);
      return { success: true, paymentIntent: result.paymentIntent };

    } catch (error) {
      console.error('Error creating payment intent:', error);
      
      // Fallback to mock for development/testing
      if (__DEV__ && error.message.includes('Network request failed')) {
        console.log('Falling back to mock payment intent for development');
        
        const mockPaymentIntent = {
          id: `pi_mock_${Date.now()}`,
          amount: Math.round(amount * 100), // Stripe uses cents
          currency,
          status: 'requires_payment_method',
          client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
          created: Date.now(),
        };

        return { success: true, paymentIntent: mockPaymentIntent };
      }
      
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

      // Call your payment service to confirm the payment
      const response = await fetch(`${PAYMENT_SERVICE_URL}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any auth headers you need
          // 'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          clientSecret: paymentIntentClientSecret,
          paymentMethodId: paymentMethodToUse,
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || `Payment confirmation error: ${response.status}`,
          errorCode: body.code || null,
        };
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to confirm payment',
          errorCode: result.code || null,
        };
      }

      console.log('Payment confirmed successfully:', result.paymentIntent);
      return { success: true, paymentIntent: result.paymentIntent };
      
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
      const response = await fetch(`${PAYMENT_SERVICE_URL}/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rideDetails)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || `Price calculation error: ${response.status}`,
          errorCode: body.code || null,
        };
      }

      const result = await response.json();
      return result;
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