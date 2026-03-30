import { useEffect } from 'react';
import * as AuthService from '../services/AuthService';
import { logger } from '../services/logger';
import {
  detectUserTypeForSession,
  fetchUserProfileByRole,
  subscribeToAuthStateChanges,
} from '../services/authSessionService';

const isNoRowsError = (error) => error?.code === 'PGRST116';

/**
 * Handles auth hydration and Supabase auth state subscription bootstrap.
 */
export default function useAuthSessionBootstrap({
  setCurrentUser,
  setUserType,
  setIsInitializing,
}) {
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

    const hydrateFromStorage = async () => {
      try {
        const stored = await AuthService.hydrateFromStorage();
        if (stored && mounted) {
          setCurrentUser(stored.user);
          setUserType(stored.userType);
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
        const shouldSuppressBootstrap = AuthService.consumeRecoveryBootstrapSuppression?.();
        if (shouldSuppressBootstrap && (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session))) {
          markInitialized();
          return;
        }

        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
          if (!session) return;

          const metadata = session.user.user_metadata || {};
          const detectedUserType = await detectUserTypeForSession({
            userId: session.user.id,
            metadataUserType: metadata.user_type,
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
          markInitialized();

          fetchUserProfileByRole({ userId: session.user.id, userType: detectedUserType })
            .then((data) => {
              if (data && mounted) {
                setCurrentUser((prev) => (prev ? { ...prev, ...data } : data));
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
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setCurrentUser(null);
          setUserType(null);
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
