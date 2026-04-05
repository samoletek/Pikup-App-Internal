import * as PaymentService from '../../../services/PaymentService';
import { logger } from '../../../services/logger';

export const createPaymentDomainActions = ({
  currentUser,
}) => {
  const createDriverConnectAccount = (driverInfo = {}) =>
    PaymentService.createDriverConnectAccount(driverInfo, currentUser);

  const getDriverOnboardingLink = (connectAccountId, refreshUrl, returnUrl) =>
    PaymentService.getDriverOnboardingLink(connectAccountId, refreshUrl, returnUrl, currentUser);

  const checkDriverOnboardingStatus = (connectAccountId = null) =>
    PaymentService.checkDriverOnboardingStatus(connectAccountId, currentUser);

  const requestInstantPayout = (driverId, amount, options = null) =>
    PaymentService.requestInstantPayout(driverId, amount, currentUser, options);

  const createVerificationSession = (userData) =>
    PaymentService.createVerificationSession(userData, currentUser);

  const completeTripWithPayment = async () => {
    logger.warn(
      'PaymentDomainActions',
      'completeTripWithPayment is deprecated. Use tripLifecycleUtils.finishDelivery + tripPaymentLifecycleService instead.'
    );
    return {
      success: false,
      error: 'completeTripWithPayment is deprecated. Use finishDelivery flow.',
    };
  };

  return {
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile: PaymentService.updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverEarningsHistory: PaymentService.getDriverEarningsHistory,
    getDriverPayouts: PaymentService.getDriverPayouts,
    requestInstantPayout,
    processInstantPayout: requestInstantPayout,
    processTripPayout: PaymentService.processTripPayout,
    completeTripWithPayment,
    createVerificationSession,
  };
};
