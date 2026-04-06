import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { checkTermsAcceptance } from './TermsService';
import { seedInitialProfileStats } from './authProfileSeedUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  fetchProfileByTableAndUserId,
  getAuthenticatedSession,
  getAuthenticatedUser,
  setAuthenticatedSession,
  signInWithIdToken,
  signInWithOAuth,
  signOut as signOutAuth,
  updateAuthenticatedUser,
  upsertProfileRow,
  upsertProfileRowWithSelect,
} from './repositories/authRepository';

const extractParamsFromUrl = (url) => {
  const params = {};
  const regex = /([^&=]+)=([^&]*)/g;
  const fragmentString = url.split('#')[1] || url.split('?')[1];
  if (fragmentString) {
    let match;
    while ((match = regex.exec(fragmentString))) {
      params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
    }
  }
  return params;
};

const resolveRoleTables = (userRole) => {
  const targetTable = userRole === 'driver' ? 'drivers' : 'customers';
  const otherTable = userRole === 'driver' ? 'customers' : 'drivers';
  return { targetTable, otherTable };
};

const ensureOAuthRoleProfile = async (user, userRole) => {
  const { targetTable, otherTable } = resolveRoleTables(userRole);

  const { data: otherProfile, error: otherProfileError } = await fetchProfileByTableAndUserId(
    otherTable,
    user.id,
    { columns: 'id', maybeSingle: true }
  );

  if (otherProfileError) {
    throw otherProfileError;
  }

  if (otherProfile) {
    await signOutAuth();
    throw new Error(
      `Wrong portal. You are registered as a ${otherTable === 'drivers' ? 'Driver' : 'Customer'}. Please use the correct login button.`
    );
  }

  const { data: existingProfile, error: existingProfileError } = await fetchProfileByTableAndUserId(
    targetTable,
    user.id,
    { columns: '*', maybeSingle: true }
  );

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const profileSeed = {
    id: user.id,
    email: user.email,
    rating: 5.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: newProfile, error: upsertError } = await upsertProfileRowWithSelect(
    targetTable,
    profileSeed
  );

  if (upsertError) {
    throw upsertError;
  }

  try {
    await seedInitialProfileStats(targetTable, user.id, userRole);
  } catch (seedError) {
    logger.warn('AuthOAuthService', 'Could not seed initial profile stats for OAuth user', seedError);
  }

  return newProfile;
};

export const signInWithApple = async (userRole = 'customer') => {
  try {
    const nonce = Math.random().toString(36).substring(2, 10);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce
    );

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const { identityToken, email, fullName } = appleCredential;

    if (!identityToken) {
      throw new Error('No identity token provided by Apple Sign In');
    }

    const { data, error } = await signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce,
    });

    if (error) {
      throw error;
    }

    const { user, session } = data;
    logger.info('AuthOAuthService', 'Supabase Apple Sign In successful', { userId: user.id });

    const { error: metadataError } = await updateAuthenticatedUser({
      data: {
        user_type: userRole,
      },
    });
    if (metadataError) {
      logger.warn(
        'AuthOAuthService',
        'Unable to persist user_type metadata after Apple sign-in',
        metadataError
      );
    }

    let firstName = '';
    let lastName = '';
    if (fullName) {
      if (fullName.givenName) {
        firstName = fullName.givenName;
      }
      if (fullName.familyName) {
        lastName = fullName.familyName;
      }
    }

    const profileUpdates = {
      id: user.id,
      email: email || user.email,
      updated_at: new Date().toISOString(),
    };

    if (firstName) {
      profileUpdates.first_name = firstName;
    }
    if (lastName) {
      profileUpdates.last_name = lastName;
    }

    const targetTable = userRole === 'driver' ? 'drivers' : 'customers';
    const otherTable = userRole === 'driver' ? 'customers' : 'drivers';

    const { data: otherProfile } = await fetchProfileByTableAndUserId(otherTable, user.id, {
      columns: 'id',
      maybeSingle: true,
    });

    if (otherProfile) {
      logger.warn('AuthOAuthService', 'Role mismatch (Apple)', {
        otherTable,
        requestedRole: userRole,
      });
      await signOutAuth();
      throw new Error(
        `Wrong portal. You are registered as a ${otherTable === 'drivers' ? 'Driver' : 'Customer'}. Please use the correct login button.`
      );
    }

    const { data: existingProfile } = await fetchProfileByTableAndUserId(targetTable, user.id, {
      columns: 'id',
      maybeSingle: true,
    });

    if (!existingProfile) {
      profileUpdates.created_at = new Date().toISOString();
      profileUpdates.rating = 5.0;
    }

    const { error: profileError } = await upsertProfileRow(targetTable, profileUpdates);

    if (profileError) {
      logger.error('AuthOAuthService', 'Error updating profile for Apple user', profileError);
    } else if (!existingProfile) {
      try {
        await seedInitialProfileStats(targetTable, user.id, userRole);
      } catch (seedError) {
        logger.warn('AuthOAuthService', 'Could not seed initial profile stats for Apple user', seedError);
      }
    }

    const fullUser = { ...user, accessToken: session.access_token, ...profileUpdates, ...existingProfile };

    await AsyncStorage.setItem('currentUser', JSON.stringify(fullUser));
    await AsyncStorage.setItem('userType', userRole);

    try {
      const status = await checkTermsAcceptance(user.id);
      return {
        user: fullUser,
        userType: userRole,
        needsConsent: status.needsAcceptance,
        missingVersions: status.missingVersions,
      };
    } catch (_error) {
      return {
        user: fullUser,
        userType: userRole,
        needsConsent: true,
        missingVersions: ['tosVersion'],
      };
    }
  } catch (error) {
    if (error.code === 'ERR_CANCELED') {
      logger.info('AuthOAuthService', 'Apple Sign In canceled');
      return { canceled: true };
    }

    const normalized = normalizeError(error, 'Apple sign in failed');
    logger.error('AuthOAuthService', 'Apple Sign In error', normalized, error);
    throw new Error(normalized.message);
  }
};

export const signInWithGoogle = async (userRole = 'customer') => {
  try {
    const redirectUri = 'pikup://params';
    logger.info('AuthOAuthService', 'Starting Google Auth', { redirectUri });

    const { data, error } = await signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      logger.info('AuthOAuthService', 'Opening WebBrowser for Google OAuth');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri, {
        preferEphemeralSession: true,
      });

      logger.info('AuthOAuthService', 'WebBrowser auth result', { type: result.type });
      if (result.type === 'success' && result.url) {
        logger.info('AuthOAuthService', 'Google OAuth success, parsing params');
        const { access_token: accessToken, refresh_token: refreshToken } = extractParamsFromUrl(result.url);

        if (accessToken && refreshToken) {
          const { error: sessionError } = await setAuthenticatedSession({
            accessToken,
            refreshToken,
          });
          if (sessionError) {
            throw sessionError;
          }

          const {
            data: { user },
            error: userError,
          } = await getAuthenticatedUser();

          if (userError || !user) {
            throw new Error('Google authentication succeeded but user data is unavailable.');
          }

          const profile = await ensureOAuthRoleProfile(user, userRole);

          const { error: metadataError } = await updateAuthenticatedUser({
            data: {
              user_type: userRole,
            },
          });
          if (metadataError) {
            logger.warn(
              'AuthOAuthService',
              'Unable to persist user_type metadata after Google sign-in',
              metadataError
            );
          }

          const { data: sessionData } = await getAuthenticatedSession();
          const activeSession = sessionData?.session;
          const fullUser = {
            ...user,
            ...profile,
            uid: user.id,
            accessToken: activeSession?.access_token || accessToken,
            user_type: userRole,
          };

          await AsyncStorage.setItem('currentUser', JSON.stringify(fullUser));
          await AsyncStorage.setItem('userType', userRole);

          logger.info('AuthOAuthService', 'Supabase session set successfully');
          return { user: fullUser, userType: userRole };
        }

        logger.warn('AuthOAuthService', 'No tokens found in OAuth callback URL');
        throw new Error('Authentication failed: No tokens received');
      }

      return { canceled: true };
    }

    return { canceled: true };
  } catch (error) {
    const normalized = normalizeError(error, 'Google sign in failed');
    logger.error('AuthOAuthService', 'Google Sign In error', normalized, error);
    throw new Error(normalized.message);
  }
};
