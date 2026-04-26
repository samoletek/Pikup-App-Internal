// Payment service facade: delegates payment actions through an injectable payment provider adapter.
import {
  getPaymentProviderAdapter,
  resetPaymentProviderAdapter,
  setPaymentProviderAdapter,
} from './adapters/paymentProviderAdapter';

const callPayment = (methodName, ...args) => {
  const provider = getPaymentProviderAdapter();
  return provider[methodName](...args);
};

export const createDriverConnectAccount = (...args) =>
  callPayment('createDriverConnectAccount', ...args);

export const getDriverOnboardingLink = (...args) => callPayment('getDriverOnboardingLink', ...args);

export const checkDriverOnboardingStatus = (...args) =>
  callPayment('checkDriverOnboardingStatus', ...args);

export const updateDriverPaymentProfile = (...args) =>
  callPayment('updateDriverPaymentProfile', ...args);

export const getDriverEarningsHistory = (...args) =>
  callPayment('getDriverEarningsHistory', ...args);

export const getDriverPayoutAvailability = (...args) =>
  callPayment('getDriverPayoutAvailability', ...args);

export const getDriverPayouts = (...args) => callPayment('getDriverPayouts', ...args);

export const processTripPayout = (...args) => callPayment('processTripPayout', ...args);

export const requestInstantPayout = (...args) => callPayment('requestInstantPayout', ...args);

export const createVerificationSession = (...args) =>
  callPayment('createVerificationSession', ...args);

export { resetPaymentProviderAdapter, setPaymentProviderAdapter };
