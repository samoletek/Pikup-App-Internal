import * as StorageService from '../../services/StorageService';
import * as TermsService from '../../services/TermsService';
import * as ProfileService from '../../services/ProfileService';
import * as MessagingService from '../../services/MessagingService';
import * as PaymentService from '../../services/PaymentService';
import * as DriverService from '../../services/DriverService';
import * as TripService from '../../services/TripService';
import * as AuthService from '../../services/AuthService';
import { TRIP_STATUS } from '../../constants/tripStatus';

export const createAuthActions = ({
  currentUser,
  userType,
  authFetch,
  setCurrentUser,
  setUserType,
  setLoading,
  setProfileImage
}) => {
  const signup = async (email, password, type, additionalData) => {
    setLoading(true);
    try {
      const result = await AuthService.signup(email, password, type, additionalData);
      setCurrentUser(result.user);
      setUserType(result.userType);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, expectedRole) => {
    setLoading(true);
    try {
      const result = await AuthService.login(email, password, expectedRole);
      setCurrentUser(result.user);
      setUserType(result.userType);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setCurrentUser(null);
    setUserType(null);
  };

  const signInWithApple = async (userRole) => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithApple(userRole);
      if (result.user) {
        setCurrentUser(result.user);
        setUserType(result.userType || userRole);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (userRole) => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle(userRole);
      if (result?.user) {
        setCurrentUser(result.user);
        setUserType(result.userType || userRole);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    setLoading(true);
    try {
      const result = await AuthService.deleteAccount(currentUser);
      setCurrentUser(null);
      setUserType(null);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = (currentPassword, newPassword) =>
    AuthService.changePassword(currentUser, currentPassword, newPassword);
  const verifyAccountPassword = (password) =>
    AuthService.verifyAccountPassword(currentUser, password);

  const resetPassword = (email) => AuthService.resetPassword(email);

  const updateUserProfile = (updates) =>
    ProfileService.updateUserProfile(updates, currentUser, userType).then((data) => {
      setCurrentUser((prev) => ({ ...prev, ...data }));
      return data;
    });

  const uploadProfileImage = async (imageUri) => {
    setLoading(true);
    try {
      const url = await ProfileService.uploadProfileImage(imageUri, currentUser, userType);
      setProfileImage(url);
      return url;
    } finally {
      setLoading(false);
    }
  };

  const getProfileImage = () =>
    ProfileService.getProfileImage(currentUser, userType).then((url) => {
      if (url) setProfileImage(url);
      return url;
    });

  const deleteProfileImage = async () => {
    setLoading(true);
    try {
      await ProfileService.deleteProfileImage(currentUser, userType);
      setProfileImage(null);
    } finally {
      setLoading(false);
    }
  };

  const getUserProfile = (targetUser = currentUser) => {
    const normalizedTarget = targetUser || currentUser;
    return ProfileService.getUserProfile(normalizedTarget);
  };

  const updateUserRating = (userId, newRating, profileType) =>
    ProfileService.updateUserRating(userId, newRating, profileType);
  const saveFeedback = (feedbackData) => ProfileService.saveFeedback(feedbackData, currentUser);
  const submitTripRating = (ratingData) => ProfileService.submitTripRating(ratingData, currentUser);
  const getDriverFeedback = ProfileService.getDriverFeedback;

  const createPickupRequest = (requestData) => TripService.createPickupRequest(requestData, currentUser);
  const getUserPickupRequests = () => TripService.getUserPickupRequests(currentUser);
  const getAvailableRequests = (options = {}) => TripService.getAvailableRequests(currentUser, options);
  const acceptRequest = (requestId) => TripService.acceptRequest(requestId, currentUser);
  const updateRequestStatus = TripService.updateRequestStatus;
  const updateDriverStatus = TripService.updateDriverStatus;
  const updateDriverLocation = (requestId, location) =>
    TripService.updateDriverLocation(requestId, location, currentUser);
  const uploadRequestPhotos = TripService.uploadRequestPhotos;
  const getRequestById = TripService.getRequestById;
  const completeDelivery = TripService.completeDelivery;
  const finishDelivery = (requestId, photos, driverLocation, customerRating) =>
    TripService.finishDelivery(requestId, photos, driverLocation, customerRating, currentUser);
  const startDriving = TripService.startDriving;
  const arriveAtPickup = TripService.arriveAtPickup;
  const confirmPickup = TripService.confirmPickup;
  const startDelivery = TripService.startDelivery;
  const arriveAtDropoff = TripService.arriveAtDropoff;
  const checkExpiredRequests = TripService.checkExpiredRequests;
  const resetExpiredRequest = TripService.resetExpiredRequest;
  const extendRequestTimer = TripService.extendRequestTimer;
  const claimRequestForViewing = TripService.claimRequestForViewing;
  const releaseRequestViewing = TripService.releaseRequestViewing;
  const cancelOrder = (orderId, reason) => TripService.cancelOrder(orderId, reason, currentUser);
  const getCancellationInfo = TripService.getCancellationInfo;

  const getDriverTrips = DriverService.getDriverTrips;
  const getDriverStats = DriverService.getDriverStats;
  const updateDriverEarnings = DriverService.updateDriverEarnings;
  const calculateDriverEarnings = DriverService.calculateDriverEarnings;
  const getDriverProfile = DriverService.getDriverProfile;
  const setDriverOnline = (driverId, location, mode) => DriverService.setDriverOnline(driverId, { ...location, mode }, authFetch);
  const setDriverOffline = (driverId) => DriverService.setDriverOffline(driverId, authFetch);
  const updateDriverHeartbeat = (driverId, location) =>
    DriverService.updateDriverHeartbeat(driverId, location, authFetch);
  const getOnlineDrivers = (customerLocation, radiusMiles) =>
    DriverService.getOnlineDrivers(customerLocation, radiusMiles, authFetch);
  const getDriverSessionStats = (driverId, date) =>
    DriverService.getDriverSessionStats(driverId, date, authFetch);

  const createDriverConnectAccount = PaymentService.createDriverConnectAccount;
  const getDriverOnboardingLink = PaymentService.getDriverOnboardingLink;
  const updateDriverPaymentProfile = PaymentService.updateDriverPaymentProfile;
  const checkDriverOnboardingStatus = PaymentService.checkDriverOnboardingStatus;
  const getDriverEarningsHistory = PaymentService.getDriverEarningsHistory;
  const getDriverPayouts = PaymentService.getDriverPayouts;
  const requestInstantPayout = PaymentService.requestInstantPayout;
  const processTripPayout = PaymentService.processTripPayout;
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

          const payoutResult = await processTripPayout({
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
      console.error('Error completing trip with payment:', error);
      return { success: false, error: error.message };
    }
  };

  const createConversation = MessagingService.createConversation;
  const getConversations = MessagingService.getConversations;
  const sendMessage = MessagingService.sendMessage;
  const getMessages = MessagingService.getMessages;
  const subscribeToMessages = MessagingService.subscribeToMessages;
  const subscribeToConversations = MessagingService.subscribeToConversations;
  const markMessageAsRead = MessagingService.markMessageAsRead;
  const loadOlderMessages = MessagingService.loadOlderMessages;

  const getLegalConfig = TermsService.getLegalConfig;
  const checkTermsAcceptance = TermsService.checkTermsAcceptance;
  const acceptTerms = TermsService.acceptTerms;
  const getTermsStatus = (uid) => TermsService.getTermsStatus(uid, currentUser);

  const compressImage = StorageService.compressImage;
  const uploadToSupabase = StorageService.uploadToSupabase;
  const uploadMultiplePhotos = StorageService.uploadMultiplePhotos;
  const getPhotoURL = StorageService.getPhotoURL;
  const deletePhotoFromStorage = StorageService.deletePhotoFromStorage;
  const uploadPhotoToStorage = StorageService.uploadPhotoToStorage;

  return {
    signup,
    login,
    logout,
    signInWithApple,
    signInWithGoogle,
    deleteAccount,
    changePassword,
    verifyAccountPassword,
    resetPassword,
    createPickupRequest,
    getUserPickupRequests,
    getAvailableRequests,
    acceptRequest,
    updateRequestStatus,
    updateDriverLocation,
    updateDriverStatus,
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
    cancelOrder,
    getCancellationInfo,
    updateUserProfile,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserRating,
    saveFeedback,
    submitTripRating,
    getDriverFeedback,
    getDriverTrips,
    getDriverStats,
    updateDriverEarnings,
    calculateDriverEarnings,
    getDriverProfile,
    setDriverOnline,
    setDriverOffline,
    updateDriverHeartbeat,
    getOnlineDrivers,
    getDriverSessionStats,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile,
    checkDriverOnboardingStatus,
    getDriverEarningsHistory,
    getDriverPayouts,
    requestInstantPayout,
    processInstantPayout: requestInstantPayout,
    processTripPayout,
    completeTripWithPayment,
    createVerificationSession,
    createConversation,
    getConversations,
    sendMessage,
    getMessages,
    subscribeToMessages,
    subscribeToConversations,
    markMessageAsRead,
    loadOlderMessages,
    getLegalConfig,
    checkTermsAcceptance,
    acceptTerms,
    getTermsStatus,
    compressImage,
    uploadPhotoToStorage,
    uploadMultiplePhotos,
    deletePhotoFromStorage,
    getPhotoURL,
    uploadToSupabase,
  };
};
