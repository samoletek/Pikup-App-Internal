// services/AuthService.js
// Extracted from AuthContext.js - Core authentication functions

import {
  signInWithApple,
  signInWithGoogle,
} from './authOAuthService';
import {
  buildFullAuthUser,
  ensureRoleMismatchError,
  getProfileTableByRole,
  insertProfileForSignup,
  resolveProfileForLogin,
} from './authProfileService';
import {
  clearAuthStorage,
  hydrateAuthUserFromStorage,
  persistAuthUser,
} from './authStorageService';
import { invokeDeleteAccountEdgeFunction } from './authAccountDeletionService';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  invokeCheckUserExists,
  resetPasswordForEmail,
  signInWithPassword,
  signOut as signOutAuth,
  signUpWithPassword,
  updateAuthenticatedUser,
} from './repositories/authRepository';

export {
  signInWithApple,
  signInWithGoogle,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sign up new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} type - 'customer' or 'driver'
 * @param {Object} additionalData - Extra profile data
 * @returns {Promise<Object>} Created user
 */
export const signup = async (email, password, type, additionalData = {}) => {
  try {
    logger.info('AuthService', 'Starting signup', {
      email,
      role: type,
    });

    const tableName = getProfileTableByRole(type);
    const { data: authData, error: authError } = await signUpWithPassword({
      email,
      password,
      metadata: {
        user_type: type,
        ...additionalData,
      },
    });

    if (authError) {
      throw authError;
    }
    if (!authData.user) {
      throw new Error('Signup failed: No user returned');
    }

    logger.info('AuthService', `Supabase signup successful. Creating profile in ${tableName}`);
    await wait(500);

    const profileData = await insertProfileForSignup({
      tableName,
      authUser: authData.user,
      userType: type,
      additionalData,
    });

    const fullUser = buildFullAuthUser({
      authUser: authData.user,
      profile: profileData,
      userType: type,
      accessToken: authData.session?.access_token,
    });

    await persistAuthUser({ user: fullUser, userType: type });
    logger.info('AuthService', 'Signup complete');

    return { user: fullUser, userType: type };
  } catch (error) {
    const normalized = normalizeError(error, 'Signup failed');
    logger.error('AuthService', 'Signup error', normalized, error);
    throw new Error(normalized.message);
  }
};

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} expectedRole - Expected role ('customer' or 'driver')
 * @returns {Promise<Object>} Logged in user
 */
export const login = async (email, password, expectedRole) => {
  try {
    if (!expectedRole) {
      logger.warn('AuthService', 'Login called without expectedRole, defaulting to loose check');
    }

    logger.info('AuthService', `Logging in as ${expectedRole || 'unknown'}`);
    const targetTable = getProfileTableByRole(expectedRole);

    const { data: authData, error } = await signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
    if (!authData.user) {
      throw new Error('Login failed: No user returned');
    }

    const resolved = await resolveProfileForLogin({
      userId: authData.user.id,
      expectedRole,
    });

    if (!resolved.profile) {
      if (expectedRole) {
        const mismatchError = await ensureRoleMismatchError({
          userId: authData.user.id,
          expectedRole,
        });
        if (mismatchError) {
          logger.warn('AuthService', 'Role mismatch detected during login', {
            expectedRole,
            userId: authData.user.id,
          });
          await signOutAuth();
          throw mismatchError;
        }
      }

      logger.warn('AuthService', `User authenticated but not found in ${targetTable}`);
      await signOutAuth();
      throw new Error(`Profile not found in ${targetTable}. Please contact support.`);
    }

    const resolvedRole = resolved.resolvedRole || expectedRole;
    const fullUser = buildFullAuthUser({
      authUser: authData.user,
      profile: resolved.profile,
      userType: resolvedRole,
      accessToken: authData.session?.access_token,
    });

    await persistAuthUser({ user: fullUser, userType: resolvedRole });
    logger.info('AuthService', 'Login successful', {
      userId: fullUser.uid,
      role: resolvedRole,
    });

    return { user: fullUser, userType: resolvedRole };
  } catch (error) {
    const normalized = normalizeError(error, 'Login failed');
    logger.error('AuthService', 'Login error', normalized, error);
    throw new Error(normalized.message);
  }
};

/**
 * Logout current user
 */
export const logout = async () => {
  try {
    const { error } = await signOutAuth();
    await clearAuthStorage();

    logger.info('AuthService', 'Logged out successfully');
    if (error) {
      logger.warn('AuthService', 'SignOut error', error);
    }
  } catch (error) {
    const normalized = normalizeError(error, 'Logout failed');
    logger.error('AuthService', 'Logout error', normalized, error);
  }
};

export const verifyAccountPassword = async (currentUser, password) => {
    const userEmail = currentUser?.email;

    if (!currentUser?.id && !currentUser?.uid) {
        throw new Error('User not authenticated');
    }

    if (!userEmail) {
        throw new Error('Password verification is unavailable for this account.');
    }

    if (!password) {
        throw new Error('Password is required.');
    }

    const { error: reauthError } = await signInWithPassword({
        email: userEmail,
        password,
    });

    if (reauthError) {
        throw new Error('Current password is incorrect.');
    }

    return true;
};

/**
 * Change current user password
 * @param {Object} currentUser - Current user object
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export const changePassword = async (currentUser, currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
        throw new Error('Current and new password are required.');
    }

    await verifyAccountPassword(currentUser, currentPassword);

    const { error: updateError } = await updateAuthenticatedUser({
        password: newPassword
    });

    if (updateError) {
        throw updateError;
    }

    return true;
};

/**
 * Send password reset email
 * @param {string} email - User email address
 * @returns {Promise<boolean>} Success status
 */
export const resetPassword = async (email) => {
    if (!email) {
        throw new Error('Email is required.');
    }

    const { error } = await resetPasswordForEmail(email);

    if (error) {
        throw error;
    }

    return true;
};

export const checkUserExists = async (email) => {
  if (!email) {
    throw new Error('Email is required.');
  }

  const { data, error } = await invokeCheckUserExists(email);

  if (error) {
    throw error;
  }

  return {
    exists: Boolean(data?.exists),
    userType: data?.userType || null,
  };
};

/**
 * Delete user account
 * @param {Object} currentUser - Current user object
 * @returns {Promise<boolean>} Success status
 */
export const deleteAccount = async (currentUser) => {
  if (!currentUser?.id && !currentUser?.uid) {
    throw new Error('User not authenticated');
  }

  try {
    const userId = currentUser.id || currentUser.uid;
    await invokeDeleteAccountEdgeFunction({ userId });
    await logout();
    return true;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to delete account');
    logger.error('AuthService', 'Error deleting account', normalized, error);
    throw new Error(normalized.message);
  }
};

/**
 * Hydrate user from AsyncStorage (for fast startup)
 * @returns {Promise<Object|null>} Stored user or null
 */
export const hydrateFromStorage = async () => {
  return hydrateAuthUserFromStorage();
};
