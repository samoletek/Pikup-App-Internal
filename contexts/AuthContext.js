import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { fetchUserProfileByRole } from '../services/authSessionService';
import { createAuthDomainActions } from './auth/actions/authActions';
import { createProfileDomainActions } from './auth/actions/profileActions';
import { createTripDomainActions } from './auth/actions/tripActions';
import { createDriverDomainActions } from './auth/actions/driverActions';
import { createPaymentDomainActions } from './auth/actions/paymentActions';
import { createMessagingDomainActions } from './auth/actions/messagingActions';
import { createTermsDomainActions } from './auth/actions/termsActions';
import { createStorageDomainActions } from './auth/actions/storageActions';
import useAuthSessionBootstrap from '../hooks/useAuthSessionBootstrap';

WebBrowser.maybeCompleteAuthSession();

const AuthIdentityContext = createContext();
const AuthActionsContext = createContext({});
const ProfileActionsContext = createContext({});
const TripActionsContext = createContext({});
const DriverActionsContext = createContext({});
const PaymentActionsContext = createContext({});
const MessagingActionsContext = createContext({});
const TermsActionsContext = createContext({});
const StorageActionsContext = createContext({});

export function useAuth() {
  const identity = useContext(AuthIdentityContext);
  const authActions = useContext(AuthActionsContext);
  const profileActions = useContext(ProfileActionsContext);
  const tripActions = useContext(TripActionsContext);
  const driverActions = useContext(DriverActionsContext);
  const paymentActions = useContext(PaymentActionsContext);
  const messagingActions = useContext(MessagingActionsContext);
  const termsActions = useContext(TermsActionsContext);
  const storageActions = useContext(StorageActionsContext);

  return useMemo(
    () => ({
      ...(identity || {}),
      ...(authActions || {}),
      ...(profileActions || {}),
      ...(tripActions || {}),
      ...(driverActions || {}),
      ...(paymentActions || {}),
      ...(messagingActions || {}),
      ...(termsActions || {}),
      ...(storageActions || {}),
    }),
    [
      identity,
      authActions,
      profileActions,
      tripActions,
      driverActions,
      paymentActions,
      messagingActions,
      termsActions,
      storageActions,
    ]
  );
}

export function useAuthIdentity() {
  return useContext(AuthIdentityContext);
}

/** @returns {any} */
export function useAuthActions() {
  return useContext(AuthActionsContext);
}

/** @returns {any} */
export function useProfileActions() {
  return useContext(ProfileActionsContext);
}

/** @returns {any} */
export function useTripActions() {
  return useContext(TripActionsContext);
}

/** @returns {any} */
export function useDriverActions() {
  return useContext(DriverActionsContext);
}

/** @returns {any} */
export function usePaymentActions() {
  return useContext(PaymentActionsContext);
}

/** @returns {any} */
export function useMessagingActions() {
  return useContext(MessagingActionsContext);
}

/** @returns {any} */
export function useTermsActions() {
  return useContext(TermsActionsContext);
}

/** @returns {any} */
export function useStorageActions() {
  return useContext(StorageActionsContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [profileImage, setProfileImage] = useState(null);

  const authFetch = useCallback(async (url, options = {}) => {
    if (!currentUser?.accessToken) {
      throw new Error('User not authenticated');
    }

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.accessToken}`,
        ...options.headers,
      },
    });
  }, [currentUser?.accessToken]);

  useAuthSessionBootstrap({
    setCurrentUser,
    setUserType,
    setIsInitializing,
  });

  const refreshProfile = useCallback(async () => {
    const uid = currentUser?.id || currentUser?.uid;
    if (!uid || !userType) return;
    const data = await fetchUserProfileByRole({ userId: uid, userType });
    if (data) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : data));
    }
  }, [currentUser?.id, currentUser?.uid, userType]);

  const authActions = useMemo(() => {
    return createAuthDomainActions({
      currentUser,
      setCurrentUser,
      setUserType,
      setLoading,
    });
  }, [currentUser, setCurrentUser, setUserType, setLoading]);

  const profileActions = useMemo(() => {
    return createProfileDomainActions({
      currentUser,
      userType,
      setCurrentUser,
      setProfileImage,
      setLoading,
    });
  }, [currentUser, userType, setCurrentUser, setProfileImage, setLoading]);

  const tripActions = useMemo(() => {
    return createTripDomainActions({ currentUser });
  }, [currentUser]);

  const driverActions = useMemo(() => {
    return createDriverDomainActions({ authFetch });
  }, [authFetch]);

  const paymentActions = useMemo(() => {
    return createPaymentDomainActions({
      currentUser,
      updateRequestStatus: tripActions.updateRequestStatus,
      getRequestById: tripActions.getRequestById,
      getDriverProfile: driverActions.getDriverProfile,
      calculateDriverEarnings: driverActions.calculateDriverEarnings,
      updateDriverEarnings: driverActions.updateDriverEarnings,
    });
  }, [
    currentUser,
    tripActions.updateRequestStatus,
    tripActions.getRequestById,
    driverActions.getDriverProfile,
    driverActions.calculateDriverEarnings,
    driverActions.updateDriverEarnings,
  ]);

  const messagingActions = useMemo(() => {
    return createMessagingDomainActions();
  }, []);

  const termsActions = useMemo(() => {
    return createTermsDomainActions({ currentUser });
  }, [currentUser]);

  const storageActions = useMemo(() => {
    return createStorageDomainActions();
  }, []);

  const identityValue = useMemo(() => {
    return {
      currentUser,
      userType,
      loading,
      isInitializing,
      profileImage,
      refreshProfile,
    };
  }, [currentUser, userType, loading, isInitializing, profileImage, refreshProfile]);

  return (
    <AuthIdentityContext.Provider value={identityValue}>
      <AuthActionsContext.Provider value={authActions}>
        <ProfileActionsContext.Provider value={profileActions}>
          <TripActionsContext.Provider value={tripActions}>
            <DriverActionsContext.Provider value={driverActions}>
              <PaymentActionsContext.Provider value={paymentActions}>
                <MessagingActionsContext.Provider value={messagingActions}>
                  <TermsActionsContext.Provider value={termsActions}>
                    <StorageActionsContext.Provider value={storageActions}>
                      {children}
                    </StorageActionsContext.Provider>
                  </TermsActionsContext.Provider>
                </MessagingActionsContext.Provider>
              </PaymentActionsContext.Provider>
            </DriverActionsContext.Provider>
          </TripActionsContext.Provider>
        </ProfileActionsContext.Provider>
      </AuthActionsContext.Provider>
    </AuthIdentityContext.Provider>
  );
}
