// services/TripService.js
// Facade with stable public API for trip lifecycle and driver request management.

export {
  createPickupRequest,
  getUserPickupRequests,
} from './tripRequestCreationService';

export {
  getAvailableRequests,
  declineRequestOffer,
  acceptRequest,
} from './tripDriverRequestService';

export {
  getPendingDriverScheduledCheckins,
  confirmScheduledTripCheckin,
  declineScheduledTripCheckin,
} from './tripScheduledCheckinService';

export {
  updateRequestStatus,
  updateDriverStatus,
  updateDriverLocation,
  uploadRequestPhotos,
  getRequestById,
  completeDelivery,
  finishDelivery,
  startDriving,
  arriveAtPickup,
  confirmPickup,
  startDelivery,
  arriveAtDropoff,
  checkExpiredRequests,
  resetExpiredRequest,
  extendRequestTimer,
  claimRequestForViewing,
  releaseRequestViewing,
} from './tripLifecycleUtils';

export {
  cancelOrder,
  getCancellationInfo,
} from './tripOrderCancellationService';
