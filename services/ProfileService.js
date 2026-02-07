// services/ProfileService.js
// Extracted from AuthContext.js - User profile and feedback management

import { supabase } from '../config/supabase';
import { uploadToSupabase } from './StorageService';

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
        const { data, error } = await supabase
            .from(userType === 'driver' ? 'drivers' : 'customers')
            .update({
                ...updates,
                first_name: updates.firstName,
                last_name: updates.lastName,
                phone_number: updates.phoneNumber
            })
            .eq('id', currentUser.id || currentUser.uid)
            .select()
            .single();

        if (error) throw error;
        return data;
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
            .single();

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
            return {
                uid: userId,
                email: profile.email || fallbackEmail || null,
                profileImageUrl: profile.avatar_url || profile.profile_image_url || null,
                ...profile
            };
        }

        // Fallback if no profile found
        return {
            uid: userId,
            email: fallbackEmail || null,
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
