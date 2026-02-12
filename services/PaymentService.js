// services/PaymentService.js
// Extracted from AuthContext.js - Stripe payments and driver payouts

import { supabase } from '../config/supabase';

const isNoRowsError = (error) => error?.code === 'PGRST116';

/**
 * Create Stripe Connect account for driver (Currently disabled)
 * @param {Object} driverInfo - Driver information
 * @returns {Promise<Object>} Result with success status
 */
export const createDriverConnectAccount = async (driverInfo) => {
    console.warn('MIGRATION: createDriverConnectAccount called. Payments services are currently disabled.');
    return { success: false, error: 'Migration to Supabase in progress. Payments temporarily unavailable.' };
};

/**
 * Get Stripe onboarding link for driver (Currently disabled)
 * @param {string} connectAccountId - Stripe Connect account ID
 * @param {string} refreshUrl - URL for refresh
 * @param {string} returnUrl - URL to return to
 * @returns {Promise<Object>} Result with success status
 */
export const getDriverOnboardingLink = async (connectAccountId, refreshUrl, returnUrl) => {
    console.warn('MIGRATION: getDriverOnboardingLink. Payments disabled.');
    return { success: false, error: 'Migration in progress' };
};

/**
 * Update driver payment profile metadata
 * @param {string} driverId - Driver ID
 * @param {Object} updates - Payment profile updates
 * @returns {Promise<Object>} Updated driver data
 */
export const updateDriverPaymentProfile = async (driverId, updates) => {
    try {
        if (!driverId) {
            throw new Error('Driver ID is required');
        }

        const now = new Date().toISOString();

        // Fetch current profile metadata
        const { data: profile, error: profileError } = await supabase
            .from('drivers')
            .select('id, email, metadata')
            .eq('id', driverId)
            .maybeSingle();

        if (profileError && !isNoRowsError(profileError)) {
            throw profileError;
        }

        const currentMeta = profile?.metadata || {};

        // Merge updates
        const newMeta = { ...currentMeta, ...updates, updatedAt: now };
        const columnUpdates = {
            metadata: newMeta,
            updated_at: now,
        };

        if (Object.prototype.hasOwnProperty.call(updates, 'onboardingComplete')) {
            columnUpdates.onboarding_complete = Boolean(updates.onboardingComplete);
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'canReceivePayments')) {
            columnUpdates.can_receive_payments = Boolean(updates.canReceivePayments);
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'connectAccountId')) {
            columnUpdates.stripe_account_id = updates.connectAccountId || null;
        }

        const { data, error } = await supabase
            .from('drivers')
            .update(columnUpdates)
            .eq('id', driverId)
            .select('*')
            .maybeSingle();

        if (error && !isNoRowsError(error)) throw error;
        if (data) return data;

        if (profile) {
            return {
                ...profile,
                ...columnUpdates,
                id: driverId,
                metadata: newMeta,
            };
        }

        // Fallback: recreate or patch missing profile row for this driver id.
        const { data: authData } = await supabase.auth.getUser();
        const fallbackEmail = profile?.email || authData?.user?.email || null;
        const upsertPayload = {
            id: driverId,
            ...columnUpdates,
        };
        if (fallbackEmail) {
            upsertPayload.email = fallbackEmail;
        }

        const { data: upsertedData, error: upsertError } = await supabase
            .from('drivers')
            .upsert(upsertPayload)
            .select('*')
            .maybeSingle();

        if (upsertError) throw upsertError;
        return upsertedData || upsertPayload;
    } catch (error) {
        console.error('Error updating driver payment profile:', error);
        throw error;
    }
};

/**
 * Check driver Stripe onboarding status (Currently disabled)
 * @param {string} connectAccountId - Stripe Connect account ID
 * @returns {Promise<Object>} Result with success status
 */
export const checkDriverOnboardingStatus = async (connectAccountId) => {
    return { success: false, error: 'Migration in progress' };
};

/**
 * Get driver earnings history (Currently returns empty)
 * @param {string} driverId - Driver ID
 * @param {string} period - Time period ('week', 'month', etc.)
 * @returns {Promise<Object>} Earnings data
 */
export const getDriverEarningsHistory = async (driverId, period = 'week') => {
    return { success: true, earnings: [] };
};

/**
 * Get driver payouts (Currently returns empty)
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object>} Payouts data
 */
export const getDriverPayouts = async (driverId) => {
    return { success: true, payouts: [] };
};

/**
 * Request instant payout (Currently disabled)
 * @param {number} amount - Payout amount
 * @returns {Promise<Object>} Result with success status
 */
export const requestInstantPayout = async (amount) => {
    return { success: false, error: 'Migration in progress' };
};

/**
 * Process trip payout through Edge Function
 * @param {Object} payoutData - Payout details
 * @returns {Promise<Object>} Result with transfer ID
 */
export const processTripPayout = async (payoutData) => {
    try {
        console.log('Invoking process-payout Edge Function...', payoutData);

        const { data, error } = await supabase.functions.invoke('process-payout', {
            body: {
                amount: payoutData.amount,
                currency: 'usd',
                connectAccountId: payoutData.connectAccountId,
                transferGroup: payoutData.tripId,
                driverId: payoutData.driverId,
            }
        });

        if (error) {
            throw error;
        }

        if (!data.success) {
            throw new Error(data.error || 'Payout processing failed');
        }

        console.log('Payout processed successfully:', data.transferId);
        return { success: true, transferId: data.transferId };

    } catch (error) {
        console.error('Error processing trip payout:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create Stripe Identity verification session
 * @param {Object} userData - User data for verification
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Object>} Verification session data
 */
export const createVerificationSession = async (userData, currentUser) => {
    try {
        console.log('Invoking create-verification-session Edge Function...');

        const { data, error } = await supabase.functions.invoke('create-verification-session', {
            body: {
                userId: currentUser.uid || currentUser.id,
                email: currentUser.email,
                ...userData
            }
        });

        if (error) {
            console.error('Edge Function Error:', error);
            throw new Error(error.message || 'Verification session creation failed');
        }

        console.log('Verification session created:', data);
        return data;
    } catch (error) {
        console.error('Error in createVerificationSession:', error);
        throw error;
    }
};
