// services/AuthService.js
// Extracted from AuthContext.js - Core authentication functions

import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { checkTermsAcceptance } from './TermsService';

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

        await AsyncStorage.removeItem('currentUser');
        await AsyncStorage.removeItem('userType');

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
                    console.log('Supabase session set successfully');
                    return { success: true, userType: userRole };
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

        const { data, error } = await supabase.functions.invoke('delete-user');

        if (error) {
            throw error;
        }

        if (!data.success) {
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
