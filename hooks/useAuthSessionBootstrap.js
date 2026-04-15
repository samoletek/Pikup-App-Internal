import { useEffect, useRef } from 'react';
import * as AuthService from '../services/AuthService';
import { persistAuthUser } from '../services/authStorageService';
import { logger } from '../services/logger';
import {
  detectUserTypeForSession,
  fetchUserProfileByRole,
  getCurrentAuthSession,
  refreshCurrentAuthSession,
  subscribeToAuthStateChanges,
} from '../services/authSessionService';

const isNoRowsError = (error) => error?.code === 'PGRST116';
const SESSION_END_VERIFICATION_RETRY_DELAY_MS = 350;
const waitFor = (timeoutMs) => new Promise((resolve) => setTimeout(resolve, timeoutMs));

const isTransientSessionCheckError = (error) => {
  if (!error) {
    return false;
  }

  const statusCode = Number(error?.status || error?.context?.status || 0);
  if ([408, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }

  const text = String(error?.message || error?.details || '').trim().toLowerCase();
  return (
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('fetch failed') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('request failed') ||
    text.includes('gateway') ||
    text.includes('temporarily unavailable') ||
    text.includes('aborted')
  );
};

const mapSessionToAuthUser = ({ session, detectedUserType, profileData = null }) => {
  const metadata = session?.user?.user_metadata || {};
  const baseUser = {
    ...session.user,
    id: session.user.id,
    email: session.user.email,
    first_name: metadata.firstName || metadata.first_name || '',
    last_name: metadata.lastName || metadata.last_name || '',
    phone_number: metadata.phoneNumber || metadata.phone_number || '',
    accessToken: session.access_token,
    user_type: detectedUserType,
  };

  return profileData ? { ...baseUser, ...profileData } : baseUser;
};

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
          const { data: refreshedSessionData, error: refreshError } = await refreshCurrentAuthSession();
          const refreshedSession = refreshedSessionData?.session || null;

          if (refreshedSession?.user?.id) {
            return {
              ended: false,
              userId: refreshedSession.user.id,
              error: null,
            };
          }

          if (refreshError) {
            if (isTransientSessionCheckError(refreshError)) {
              return {
                ended: false,
                userId: null,
                error: refreshError,
              };
            }

            logger.info('AuthContext', 'Session refresh check after auth event did not recover session', {
              code: refreshError?.code || null,
              message: refreshError?.message || null,
            });
          }

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
      void (async () => {
        if (!mounted) {
          return;
        }

        logger.warn('AuthContext', 'Auth timeout reached. Running final session check before unblocking UI');

        try {
          const { data: latestSessionData, error: latestSessionError } = await getCurrentAuthSession();
          const latestSession = latestSessionData?.session || null;

          if (latestSession?.user?.id) {
            await resolveSessionReadyState(latestSession);
            return;
          }

          const { data: refreshedSessionData, error: refreshError } = await refreshCurrentAuthSession();
          const refreshedSession = refreshedSessionData?.session || null;

          if (refreshedSession?.user?.id) {
            await resolveSessionReadyState(refreshedSession);
            return;
          }

          if (
            isTransientSessionCheckError(latestSessionError) ||
            isTransientSessionCheckError(refreshError)
          ) {
            logger.warn('AuthContext', 'Auth timeout session check hit transient error; preserving hydrated user state');
            markInitialized();
            return;
          }

          setCurrentUser(null);
          setUserType(null);
          lastKnownUserTypeRef.current = null;
          markInitialized();
        } catch (finalCheckError) {
          logger.error('AuthContext', 'Final auth timeout session check failed', finalCheckError);
          markInitialized();
        }
      })();
    }, 3000);

    const resolveSessionReadyState = async (session) => {
      if (!session) {
        return;
      }

      const detectedUserType = await detectUserTypeForSession({
        userId: session.user.id,
        metadataUserType: session.user?.user_metadata?.user_type,
        preferredUserType: lastKnownUserTypeRef.current,
      });

      let profileData = null;
      try {
        profileData = await fetchUserProfileByRole({
          userId: session.user.id,
          userType: detectedUserType,
        });
      } catch (profileError) {
        if (!isNoRowsError(profileError)) {
          logger.warn('AuthContext', 'Failed to fetch profile during auth bootstrap', profileError);
        }
      }

      const fullUser = mapSessionToAuthUser({
        session,
        detectedUserType,
        profileData,
      });

      setCurrentUser(fullUser);
      setUserType(detectedUserType);
      lastKnownUserTypeRef.current = detectedUserType;

      void persistAuthUser({ user: fullUser, userType: detectedUserType }).catch((persistError) => {
        logger.warn('AuthContext', 'Failed to persist auth snapshot', persistError);
      });

      markInitialized();
    };

    const resolveSessionEndedState = async ({ event, session }) => {
      const sessionEndVerification = await verifySessionEnded();

      if (!sessionEndVerification.ended) {
        if (sessionEndVerification.userId) {
          logger.warn('AuthContext', `Ignoring transient ${event} event while session is still active`, {
            userId: sessionEndVerification.userId,
          });
        } else if (sessionEndVerification.error) {
          logger.warn('AuthContext', `Ignoring ${event} due transient session verification error`, {
            code: sessionEndVerification.error?.code || null,
            message: sessionEndVerification.error?.message || String(sessionEndVerification.error),
          });
        } else {
          logger.warn('AuthContext', `Ignoring ambiguous ${event} event while session verification is inconclusive`);
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
    };

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
          await resolveSessionReadyState(session);
        } else if (event === 'SIGNED_OUT') {
          await resolveSessionEndedState({ event, session });
        } else if (event === 'INITIAL_SESSION' && !session) {
          await resolveSessionEndedState({ event, session });
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
