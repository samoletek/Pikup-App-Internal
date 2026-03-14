import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useDriverPayoutActions = () => {
  const auth = useAuth();

  return useMemo(
    () => ({
      getDriverProfile: auth.getDriverProfile,
      getDriverStats: auth.getDriverStats,
      getDriverTrips: auth.getDriverTrips,
      requestInstantPayout: auth.requestInstantPayout,
      getDriverEarningsHistory: auth.getDriverEarningsHistory,
      getDriverPayouts: auth.getDriverPayouts,
      createDriverConnectAccount: auth.createDriverConnectAccount,
      getDriverOnboardingLink: auth.getDriverOnboardingLink,
      checkDriverOnboardingStatus: auth.checkDriverOnboardingStatus,
      updateDriverPaymentProfile: auth.updateDriverPaymentProfile,
    }),
    [
      auth.getDriverProfile,
      auth.getDriverStats,
      auth.getDriverTrips,
      auth.requestInstantPayout,
      auth.getDriverEarningsHistory,
      auth.getDriverPayouts,
      auth.createDriverConnectAccount,
      auth.getDriverOnboardingLink,
      auth.checkDriverOnboardingStatus,
      auth.updateDriverPaymentProfile,
    ]
  );
};
