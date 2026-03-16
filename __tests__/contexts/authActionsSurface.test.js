jest.mock("../../services/AuthService", () => ({
  signup: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  deleteAccount: jest.fn(),
  changePassword: jest.fn(),
  verifyAccountPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock("../../services/ProfileService", () => ({
  updateUserProfile: jest.fn(),
  uploadProfileImage: jest.fn(),
  getProfileImage: jest.fn(),
  deleteProfileImage: jest.fn(),
  getUserProfile: jest.fn(),
  updateUserRating: jest.fn(),
  saveFeedback: jest.fn(),
  submitTripRating: jest.fn(),
  getDriverFeedback: jest.fn(),
}));

jest.mock("../../services/TripService", () => ({
  createPickupRequest: jest.fn(),
  getUserPickupRequests: jest.fn(),
  getAvailableRequests: jest.fn(),
  declineRequestOffer: jest.fn(),
  acceptRequest: jest.fn(),
  updateRequestStatus: jest.fn(),
  updateDriverStatus: jest.fn(),
  updateDriverLocation: jest.fn(),
  uploadRequestPhotos: jest.fn(),
  getRequestById: jest.fn(),
  completeDelivery: jest.fn(),
  finishDelivery: jest.fn(),
  startDriving: jest.fn(),
  arriveAtPickup: jest.fn(),
  confirmPickup: jest.fn(),
  startDelivery: jest.fn(),
  arriveAtDropoff: jest.fn(),
  checkExpiredRequests: jest.fn(),
  resetExpiredRequest: jest.fn(),
  extendRequestTimer: jest.fn(),
  claimRequestForViewing: jest.fn(),
  releaseRequestViewing: jest.fn(),
  cancelOrder: jest.fn(),
  getCancellationInfo: jest.fn(),
}));

jest.mock("../../services/DriverService", () => ({
  getDriverTrips: jest.fn(),
  getDriverStats: jest.fn(),
  updateDriverEarnings: jest.fn(),
  calculateDriverEarnings: jest.fn(),
  getDriverProfile: jest.fn(),
  setDriverOnline: jest.fn(),
  setDriverOffline: jest.fn(),
  updateDriverHeartbeat: jest.fn(),
  getOnlineDrivers: jest.fn(),
  getDriverSessionStats: jest.fn(),
}));

jest.mock("../../services/PaymentService", () => ({
  createDriverConnectAccount: jest.fn(),
  getDriverOnboardingLink: jest.fn(),
  updateDriverPaymentProfile: jest.fn(),
  checkDriverOnboardingStatus: jest.fn(),
  getDriverEarningsHistory: jest.fn(),
  getDriverPayouts: jest.fn(),
  requestInstantPayout: jest.fn(),
  processTripPayout: jest.fn(),
  createVerificationSession: jest.fn(),
}));

jest.mock("../../services/MessagingService", () => ({
  createConversation: jest.fn(),
  getConversations: jest.fn(),
  sendMessage: jest.fn(),
  getMessages: jest.fn(),
  subscribeToMessages: jest.fn(),
  subscribeToConversations: jest.fn(),
  markMessageAsRead: jest.fn(),
  loadOlderMessages: jest.fn(),
}));

jest.mock("../../services/TermsService", () => ({
  getLegalConfig: jest.fn(),
  checkTermsAcceptance: jest.fn(),
  acceptTerms: jest.fn(),
  getTermsStatus: jest.fn(),
}));

jest.mock("../../services/StorageService", () => ({
  compressImage: jest.fn(),
  uploadToSupabase: jest.fn(),
  uploadMultiplePhotos: jest.fn(),
  getPhotoURL: jest.fn(),
  deletePhotoFromStorage: jest.fn(),
  uploadPhotoToStorage: jest.fn(),
}));

const { createAuthActions } = require("../../contexts/auth/createAuthActions");

describe("createAuthActions API surface", () => {
  test("matches the expected action keys snapshot", () => {
    const actions = createAuthActions({
      currentUser: { id: "user_1", uid: "user_1", accessToken: "token" },
      userType: "customer",
      authFetch: jest.fn(),
      setCurrentUser: jest.fn(),
      setUserType: jest.fn(),
      setLoading: jest.fn(),
      setProfileImage: jest.fn(),
    });

    const actionKeys = Object.keys(actions).sort();
    expect(actionKeys).toMatchSnapshot();
  });
});
