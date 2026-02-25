// services/AuthService.js
// Extracted from AuthContext.js - Core authentication functions

import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { DRIVER_RATING_BADGES } from '../constants/ratingBadges';
import { checkTermsAcceptance } from './TermsService';

const DEFAULT_DRIVER_BADGE_STATS = Object.freeze(
    DRIVER_RATING_BADGES.reduce((acc, badge) => {
        acc[badge.id] = 0;
        return acc;
    }, {})
);

const getMissingColumnFromError = (error) => {
    const message = String(error?.message || '');
    let match = message.match(/Could not find the '([^']+)' column/i);
    if (match?.[1]) return match[1];

    match = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
    if (match?.[1]) return match[1].split('.').pop();

    return null;
};

const applyProfileUpdateWithColumnFallback = async (tableName, userId, rawUpdates = {}) => {
    const updates = { ...rawUpdates };

    while (Object.keys(updates).length > 0) {
        const { error } = await supabase
            .from(tableName)
            .update(updates)
            .eq('id', userId);

        if (!error) {
            return true;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
            console.warn(`"${tableName}" is missing optional column "${missingColumn}". Retrying without it.`);
            delete updates[missingColumn];
            continue;
        }

        throw error;
    }

    return false;
};

const seedInitialProfileStats = async (tableName, userId, userType) => {
    const timestamp = new Date().toISOString();
    const baseUpdates = {
        rating_count: 0,
        updated_at: timestamp,
    };

    if (userType === 'driver') {
        baseUpdates.badge_stats = { ...DEFAULT_DRIVER_BADGE_STATS };
    }

    await applyProfileUpdateWithColumnFallback(tableName, userId, baseUpdates);

    if (userType !== 'driver') {
        return;
    }

    const { data: profileRow } = await supabase
        .from(tableName)
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();

    const currentMetadata =
        profileRow?.metadata && typeof profileRow.metadata === 'object' && !Array.isArray(profileRow.metadata)
            ? profileRow.metadata
            : {};
    const currentBadgeStats =
        currentMetadata.badge_stats &&
        typeof currentMetadata.badge_stats === 'object' &&
        !Array.isArray(currentMetadata.badge_stats)
            ? currentMetadata.badge_stats
            : {};
    const metadataBadgeStats = {
        ...DEFAULT_DRIVER_BADGE_STATS,
        ...currentBadgeStats,
    };

    await applyProfileUpdateWithColumnFallback(tableName, userId, {
        metadata: {
            ...currentMetadata,
            badge_stats: metadataBadgeStats,
        },
        updated_at: timestamp,
    });
};

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
        console.log('🔄 Starting signup (Table-Separated)...', email, type);
        const tableName = type === 'driver' ? 'drivers' : 'customers';

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    user_type: type,
                    ...additionalData
                }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Signup failed: No user returned');

        console.log(`✅ Supabase signup successful. Creating profile in "${tableName}"...`);

        await new Promise(resolve => setTimeout(resolve, 500));

        const profileData = {
            id: authData.user.id,
            email: authData.user.email,
            first_name: additionalData.firstName || '',
            last_name: additionalData.lastName || '',
            phone_number: additionalData.phoneNumber || '',
            phone_verified: !!additionalData.phoneVerified,
            rating: 5.0,
            created_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
            .from(tableName)
            .insert(profileData);

        if (profileError) {
            console.warn(`⚠️ Error creating profile in ${tableName}:`, profileError);
        } else {
            console.log(`✅ Profile created in "${tableName}"`);
            try {
                await seedInitialProfileStats(tableName, authData.user.id, type);
            } catch (seedError) {
                console.warn('Could not seed initial profile stats:', seedError);
            }
        }

        const fullUser = {
            ...authData.user,
            ...profileData,
            uid: authData.user.id,
            user_type: type
        };

        await AsyncStorage.setItem('currentUser', JSON.stringify(fullUser));
        await AsyncStorage.setItem('userType', type);

        console.log('✅ Signup complete!');
        return { user: fullUser, userType: type };
    } catch (error) {
        console.error('Signup error:', error);
        throw error;
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
            console.warn('Login called without expectedRole, defaulting to loose check');
        }

        console.log(`Logging in as ${expectedRole || 'unknown'}...`);
        const targetTable = expectedRole === 'driver' ? 'drivers' : 'customers';

        const { data: authData, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!authData.user) throw new Error('Login failed: No user returned');

        console.log(`✅ Auth successful. Verifying profile in "${targetTable}"...`);

        let profile = null;

        if (expectedRole) {
            const { data, error } = await supabase
                .from(targetTable)
                .select('*')
                .eq('id', authData.user.id)
                .single();
            profile = data;
        } else {
            const { data: cust } = await supabase.from('customers').select('*').eq('id', authData.user.id).single();
            if (cust) { profile = cust; expectedRole = 'customer'; }
            else {
                const { data: driv } = await supabase.from('drivers').select('*').eq('id', authData.user.id).single();
                if (driv) { profile = driv; expectedRole = 'driver'; }
            }
        }

        if (!profile) {
            if (expectedRole) {
                const otherTable = expectedRole === 'driver' ? 'customers' : 'drivers';
                const { data: otherProfile } = await supabase
                    .from(otherTable)
                    .select('id')
                    .eq('id', authData.user.id)
                    .single();

                if (otherProfile) {
                    console.warn(`Role mismatch: User is a ${otherTable} trying to login as ${expectedRole}`);
                    await supabase.auth.signOut();
                    throw new Error(`Wrong portal. You are registered as a ${otherTable === 'drivers' ? 'Driver' : 'Customer'}. Please use the correct login button.`);
                }
            }

            console.warn(`User authenticated but not found in ${targetTable}.`);
            await supabase.auth.signOut();
            throw new Error(`Profile not found in ${targetTable}. Please contact support.`);
        }

        console.log(`✅ Verified user in ${targetTable}:`, profile.id);

        const fullUser = {
            ...authData.user,
            ...profile,
            uid: authData.user.id,
            accessToken: authData.session?.access_token,
            user_type: expectedRole
        };

        await AsyncStorage.setItem('currentUser', JSON.stringify(fullUser));
        await AsyncStorage.setItem('userType', expectedRole);

        return { user: fullUser, userType: expectedRole };

    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

/**
 * Logout current user
 */
export const logout = async () => {
    try {
        const { error } = await supabase.auth.signOut();

        const allKeys = await AsyncStorage.getAllKeys();
        const scopedPaymentKeys = allKeys.filter((key) =>
            key === 'paymentMethods' ||
            key === 'defaultPaymentMethod' ||
            key.startsWith('paymentMethods:') ||
            key.startsWith('defaultPaymentMethod:') ||
            key === 'expected_role'
        );

        await AsyncStorage.removeItem('currentUser');
        await AsyncStorage.removeItem('userType');
        if (scopedPaymentKeys.length > 0) {
            await AsyncStorage.multiRemove(scopedPaymentKeys);
        }

        console.log('Logged out successfully');

        if (error) console.warn('SignOut error:', error);
    } catch (error) {
        console.error('Logout error:', error);
    }
};

/**
 * Sign in with Apple
 * @param {string} userRole - Expected role ('customer' or 'driver')
 * @returns {Promise<Object>} Sign in result
 */
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

        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: identityToken,
            nonce: nonce,
        });

        if (error) throw error;

        const { user, session } = data;
        console.log('Supabase Apple Sign In successful:', user.id);

        let firstName = '';
        let lastName = '';
        if (fullName) {
            if (fullName.givenName) firstName = fullName.givenName;
            if (fullName.familyName) lastName = fullName.familyName;
        }

        const profileUpdates = {
            id: user.id,
            email: email || user.email,
            updated_at: new Date().toISOString(),
        };

        if (firstName) profileUpdates.first_name = firstName;
        if (lastName) profileUpdates.last_name = lastName;

        const targetTable = userRole === 'driver' ? 'drivers' : 'customers';
        const otherTable = userRole === 'driver' ? 'customers' : 'drivers';

        // Strict role check
        const { data: otherProfile } = await supabase.from(otherTable).select('id').eq('id', user.id).single();

        if (otherProfile) {
            console.warn(`Role mismatch (Apple): User is a ${otherTable} trying to login as ${userRole}`);
            await supabase.auth.signOut();
            throw new Error(`Wrong portal. You are registered as a ${otherTable === 'drivers' ? 'Driver' : 'Customer'}. Please use the correct login button.`);
        }

        const { data: existingProfile } = await supabase.from(targetTable).select('id').eq('id', user.id).single();

        if (!existingProfile) {
            profileUpdates.created_at = new Date().toISOString();
            profileUpdates.rating = 5.0;
        }

        const { error: profileError } = await supabase
            .from(targetTable)
            .upsert(profileUpdates);

        if (profileError) {
            console.error('Error updating profile for Apple User:', profileError);
        } else if (!existingProfile) {
            try {
                await seedInitialProfileStats(targetTable, user.id, userRole);
            } catch (seedError) {
                console.warn('Could not seed initial profile stats for Apple user:', seedError);
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
                missingVersions: status.missingVersions
            };
        } catch (e) {
            return {
                user: fullUser,
                userType: userRole,
                needsConsent: true,
                missingVersions: ['tosVersion']
            };
        }

    } catch (error) {
        if (error.code === 'ERR_CANCELED') {
            console.log('Apple Sign In canceled');
            return { canceled: true };
        }
        console.error('Apple Sign In Error:', error);
        throw error;
    }
};

/**
 * Helper to extract params from URL fragment
 */
const extractParamsFromUrl = (url) => {
    const params = {};
    const regex = /([^&=]+)=([^&]*)/g;
    const fragmentString = url.split('#')[1] || url.split('?')[1];
    if (fragmentString) {
        let m;
        while ((m = regex.exec(fragmentString))) {
            params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
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

    const { data: otherProfile, error: otherProfileError } = await supabase
        .from(otherTable)
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

    if (otherProfileError) {
        throw otherProfileError;
    }

    if (otherProfile) {
        await supabase.auth.signOut();
        throw new Error(
            `Wrong portal. You are registered as a ${otherTable === 'drivers' ? 'Driver' : 'Customer'}. Please use the correct login button.`
        );
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
        .from(targetTable)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

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

    const { data: newProfile, error: upsertError } = await supabase
        .from(targetTable)
        .upsert(profileSeed)
        .select('*')
        .single();

    if (upsertError) {
        throw upsertError;
    }

    try {
        await seedInitialProfileStats(targetTable, user.id, userRole);
    } catch (seedError) {
        console.warn('Could not seed initial profile stats for OAuth user:', seedError);
    }

    return newProfile;
};

/**
 * Sign in with Google
 * @param {string} userRole - Expected role ('customer' or 'driver')
 * @returns {Promise<Object>} Sign in result
 */
export const signInWithGoogle = async (userRole = 'customer') => {
    try {
        const redirectUri = 'pikup://params';
        console.log('Starting Google Auth with redirect:', redirectUri);

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUri,
                skipBrowserRedirect: true
            }
        });

        if (error) throw error;

        if (data?.url) {
            console.log('Opening WebBrowser with URL:', data.url);
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri, {
                preferEphemeralSession: true
            });

            console.log('WebBrowser result:', result.type);
            if (result.type === 'success' && result.url) {
                console.log('Auth success, parsing params...');
                const { access_token, refresh_token } = extractParamsFromUrl(result.url);

                if (access_token && refresh_token) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token,
                        refresh_token,
                    });
                    if (sessionError) throw sessionError;

                    const {
                        data: { user },
                        error: userError
                    } = await supabase.auth.getUser();

                    if (userError || !user) {
                        throw new Error('Google authentication succeeded but user data is unavailable.');
                    }

                    const profile = await ensureOAuthRoleProfile(user, userRole);

                    const { error: metadataError } = await supabase.auth.updateUser({
                        data: {
                            user_type: userRole,
                        }
                    });
                    if (metadataError) {
                        console.warn('Unable to persist user_type metadata after Google sign-in:', metadataError);
                    }

                    const { data: sessionData } = await supabase.auth.getSession();
                    const activeSession = sessionData?.session;
                    const fullUser = {
                        ...user,
                        ...profile,
                        uid: user.id,
                        accessToken: activeSession?.access_token || access_token,
                        user_type: userRole,
                    };

                    await AsyncStorage.setItem('currentUser', JSON.stringify(fullUser));
                    await AsyncStorage.setItem('userType', userRole);

                    console.log('Supabase session set successfully');
                    return { success: true, user: fullUser, userType: userRole };
                } else {
                    console.warn('No tokens found in URL');
                    throw new Error('Authentication failed: No tokens received');
                }
            } else {
                return { canceled: true };
            }
        }

    } catch (error) {
        console.error('Google Sign In Error:', error);
        throw error;
    }
};

/**
 * Change current user password
 * @param {Object} currentUser - Current user object
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} Success status
 */
export const changePassword = async (currentUser, currentPassword, newPassword) => {
    const userEmail = currentUser?.email;

    if (!currentUser?.id && !currentUser?.uid) {
        throw new Error('User not authenticated');
    }

    if (!userEmail) {
        throw new Error('Cannot change password for this account.');
    }

    if (!currentPassword || !newPassword) {
        throw new Error('Current and new password are required.');
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword
    });

    if (reauthError) {
        throw new Error('Current password is incorrect.');
    }

    const { error: updateError } = await supabase.auth.updateUser({
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

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
        throw error;
    }

    return true;
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
        console.log('Starting account deletion process...');
        const userId = currentUser.id || currentUser.uid;
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            throw sessionError;
        }

        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
            throw new Error('Your session has expired. Please sign in again and retry account deletion.');
        }

        const { data, error } = await supabase.functions.invoke('delete-user', {
            body: { userId },
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (error) {
            let functionMessage = '';

            if (error?.context) {
                try {
                    const errorBody = await error.context.clone().json();
                    functionMessage = errorBody?.error || errorBody?.message || '';
                } catch (parseError) {
                    try {
                        functionMessage = await error.context.clone().text();
                    } catch (textParseError) {
                        functionMessage = '';
                    }
                }
            }

            throw new Error(functionMessage || error?.message || 'Failed to delete account');
        }

        if (!data?.success) {
            throw new Error(data.error || 'Failed to delete account');
        }

        console.log('Account fully deleted via Edge Function');

        await logout();

        return true;
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
};

/**
 * Hydrate user from AsyncStorage (for fast startup)
 * @returns {Promise<Object|null>} Stored user or null
 */
export const hydrateFromStorage = async () => {
    try {
        console.log('⚡️ Trying fast auth hydration from AsyncStorage...');
        const storedUser = await AsyncStorage.getItem('currentUser');
        const storedUserType = await AsyncStorage.getItem('userType');

        if (storedUser && storedUserType) {
            const parsedUser = JSON.parse(storedUser);
            console.log('✅ Hydrated user from storage:', parsedUser.email, 'Role:', storedUserType);
            return { user: parsedUser, userType: storedUserType };
        }
        return null;
    } catch (error) {
        console.error('Error hydrating from storage:', error);
        return null;
    }
};
