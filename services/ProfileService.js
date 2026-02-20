// services/ProfileService.js
// Extracted from AuthContext.js - User profile and feedback management

import { supabase } from '../config/supabase';
import { uploadToSupabase } from './StorageService';

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

const PROFILE_TABLE_BY_TYPE = Object.freeze({
    driver: 'drivers',
    customer: 'customers',
});

const FEEDBACK_ROLE_BY_TYPE = Object.freeze({
    driver: 'driver',
    customer: 'customer',
});

const normalizeUserType = (value, fallback = 'customer') => {
    if (value === 'driver' || value === 'customer') return value;
    return fallback;
};

const toBadgeStats = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return { ...value };
};

const hasMissingColumnError = (error, columnName) => {
    const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return (
        text.includes('does not exist') &&
        text.includes('column') &&
        text.includes(String(columnName || '').toLowerCase())
    );
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

        const { data: existingProfile, error: existingProfileError } = await supabase
            .from(tableName)
            .select('id, email')
            .eq('id', userId)
            .maybeSingle();

        if (existingProfileError && !isNoRowsError(existingProfileError)) {
            throw existingProfileError;
        }

        dbUpdates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from(tableName)
            .update(dbUpdates)
            .eq('id', userId)
            .select('*')
            .maybeSingle();

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
        const { data: authData } = await supabase.auth.getUser();
        const fallbackEmail = updates?.email || currentUser?.email || authData?.user?.email || null;
        const upsertPayload = {
            id: userId,
            ...dbUpdates,
        };

        if (fallbackEmail && !upsertPayload.email) {
            upsertPayload.email = fallbackEmail;
        }

        const { data: upsertedData, error: upsertError } = await supabase
            .from(tableName)
            .upsert(upsertPayload)
            .select('*')
            .maybeSingle();

        if (upsertError) throw upsertError;
        return normalizeProfile(upsertedData || upsertPayload, fallbackEmail);
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
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
        console.log('Uploading profile image to Supabase Storage...');

        const userId = currentUser.id || currentUser.uid;
        const filename = `${userId}/${Date.now()}.jpg`;
        const publicUrl = await uploadToSupabase(imageUri, 'avatars', filename);

        // Update user profile in Supabase with new photo URL
        await updateUserProfile({ profile_image_url: publicUrl }, currentUser, userType);

        console.log('Profile image uploaded successfully:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('Error uploading profile image:', error);
        throw error;
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
        const { data, error } = await supabase
            .from(userType === 'driver' ? 'drivers' : 'customers')
            .select('profile_image_url')
            .eq('id', userId)
            .maybeSingle();

        if (error && !isNoRowsError(error)) {
            throw error;
        }

        if (data?.profile_image_url) {
            return data.profile_image_url;
        }
        return null;
    } catch (error) {
        console.error('Error getting profile image:', error);
        return null;
    }
};

/**
 * Delete/remove profile image
 * @param {Object} currentUser - Current user object
 * @param {string} userType - 'driver' or 'customer'
 */
export const deleteProfileImage = async (currentUser, userType) => {
    if (!currentUser) return;
    try {
        await updateUserProfile({ profile_image_url: null }, currentUser, userType);
    } catch (error) {
        console.error('Error removing profile image:', error);
    }
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
        let { data: profile } = await supabase
            .from('customers')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (!profile) {
            // If not found, try drivers table
            const { data: driverProfile } = await supabase
                .from('drivers')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

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
        console.error('Error getting user profile:', error);
        throw error;
    }
};

/**
 * Update user rating with weighted average
 * @param {string} userId - User ID to update
 * @param {number} newRating - New rating value (1-5)
 * @param {string} profileType - 'driverProfile' or 'customerProfile'
 */
export const updateUserRating = async (userId, newRating, profileType = 'driverProfile') => {
    try {
        // Fetch current rating stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('rating, rating_count, completed_orders')
            .eq('id', userId)
            .single();

        const currentRating = profile?.rating || 5.0;
        const currentCount = profile?.rating_count || 0;

        // Calculate new average rating
        const totalRatingPoints = currentRating * currentCount;
        const newTotalPoints = totalRatingPoints + newRating;
        const newCount = currentCount + 1;
        const newAverageRating = newTotalPoints / newCount;

        // Prepare updates
        const updates = {
            rating: Math.round(newAverageRating * 100) / 100,
            rating_count: newCount,
            updated_at: new Date().toISOString()
        };

        if (profileType === 'customerProfile') {
            updates.completed_orders = (profile?.completed_orders || 0) + 1;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;

        console.log(`Updated rating: ${currentRating} -> ${updates.rating} (${newCount} ratings)`);

    } catch (error) {
        console.error('Error updating user rating:', error);
    }
};

/**
 * Submit trip rating with optional badges and aggregate updates.
 * @param {Object} ratingData
 * @param {Object} currentUser
 * @returns {Promise<Object>} Result
 */
export const submitTripRating = async (ratingData = {}, currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    const {
        requestId,
        toUserId,
        toUserType = 'driver',
        rating = 5,
        badges = [],
        comment = null,
    } = ratingData;

    if (!requestId) throw new Error('Request ID is required');
    if (!toUserId) throw new Error('Target user is required');

    const sourceUserId = currentUser.uid || currentUser.id;
    const normalizedTargetType = normalizeUserType(toUserType, 'driver');
    const normalizedSourceType = normalizeUserType(
        currentUser?.user_type || currentUser?.userType,
        normalizedTargetType === 'driver' ? 'customer' : 'driver'
    );
    const tableName = PROFILE_TABLE_BY_TYPE[normalizedTargetType];
    const parsedRating = Number(rating);
    const normalizedRating = Math.min(5, Math.max(1, Number.isFinite(parsedRating) ? parsedRating : 5));
    const uniqueBadges = Array.from(
        new Set((Array.isArray(badges) ? badges : []).map((badge) => String(badge).trim()).filter(Boolean))
    );

    const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke(
        'submit-feedback',
        {
            body: {
                requestId,
                rating: normalizedRating,
                driverId: normalizedTargetType === 'driver' ? toUserId : null,
                toUserId,
                toUserType: normalizedTargetType,
                sourceRole: FEEDBACK_ROLE_BY_TYPE[normalizedSourceType],
                badges: uniqueBadges,
                feedback: comment,
            },
        }
    );

    if (!edgeFunctionError) {
        return {
            success: true,
            ...(edgeFunctionData || {}),
        };
    }

    console.warn('submit-feedback edge function failed, falling back to client-side update:', edgeFunctionError);

    const { data: existingFeedbackRows, error: existingFeedbackError } = await supabase
        .from('feedbacks')
        .select('id')
        .eq('request_id', requestId)
        .eq('user_id', sourceUserId)
        .limit(1);

    if (existingFeedbackError) {
        throw existingFeedbackError;
    }

    if (Array.isArray(existingFeedbackRows) && existingFeedbackRows.length > 0) {
        return { success: true, alreadySubmitted: true };
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', toUserId)
        .maybeSingle();

    if (targetProfileError && !isNoRowsError(targetProfileError)) {
        throw targetProfileError;
    }

    const currentRating = Number(targetProfile?.rating) || 5;
    const currentCount = Number(targetProfile?.rating_count) || 0;
    const nextCount = currentCount + 1;
    const nextAverage = Number((((currentRating * currentCount) + normalizedRating) / nextCount).toFixed(2));
    const currentBadgeStats = toBadgeStats(targetProfile?.badge_stats);
    const nextBadgeStats = { ...currentBadgeStats };

    uniqueBadges.forEach((badgeId) => {
        nextBadgeStats[badgeId] = (Number(nextBadgeStats[badgeId]) || 0) + 1;
    });

    const timestamp = new Date().toISOString();
    const fullProfileUpdates = {
        rating: nextAverage,
        rating_count: nextCount,
        badge_stats: nextBadgeStats,
        updated_at: timestamp,
    };

    const { error: fullUpdateError } = await supabase
        .from(tableName)
        .update(fullProfileUpdates)
        .eq('id', toUserId);

    if (fullUpdateError) {
        const optionalColumnMissing =
            hasMissingColumnError(fullUpdateError, 'rating_count') ||
            hasMissingColumnError(fullUpdateError, 'badge_stats');

        if (!optionalColumnMissing) {
            throw fullUpdateError;
        }

        const fallbackUpdates = {
            rating: nextAverage,
            updated_at: timestamp,
        };

        if (!hasMissingColumnError(fullUpdateError, 'rating_count')) {
            fallbackUpdates.rating_count = nextCount;
        }
        if (!hasMissingColumnError(fullUpdateError, 'badge_stats')) {
            fallbackUpdates.badge_stats = nextBadgeStats;
        }

        const { error: fallbackUpdateError } = await supabase
            .from(tableName)
            .update(fallbackUpdates)
            .eq('id', toUserId);

        if (fallbackUpdateError) {
            throw fallbackUpdateError;
        }
    }

    const feedbackPayload = {
        request_id: requestId,
        user_id: sourceUserId,
        driver_id: normalizedTargetType === 'driver' ? toUserId : null,
        rating: normalizedRating,
        tip_amount: 0,
        comment,
        source_role: FEEDBACK_ROLE_BY_TYPE[normalizedSourceType],
        target_role: FEEDBACK_ROLE_BY_TYPE[normalizedTargetType],
        target_user_id: toUserId,
        badges: uniqueBadges,
        created_at: timestamp,
        updated_at: timestamp,
    };

    const { error: feedbackInsertError } = await supabase
        .from('feedbacks')
        .insert(feedbackPayload);

    if (feedbackInsertError) {
        const extendedColumnsMissing =
            hasMissingColumnError(feedbackInsertError, 'source_role') ||
            hasMissingColumnError(feedbackInsertError, 'target_role') ||
            hasMissingColumnError(feedbackInsertError, 'target_user_id') ||
            hasMissingColumnError(feedbackInsertError, 'badges');

        if (!extendedColumnsMissing) {
            throw feedbackInsertError;
        }

        const fallbackFeedbackPayload = {
            request_id: requestId,
            user_id: sourceUserId,
            driver_id: normalizedTargetType === 'driver' ? toUserId : null,
            rating: normalizedRating,
            tip_amount: 0,
            comment:
                comment ||
                (uniqueBadges.length > 0 ? `Badges: ${uniqueBadges.join(', ')}` : null),
            created_at: timestamp,
            updated_at: timestamp,
        };

        const { error: fallbackFeedbackError } = await supabase
            .from('feedbacks')
            .insert(fallbackFeedbackPayload);

        if (fallbackFeedbackError) {
            throw fallbackFeedbackError;
        }
    }

    return {
        success: true,
        rating: nextAverage,
        ratingCount: nextCount,
        badgeStats: nextBadgeStats,
    };
};

/**
 * Save customer feedback/review
 * @param {Object} feedbackData - Feedback details
 * @param {Object} currentUser - Current user object
 * @returns {Promise<string|null>} Feedback ID or null on error
 */
export const saveFeedback = async (feedbackData, currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const { data, error } = await supabase
            .from('feedback')
            .insert({
                request_id: feedbackData.requestId,
                driver_id: feedbackData.driverId,
                customer_id: currentUser.uid || currentUser.id,
                rating: feedbackData.rating,
                comment: feedbackData.comment,
                type: feedbackData.type || 'customer_to_driver',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        console.log('Feedback saved successfully:', data.id);

        // Update driver's rating
        if (feedbackData.type === 'customer_to_driver' && feedbackData.driverId && feedbackData.rating) {
            await updateUserRating(feedbackData.driverId, feedbackData.rating, 'driverProfile');
        }

        return data.id;
    } catch (error) {
        console.error('Error saving feedback:', error);
        return null;
    }
};

/**
 * Get driver feedback/reviews
 * @param {string} driverId - Driver ID
 * @param {number} limit - Max number of reviews to return
 * @returns {Promise<Array>} Array of feedback objects
 */
export const getDriverFeedback = async (driverId, limit = 5) => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching driver feedback:', error);
        return [];
    }
};
