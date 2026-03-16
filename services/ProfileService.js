// services/ProfileService.js
// Extracted from AuthContext.js - User profile and feedback management

import { uploadToSupabase } from './StorageService';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
    fetchProfileByTableAndUserId,
    getAuthenticatedUser,
    updateProfileByTableAndUserIdWithSelect,
    upsertProfileRowWithSelect,
} from './repositories/authRepository';
import {
    createRealtimeChannel,
    removeRealtimeChannel,
} from './repositories/messagingRepository';
import {
    getDriverFeedback,
    saveFeedback,
    submitTripRating,
    updateUserRating,
} from './profileFeedbackService';

const PROFILE_UPDATE_FIELD_MAP = Object.freeze({
    firstName: 'first_name',
    lastName: 'last_name',
    phoneNumber: 'phone_number',
    profileImageUrl: 'profile_image_url',
    profile_image_url: 'profile_image_url',
    avatarUrl: 'avatar_url',
    avatar_url: 'avatar_url',
    email: 'email',
});

const isNoRowsError = (error) => error?.code === 'PGRST116';

const buildProfileUpdatePayload = (updates = {}) => {
    const payload = {};

    Object.entries(updates).forEach(([key, value]) => {
        if (typeof value === 'undefined') return;
        const mappedKey = PROFILE_UPDATE_FIELD_MAP[key];
        if (mappedKey) {
            payload[mappedKey] = value;
        }
    });

    return payload;
};

const normalizeProfile = (profile, fallbackEmail = null) => {
    if (!profile) return null;

    return {
        ...profile,
        uid: profile.uid || profile.id || null,
        email: profile.email || fallbackEmail || null,
        firstName: profile.first_name ?? profile.firstName ?? '',
        lastName: profile.last_name ?? profile.lastName ?? '',
        phoneNumber: profile.phone_number ?? profile.phoneNumber ?? '',
        profileImageUrl:
            profile.profileImageUrl ||
            profile.profile_image_url ||
            profile.avatar_url ||
            null,
    };
};

export {
    getDriverFeedback,
    saveFeedback,
    submitTripRating,
    updateUserRating,
};

/**
 * Update user profile in database
 * @param {Object} updates - Profile fields to update
 * @param {Object} currentUser - Current user object
 * @param {string} userType - 'driver' or 'customer'
 * @returns {Promise<Object>} Updated profile data
 */
export const updateUserProfile = async (updates, currentUser, userType) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const userId = currentUser.id || currentUser.uid;
        const tableName = userType === 'driver' ? 'drivers' : 'customers';
        const dbUpdates = buildProfileUpdatePayload(updates);

        if (Object.keys(dbUpdates).length === 0) {
            return normalizeProfile(currentUser, currentUser?.email);
        }

        const { data: existingProfile, error: existingProfileError } = await fetchProfileByTableAndUserId(
            tableName,
            userId,
            {
                columns: 'id, email',
                maybeSingle: true,
            }
        );

        if (existingProfileError && !isNoRowsError(existingProfileError)) {
            throw existingProfileError;
        }

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await updateProfileByTableAndUserIdWithSelect(
            tableName,
            userId,
            dbUpdates
        );

        if (error && !isNoRowsError(error)) throw error;
        if (data) return normalizeProfile(data, currentUser?.email);

        // If update succeeded but no row was returned, keep local profile consistent.
        if (existingProfile) {
            return normalizeProfile(
                { ...currentUser, ...existingProfile, ...dbUpdates, id: userId },
                currentUser?.email
            );
        }

        // Fallback for missing row or strict RLS returning no selected rows.
        const { data: authData } = await getAuthenticatedUser();
        const fallbackEmail = updates?.email || currentUser?.email || authData?.user?.email || null;
        const upsertPayload = {
            id: userId,
            ...dbUpdates,
        };

        if (fallbackEmail && !upsertPayload.email) {
            upsertPayload.email = fallbackEmail;
        }

        const { data: upsertedData, error: upsertError } = await upsertProfileRowWithSelect(
            tableName,
            upsertPayload
        );

        if (upsertError) throw upsertError;
        return normalizeProfile(upsertedData || upsertPayload, fallbackEmail);
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to update profile');
        logger.error('ProfileService', 'Error updating profile', normalized, error);
        throw new Error(normalized.message);
    }
};

/**
 * Upload profile image to Supabase Storage
 * @param {string} imageUri - Local image URI
 * @param {Object} currentUser - Current user object
 * @param {string} userType - 'driver' or 'customer'
 * @returns {Promise<string>} Public URL of uploaded image
 */
export const uploadProfileImage = async (imageUri, currentUser, userType) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        logger.info('ProfileService', 'Uploading profile image to Supabase Storage');

        const userId = currentUser.id || currentUser.uid;
        const filename = `${userId}/${Date.now()}.jpg`;
        const publicUrl = await uploadToSupabase(imageUri, 'avatars', filename);

        // Update user profile in Supabase with new photo URL
        await updateUserProfile({ profile_image_url: publicUrl }, currentUser, userType);

        logger.info('ProfileService', 'Profile image uploaded successfully', { publicUrl });
        return publicUrl;

    } catch (error) {
        const normalized = normalizeError(error, 'Failed to upload profile image');
        logger.error('ProfileService', 'Error uploading profile image', normalized, error);
        throw new Error(normalized.message);
    }
};

/**
 * Get profile image URL from database
 * @param {Object} currentUser - Current user object
 * @param {string} userType - 'driver' or 'customer'
 * @returns {Promise<string|null>} Profile image URL or null
 */
export const getProfileImage = async (currentUser, userType) => {
    if (!currentUser) return null;

    try {
        const userId = currentUser.id || currentUser.uid;
        const { data, error } = await fetchProfileByTableAndUserId(
            userType === 'driver' ? 'drivers' : 'customers',
            userId,
            {
                columns: 'profile_image_url',
                maybeSingle: true,
            }
        );

        if (error && !isNoRowsError(error)) {
            throw error;
        }

        if (data?.profile_image_url) {
            return data.profile_image_url;
        }
        return null;
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to load profile image');
        logger.error('ProfileService', 'Error getting profile image', normalized, error);
        throw new Error(normalized.message);
    }
};

/**
 * Delete/remove profile image
 * @param {Object} currentUser - Current user object
 * @param {string} userType - 'driver' or 'customer'
 */
export const deleteProfileImage = async (currentUser, userType) => {
    if (!currentUser) return;
    await updateUserProfile({ profile_image_url: null }, currentUser, userType);
};

/**
 * Get full user profile from database
 * @param {Object|string} currentUser - User object or explicit user ID
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async (currentUser) => {
    const userInput = currentUser ?? null;
    const userId = typeof userInput === 'string'
        ? userInput
        : (userInput?.id || userInput?.uid);
    const fallbackEmail = typeof userInput === 'object' ? userInput?.email : null;

    if (!userId) {
        throw new Error('User not authenticated');
    }

    try {
        // Try to get from customers table first
        let { data: profile } = await fetchProfileByTableAndUserId('customers', userId, {
            columns: '*',
            maybeSingle: true,
        });

        if (!profile) {
            // If not found, try drivers table
            const { data: driverProfile } = await fetchProfileByTableAndUserId('drivers', userId, {
                columns: '*',
                maybeSingle: true,
            });

            profile = driverProfile;
        }

        if (profile) {
            return normalizeProfile(profile, fallbackEmail);
        }

        // Fallback if no profile found
        return {
            uid: userId,
            email: fallbackEmail || null,
            firstName: '',
            lastName: '',
            phoneNumber: '',
            profileImageUrl: null
        };

    } catch (error) {
        const normalized = normalizeError(error, 'Failed to load user profile');
        logger.error('ProfileService', 'Error getting user profile', normalized, error);
        throw new Error(normalized.message);
    }
};

/**
 * Subscribe to customer profile updates.
 * @param {string} customerId
 * @param {(profile: object) => void} onProfileUpdate
 * @returns {() => void} Unsubscribe callback
 */
export const subscribeToCustomerProfileUpdates = (customerId, onProfileUpdate) => {
    if (!customerId) {
        return () => {};
    }

    const channel = createRealtimeChannel(`customer:profile:${customerId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'customers',
                filter: `id=eq.${customerId}`,
            },
            (payload) => {
                const nextProfile = payload?.new;
                if (!nextProfile) return;
                onProfileUpdate?.(nextProfile);
            }
        )
        .subscribe();

    return () => {
        removeRealtimeChannel(channel);
    };
};
