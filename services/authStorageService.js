import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';
import { normalizeError } from './errorService';

const AUTH_USER_KEY = 'currentUser';
const AUTH_ROLE_KEY = 'userType';
const EXPECTED_ROLE_KEY = 'expected_role';

const isScopedPaymentKey = (key) => {
  return (
    key === 'paymentMethods' ||
    key === 'defaultPaymentMethod' ||
    key.startsWith('paymentMethods:') ||
    key.startsWith('defaultPaymentMethod:') ||
    key === EXPECTED_ROLE_KEY
  );
};

export const persistAuthUser = async ({ user, userType }) => {
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  await AsyncStorage.setItem(AUTH_ROLE_KEY, userType);
};

export const clearAuthStorage = async () => {
  const allKeys = await AsyncStorage.getAllKeys();
  const scopedPaymentKeys = allKeys.filter(isScopedPaymentKey);

  await AsyncStorage.removeItem(AUTH_USER_KEY);
  await AsyncStorage.removeItem(AUTH_ROLE_KEY);

  if (scopedPaymentKeys.length > 0) {
    await AsyncStorage.multiRemove(scopedPaymentKeys);
  }
};

export const hydrateAuthUserFromStorage = async () => {
  try {
    logger.info('AuthStorage', 'Trying fast auth hydration from AsyncStorage');
    const [storedUser, storedUserType] = await Promise.all([
      AsyncStorage.getItem(AUTH_USER_KEY),
      AsyncStorage.getItem(AUTH_ROLE_KEY),
    ]);

    if (!storedUser || !storedUserType) {
      return null;
    }

    const parsedUser = JSON.parse(storedUser);
    logger.info('AuthStorage', 'Hydrated user from storage', {
      email: parsedUser?.email || null,
      role: storedUserType,
    });

    return { user: parsedUser, userType: storedUserType };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to hydrate auth session from storage');
    logger.error('AuthStorage', 'Error hydrating from storage', normalized, error);
    return null;
  }
};
