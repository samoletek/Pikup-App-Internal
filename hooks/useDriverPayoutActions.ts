import { useMemo } from 'react';
import { useDriverActions, usePaymentActions } from '../contexts/AuthContext';

export const useDriverPayoutActions = () => {
  const driverActions = useDriverActions();
  const paymentActions = usePaymentActions();

  return useMemo(
    () => ({
      getDriverProfile: driverActions.getDriverProfile,
      getDriverStats: driverActions.getDriverStats,
      getDriverTrips: driverActions.getDriverTrips,
      requestInstantPayout: paymentActions.requestInstantPayout,
      getDriverEarningsHistory: paymentActions.getDriverEarningsHistory,
      getDriverPayoutAvailability: paymentActions.getDriverPayoutAvailability,
      getDriverPayouts: paymentActions.getDriverPayouts,
      createDriverConnectAccount: paymentActions.createDriverConnectAccount,
      getDriverOnboardingLink: paymentActions.getDriverOnboardingLink,
      checkDriverOnboardingStatus: paymentActions.checkDriverOnboardingStatus,
      updateDriverPaymentProfile: paymentActions.updateDriverPaymentProfile,
    }),
    [
      driverActions.getDriverProfile,
      driverActions.getDriverStats,
      driverActions.getDriverTrips,
      paymentActions.requestInstantPayout,
      paymentActions.getDriverEarningsHistory,
      paymentActions.getDriverPayoutAvailability,
      paymentActions.getDriverPayouts,
      paymentActions.createDriverConnectAccount,
      paymentActions.getDriverOnboardingLink,
      paymentActions.checkDriverOnboardingStatus,
      paymentActions.updateDriverPaymentProfile,
    ]
  );
};
