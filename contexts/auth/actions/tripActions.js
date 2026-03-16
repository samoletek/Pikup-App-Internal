import * as TripService from '../../../services/TripService';

export const createTripDomainActions = ({ currentUser }) => {
  return {
    createPickupRequest: (requestData) => TripService.createPickupRequest(requestData, currentUser),
    getUserPickupRequests: () => TripService.getUserPickupRequests(currentUser),
    getAvailableRequests: (options = {}) => TripService.getAvailableRequests(currentUser, options),
    declineRequestOffer: (requestId, options = {}) =>
      TripService.declineRequestOffer(requestId, currentUser, options),
    acceptRequest: (requestId) => TripService.acceptRequest(requestId, currentUser),
    updateRequestStatus: TripService.updateRequestStatus,
    updateDriverStatus: TripService.updateDriverStatus,
    updateDriverLocation: (requestId, location) =>
      TripService.updateDriverLocation(requestId, location, currentUser),
    uploadRequestPhotos: TripService.uploadRequestPhotos,
    getRequestById: TripService.getRequestById,
    completeDelivery: TripService.completeDelivery,
    finishDelivery: (requestId, photos, driverLocation, customerRating) =>
      TripService.finishDelivery(requestId, photos, driverLocation, customerRating, currentUser),
    startDriving: TripService.startDriving,
    arriveAtPickup: TripService.arriveAtPickup,
    confirmPickup: TripService.confirmPickup,
    startDelivery: TripService.startDelivery,
    arriveAtDropoff: TripService.arriveAtDropoff,
    checkExpiredRequests: TripService.checkExpiredRequests,
    resetExpiredRequest: TripService.resetExpiredRequest,
    extendRequestTimer: TripService.extendRequestTimer,
    claimRequestForViewing: TripService.claimRequestForViewing,
    releaseRequestViewing: TripService.releaseRequestViewing,
    cancelOrder: (orderId, reason) => TripService.cancelOrder(orderId, reason, currentUser),
    getCancellationInfo: TripService.getCancellationInfo,
  };
};
