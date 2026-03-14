import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useTripActions = () => {
  const auth = useAuth();

  return useMemo(
    () => ({
      createPickupRequest: auth.createPickupRequest,
      getUserPickupRequests: auth.getUserPickupRequests,
      getAvailableRequests: auth.getAvailableRequests,
      declineRequestOffer: auth.declineRequestOffer,
      acceptRequest: auth.acceptRequest,
      getRequestById: auth.getRequestById,
      cancelOrder: auth.cancelOrder,
      updateRequestStatus: auth.updateRequestStatus,
      updateDriverLocation: auth.updateDriverLocation,
      updateDriverStatus: auth.updateDriverStatus,
      checkExpiredRequests: auth.checkExpiredRequests,
    }),
    [
      auth.createPickupRequest,
      auth.getUserPickupRequests,
      auth.getAvailableRequests,
      auth.declineRequestOffer,
      auth.acceptRequest,
      auth.getRequestById,
      auth.cancelOrder,
      auth.updateRequestStatus,
      auth.updateDriverLocation,
      auth.updateDriverStatus,
      auth.checkExpiredRequests,
    ]
  );
};
