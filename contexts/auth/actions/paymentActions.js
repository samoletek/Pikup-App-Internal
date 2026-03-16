import * as PaymentService from '../../../services/PaymentService';
import { logger } from '../../../services/logger';
import { TRIP_STATUS } from '../../../constants/tripStatus';

export const createPaymentDomainActions = ({
  currentUser,
  updateRequestStatus,
  getRequestById,
  getDriverProfile,
  calculateDriverEarnings,
  updateDriverEarnings,
}) => {
  const createDriverConnectAccount = (driverInfo = {}) =>
    PaymentService.createDriverConnectAccount(driverInfo, currentUser);

  const getDriverOnboardingLink = (connectAccountId, refreshUrl, returnUrl) =>
    PaymentService.getDriverOnboardingLink(connectAccountId, refreshUrl, returnUrl, currentUser);

  const checkDriverOnboardingStatus = (connectAccountId = null) =>
    PaymentService.checkDriverOnboardingStatus(connectAccountId, currentUser);

  const requestInstantPayout = (driverId, amount) =>
    PaymentService.requestInstantPayout(driverId, amount, currentUser);

  const createVerificationSession = (userData) =>
    PaymentService.createVerificationSession(userData, currentUser);

  const completeTripWithPayment = async (tripId, completionData) => {
    try {
      await updateRequestStatus(tripId, TRIP_STATUS.COMPLETED, {
        completedAt: new Date().toISOString(),
        ...completionData,
      });

      const trip = await getRequestById(tripId);
      if (trip && trip.driver_id) {
        const driverProfile = await getDriverProfile(trip.driver_id);

        if (driverProfile?.driverProfile?.connectAccountId) {
          const driverEarnings = await calculateDriverEarnings(trip.pricing?.total || 0);
          const payoutResult = await PaymentService.processTripPayout({
            tripId,
            driverId: trip.driver_id,
            connectAccountId: driverProfile.driverProfile.connectAccountId,
            amount: driverEarnings,
          });

          if (payoutResult.success) {
            await updateDriverEarnings(trip.driver_id, {
              ...trip,
              driverEarnings,
            });
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('PaymentDomainActions', 'Error completing trip with payment', error);
      return { success: false, error: error.message };
    }
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
