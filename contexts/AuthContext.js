// contexts/AuthContext.js - Refactored to use service modules
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

// Import all service modules
import * as StorageService from '../services/StorageService';
import * as TermsService from '../services/TermsService';
import * as ProfileService from '../services/ProfileService';
import * as MessagingService from '../services/MessagingService';
import * as PaymentService from '../services/PaymentService';
import * as DriverService from '../services/DriverService';
import * as TripService from '../services/TripService';
import * as AuthService from '../services/AuthService';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  // Authenticated fetch helper
  const authFetch = useCallback(async (url, options = {}) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.accessToken}`,
        ...options.headers
      }
    });
  }, [currentUser?.accessToken]);

  // Initialize auth from Supabase session
  useEffect(() => {
    let mounted = true;

    const hydrateFromStorage = async () => {
      try {
        const stored = await AuthService.hydrateFromStorage();
        if (stored && mounted) {
          setCurrentUser(stored.user);
          setUserType(stored.userType);
          setIsInitializing(false);
          return true;
        }
        return false;
      } catch (e) {
        console.error('Hydration failed:', e);
        return false;
      }
    };

    // Quick hydrate attempt
    hydrateFromStorage();

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mounted && isInitializing) {
        console.warn('⏱ Auth timeout - unblocking UI');
        setIsInitializing(false);
      }
    }, 3000);

    // Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
          if (!session) return;

          const md = session.user.user_metadata || {};
          let detectedUserType = md.user_type || 'customer';

          const fullUser = {
            ...session.user,
            id: session.user.id,
            email: session.user.email,
            first_name: md.firstName || md.first_name || '',
            last_name: md.lastName || md.last_name || '',
            phone_number: md.phoneNumber || md.phone_number || '',
            accessToken: session.access_token,
            user_type: detectedUserType
          };

          setCurrentUser(fullUser);
          setUserType(detectedUserType);
          setIsInitializing(false);

          // Background profile refresh
          const table = detectedUserType === 'driver' ? 'drivers' : 'customers';
          supabase.from(table).select('*').eq('id', session.user.id).single()
            .then(({ data }) => {
              if (data && mounted) {
                setCurrentUser(prev => prev ? { ...prev, ...data } : data);
              }
            });
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setCurrentUser(null);
          setUserType(null);
          setIsInitializing(false);
        }
      } catch (e) {
        console.error('Error in auth state change:', e);
        setIsInitializing(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ===========================================
  // WRAPPED SERVICE FUNCTIONS
  // These wrap service functions to inject currentUser/userType/authFetch
  // ===========================================

  // Auth functions
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

  // Profile functions (wrap with currentUser/userType)
  const updateUserProfile = (updates) => ProfileService.updateUserProfile(updates, currentUser, userType).then(data => {
    setCurrentUser(prev => ({ ...prev, ...data }));
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
  const getProfileImage = () => ProfileService.getProfileImage(currentUser, userType).then(url => {
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
  const getUserProfile = () => ProfileService.getUserProfile(currentUser);
  const updateUserRating = (userId, newRating, profileType) => ProfileService.updateUserRating(userId, newRating, profileType);
  const saveFeedback = (feedbackData) => ProfileService.saveFeedback(feedbackData, currentUser);
  const getDriverFeedback = ProfileService.getDriverFeedback;

  // Trip functions (wrap with currentUser)
  const createPickupRequest = (requestData) => TripService.createPickupRequest(requestData, currentUser);
  const getUserPickupRequests = () => TripService.getUserPickupRequests(currentUser);
  const getAvailableRequests = () => TripService.getAvailableRequests(currentUser);
  const acceptRequest = (requestId) => TripService.acceptRequest(requestId, currentUser);
  const updateRequestStatus = TripService.updateRequestStatus;
  const updateDriverStatus = TripService.updateDriverStatus;
  const updateDriverLocation = (requestId, location) => TripService.updateDriverLocation(requestId, location, currentUser);
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

  // Driver functions (wrap with authFetch where needed)
  const getDriverTrips = DriverService.getDriverTrips;
  const getDriverStats = DriverService.getDriverStats;
  const updateDriverEarnings = DriverService.updateDriverEarnings;
  const calculateDriverEarnings = DriverService.calculateDriverEarnings;
  const getDriverProfile = DriverService.getDriverProfile;
  const setDriverOnline = (driverId, location) => DriverService.setDriverOnline(driverId, location, authFetch);
  const setDriverOffline = (driverId) => DriverService.setDriverOffline(driverId, authFetch);
  const updateDriverHeartbeat = (driverId, location) => DriverService.updateDriverHeartbeat(driverId, location, authFetch);
  const getOnlineDrivers = (customerLocation, radiusMiles) => DriverService.getOnlineDrivers(customerLocation, radiusMiles, authFetch);
  const getDriverSessionStats = (driverId, date) => DriverService.getDriverSessionStats(driverId, date, authFetch);

  // Payment functions
  const createDriverConnectAccount = PaymentService.createDriverConnectAccount;
  const getDriverOnboardingLink = PaymentService.getDriverOnboardingLink;
  const updateDriverPaymentProfile = PaymentService.updateDriverPaymentProfile;
  const checkDriverOnboardingStatus = PaymentService.checkDriverOnboardingStatus;
  const getDriverEarningsHistory = PaymentService.getDriverEarningsHistory;
  const getDriverPayouts = PaymentService.getDriverPayouts;
  const requestInstantPayout = PaymentService.requestInstantPayout;
  const processTripPayout = PaymentService.processTripPayout;
  const createVerificationSession = (userData) => PaymentService.createVerificationSession(userData, currentUser);

  // Enhanced trip completion with payment
  const completeTripWithPayment = async (tripId, completionData) => {
    try {
      await updateRequestStatus(tripId, 'completed', {
        completedAt: new Date().toISOString(),
        ...completionData,
      });

      const trip = await getRequestById(tripId);
      if (trip && trip.driver_id) {
        const driverProfile = await getDriverProfile(trip.driver_id);

        if (driverProfile?.driverProfile?.connectAccountId) {
          const driverEarnings = calculateDriverEarnings(trip.pricing?.total || 0);

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

  // Messaging functions (direct exports)
  const createConversation = MessagingService.createConversation;
  const getConversations = MessagingService.getConversations;
  const sendMessage = MessagingService.sendMessage;
  const getMessages = MessagingService.getMessages;
  const subscribeToMessages = MessagingService.subscribeToMessages;
  const markMessageAsRead = MessagingService.markMessageAsRead;

  // Terms functions (wrap with currentUser)
  const getLegalConfig = TermsService.getLegalConfig;
  const checkTermsAcceptance = TermsService.checkTermsAcceptance;
  const acceptTerms = TermsService.acceptTerms;
  const getTermsStatus = (uid) => TermsService.getTermsStatus(uid, currentUser);

  // Storage functions (direct exports)
  const compressImage = StorageService.compressImage;
  const uploadToSupabase = StorageService.uploadToSupabase;
  const uploadMultiplePhotos = StorageService.uploadMultiplePhotos;
  const getPhotoURL = StorageService.getPhotoURL;
  const deletePhotoFromStorage = StorageService.deletePhotoFromStorage;
  const uploadPhotoToStorage = StorageService.uploadPhotoToStorage;

  // Driver wrapper functions for convenience
  const driverFunctions = {
    startDriving,
    arriveAtPickup,
    confirmPickup,
    startDelivery,
    arriveAtDropoff,
  };

  const value = {
    currentUser,
    userType,
    loading,
    isInitializing,
    profileImage,
    // Auth
    signup,
    login,
    logout,
    signInWithApple,
    signInWithGoogle,
    deleteAccount,
    // Trip
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
    ...driverFunctions,
    checkExpiredRequests,
    resetExpiredRequest,
    extendRequestTimer,
    claimRequestForViewing,
    releaseRequestViewing,
    cancelOrder,
    getCancellationInfo,
    // Profile
    updateUserProfile,
    uploadProfileImage,
    getProfileImage,
    deleteProfileImage,
    getUserProfile,
    updateUserRating,
    saveFeedback,
    getDriverFeedback,
    // Driver
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
    // Payment
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
    // Messaging
    createConversation,
    getConversations,
    sendMessage,
    getMessages,
    subscribeToMessages,
    markMessageAsRead,
    // Terms
    getLegalConfig,
    checkTermsAcceptance,
    acceptTerms,
    getTermsStatus,
    // Storage
    compressImage,
    uploadPhotoToStorage,
    uploadMultiplePhotos,
    deletePhotoFromStorage,
    getPhotoURL,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}