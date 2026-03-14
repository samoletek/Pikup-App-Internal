import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const getPaymentMethodsKey = (userId) => `paymentMethods:${userId}`;
const getDefaultMethodKey = (userId) => `defaultPaymentMethod:${userId}`;

export const loadStoredPaymentState = async (userId) => {
  if (!userId) {
    return {
      paymentMethods: [],
      defaultPaymentMethod: null,
    };
  }

  try {
    const savedMethods = await AsyncStorage.getItem(getPaymentMethodsKey(userId));
    const savedDefault = await AsyncStorage.getItem(getDefaultMethodKey(userId));

    return {
      paymentMethods: savedMethods ? JSON.parse(savedMethods) : [],
      defaultPaymentMethod: savedDefault ? JSON.parse(savedDefault) : null,
    };
  } catch (error) {
    logger.error('PaymentLocalStorageService', 'loadStoredPaymentState failed', error);
    return {
      paymentMethods: [],
      defaultPaymentMethod: null,
    };
  }
};

export const saveStoredPaymentMethods = async (userId, paymentMethods = []) => {
  if (!userId) return;
  await AsyncStorage.setItem(getPaymentMethodsKey(userId), JSON.stringify(paymentMethods));
};

export const saveStoredDefaultPaymentMethod = async (userId, paymentMethod) => {
  if (!userId) return;
  await AsyncStorage.setItem(getDefaultMethodKey(userId), JSON.stringify(paymentMethod || null));
};

export const clearStoredDefaultPaymentMethod = async (userId) => {
  if (!userId) return;
  await AsyncStorage.removeItem(getDefaultMethodKey(userId));
};
