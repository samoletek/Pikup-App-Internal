import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthService from '../services/AuthService';
import { createAuthActions } from './auth/createAuthActions';

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
      } catch (error) {
        console.error('Hydration failed:', error);
        return false;
      }
    };

    hydrateFromStorage();

    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth timeout - unblocking UI');
        setIsInitializing(false);
      }
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
          if (!session) return;

          const metadata = session.user.user_metadata || {};
          const detectedUserType = metadata.user_type || 'customer';

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
          setIsInitializing(false);

          const table = detectedUserType === 'driver' ? 'drivers' : 'customers';
          supabase
            .from(table)
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data && mounted) {
                setCurrentUser((prev) => (prev ? { ...prev, ...data } : data));
              }
            });
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setCurrentUser(null);
          setUserType(null);
          setIsInitializing(false);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setIsInitializing(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const actions = useMemo(() => {
    return createAuthActions({
      currentUser,
      userType,
      authFetch,
      setCurrentUser,
      setUserType,
      setLoading,
      setProfileImage,
    });
  }, [currentUser, userType, authFetch]);

  const value = useMemo(() => {
    return {
      currentUser,
      userType,
      loading,
      isInitializing,
      profileImage,
      ...actions,
    };
  }, [currentUser, userType, loading, isInitializing, profileImage, actions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
