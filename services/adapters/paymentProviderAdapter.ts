import {
  checkDriverOnboardingStatus,
  createDriverConnectAccount,
  getDriverOnboardingLink,
} from '../payment/onboarding';
import { updateDriverPaymentProfile } from '../payment/profile';
import {
  getDriverEarningsHistory,
  getDriverPayouts,
  processTripPayout,
  requestInstantPayout,
} from '../payment/payouts';
import { createVerificationSession } from '../payment/verification';

export type PaymentProviderAdapter = {
  createDriverConnectAccount: typeof createDriverConnectAccount;
  getDriverOnboardingLink: typeof getDriverOnboardingLink;
  checkDriverOnboardingStatus: typeof checkDriverOnboardingStatus;
  updateDriverPaymentProfile: typeof updateDriverPaymentProfile;
  getDriverEarningsHistory: typeof getDriverEarningsHistory;
  getDriverPayouts: typeof getDriverPayouts;
  processTripPayout: typeof processTripPayout;
  requestInstantPayout: typeof requestInstantPayout;
  createVerificationSession: typeof createVerificationSession;
};

const defaultPaymentProviderAdapter: PaymentProviderAdapter = {
  createDriverConnectAccount,
  getDriverOnboardingLink,
  checkDriverOnboardingStatus,
  updateDriverPaymentProfile,
  getDriverEarningsHistory,
  getDriverPayouts,
  processTripPayout,
  requestInstantPayout,
  createVerificationSession,
};

let activePaymentProviderAdapter: PaymentProviderAdapter = defaultPaymentProviderAdapter;

export const getPaymentProviderAdapter = (): PaymentProviderAdapter =>
  activePaymentProviderAdapter;

export const setPaymentProviderAdapter = (nextAdapter: PaymentProviderAdapter) => {
  activePaymentProviderAdapter = nextAdapter || defaultPaymentProviderAdapter;
};

export const resetPaymentProviderAdapter = () => {
  activePaymentProviderAdapter = defaultPaymentProviderAdapter;
};
