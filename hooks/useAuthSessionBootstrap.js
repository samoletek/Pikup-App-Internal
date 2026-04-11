import { useEffect, useRef } from 'react';
import * as AuthService from '../services/AuthService';
import { persistAuthUser } from '../services/authStorageService';
import { logger } from '../services/logger';
import {
  detectUserTypeForSession,
  fetchUserProfileByRole,
  getCurrentAuthSession,
  subscribeToAuthStateChanges,
} from '../services/authSessionService';

const isNoRowsError = (error) => error?.code === 'PGRST116';
const SESSION_END_VERIFICATION_RETRY_DELAY_MS = 350;
const waitFor = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));

/**
 * Handles auth hydration and Supabase auth state subscription bootstrap.
 */
export default function useAuthSessionBootstrap({
  setCurrentUser,
  setUserType,
  setIsInitializing,
}) {
  const lastKnownUserTypeRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let authTimeout = null;

    const clearAuthTimeout = () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
    };

    const markInitialized = () => {
      clearAuthTimeout();
      setIsInitializing(false);
    };

    const verifySessionEnded = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data: latestSessionData, error: latestSessionError } = await getCurrentAuthSession();
        const latestSession = latestSessionData?.session || null;

        if (latestSession?.user?.id) {
          return {
            ended: false,
            userId: latestSession.user.id,
            error: null,
          };
        }

        if (!latestSessionError) {
          return {
            ended: true,
            userId: null,
            error: null,
          };
        }

        if (attempt === 0) {
          await waitFor(SESSION_END_VERIFICATION_RETRY_DELAY_MS);
          continue;
        }

        return {
          ended: false,
          userId: null,
          error: latestSessionError,
        };
      }

      return {
        ended: false,
        userId: null,
        error: null,
      };
    };

    const hydrateFromStorage = async () => {
      try {
        const stored = await AuthService.hydrateFromStorage();
        if (stored && mounted) {
          setCurrentUser(stored.user);
          setUserType(stored.userType);
          lastKnownUserTypeRef.current = stored.userType || null;
          markInitialized();
          return true;
        }

        return false;
      } catch (error) {
        logger.error('AuthContext', 'Hydration failed', error);
        return false;
      }
    };

    hydrateFromStorage();

    authTimeout = setTimeout(() => {
      if (mounted) {
        logger.warn('AuthContext', 'Auth timeout - unblocking UI');
        setIsInitializing(false);
      }
    }, 3000);

    const unsubscribeAuth = subscribeToAuthStateChanges(async (event, session) => {
      if (!mounted) return;

      try {
        const isSessionReadyEvent =
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          (event === 'INITIAL_SESSION' && session);
        const shouldSuppressBootstrap = AuthService.consumeRecoveryBootstrapSuppression?.();
        if (shouldSuppressBootstrap && (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session))) {
          markInitialized();
          return;
        }

        if (isSessionReadyEvent) {
          if (!session) return;

          const metadata = session.user.user_metadata || {};
          const detectedUserType = await detectUserTypeForSession({
            userId: session.user.id,
            metadataUserType: metadata.user_type,
            preferredUserType: lastKnownUserTypeRef.current,
          });

          const fullUser = {
            ...session.user,
            id: session.user.id,
            email: session.user.email,
            first_name: metadata.firstName || metadata.first_name || '',
            last_name: metadata.lastName || metadata.last_name || '',
            phone_number: metadata.phoneNumber || metadata.phone_number || '',
            accessToken: session.access_token,
            user_type: detectedUserType,
          };

          setCurrentUser(fullUser);
          setUserType(detectedUserType);
          lastKnownUserTypeRef.current = detectedUserType;
          void persistAuthUser({ user: fullUser, userType: detectedUserType }).catch((persistError) => {
            logger.warn('AuthContext', 'Failed to persist auth snapshot', persistError);
          });
          markInitialized();

          fetchUserProfileByRole({ userId: session.user.id, userType: detectedUserType })
            .then((data) => {
              if (data && mounted) {
                setCurrentUser((prev) => {
                  const mergedUser = prev ? { ...prev, ...data } : data;
                  void persistAuthUser({ user: mergedUser, userType: detectedUserType }).catch((persistError) => {
                    logger.warn('AuthContext', 'Failed to persist merged auth profile', persistError);
                  });
                  return mergedUser;
                });
              }
            })
            .catch((error) => {
              if (isNoRowsError(error)) {
                logger.info('AuthContext', 'Profile row is not created yet during auth state change', {
                  userId: session.user.id,
                  userType: detectedUserType,
                });
                return;
              }
              logger.warn('AuthContext', 'Failed to fetch profile during auth state change', error);
            });
        } else if (event === 'SIGNED_OUT') {
          const sessionEndVerification = await verifySessionEnded();

          if (!sessionEndVerification.ended) {
            if (sessionEndVerification.userId) {
              logger.warn('AuthContext', 'Ignoring transient SIGNED_OUT event while session is still active', {
                userId: sessionEndVerification.userId,
              });
            } else if (sessionEndVerification.error) {
              logger.warn('AuthContext', 'Ignoring SIGNED_OUT due transient session verification error', {
                code: sessionEndVerification.error?.code || null,
                message: sessionEndVerification.error?.message || String(sessionEndVerification.error),
              });
            } else {
              logger.warn('AuthContext', 'Ignoring ambiguous SIGNED_OUT event while session verification is inconclusive');
            }
            markInitialized();
            return;
          }

          logger.warn('AuthContext', 'Auth session ended', {
            event,
            hadSession: Boolean(session),
          });
          setCurrentUser(null);
          setUserType(null);
          lastKnownUserTypeRef.current = null;
          markInitialized();
        } else if (event === 'INITIAL_SESSION' && !session) {
          logger.warn('AuthContext', 'Auth session ended', {
            event,
            hadSession: Boolean(session),
          });
          setCurrentUser(null);
          setUserType(null);
          lastKnownUserTypeRef.current = null;
          markInitialized();
        }
      } catch (error) {
        logger.error('AuthContext', 'Error in auth state change', error);
        markInitialized();
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
      clearAuthTimeout();
    };
  }, [setCurrentUser, setIsInitializing, setUserType]);
}
