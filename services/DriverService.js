// services/DriverService.js
// Extracted from AuthContext.js - Driver profile, stats, and online/offline management

import { supabase } from '../config/supabase';
import { TRIP_STATUS } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { getPlatformFees } from './PricingService';

// Payment service URL (imported from environment or config)
const PAYMENT_SERVICE_URL = process.env.EXPO_PUBLIC_PAYMENT_SERVICE_URL || 'https://api.pikup.app';
const NETWORK_TIMEOUT_MS = 8000;

const authFetchWithTimeout = async (authFetch, url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await authFetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const getMissingColumnFromError = (error) => {
    const message = String(error?.message || '');
    let match = message.match(/Could not find the '([^']+)' column/i);
    if (match?.[1]) return match[1];

    match = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
    if (match?.[1]) {
        return match[1].split('.').pop();
    }

    return null;
};

const applyDriverColumnUpdateWithFallback = async (driverId, columnUpdates = {}) => {
    const updates = { ...columnUpdates };

    while (Object.keys(updates).length > 0) {
        const { error } = await supabase
            .from('drivers')
            .update(updates)
            .eq('id', driverId);

        if (!error) {
            return true;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
            console.warn(`Drivers table is missing "${missingColumn}". Retrying without it.`);
            delete updates[missingColumn];
            continue;
        }

        throw error;
    }

    return false;
};

const updateDriverMetadata = async (driverId, patch = {}) => {
    const { data: profile } = await supabase
        .from('drivers')
        .select('metadata')
        .eq('id', driverId)
        .maybeSingle();

    const currentMeta = profile?.metadata || {};
    const nextMeta = {
        ...currentMeta,
        ...patch,
    };

    const { error } = await supabase
        .from('drivers')
        .update({ metadata: nextMeta })
        .eq('id', driverId);

    if (error) throw error;
};

const fallbackSetDriverOnline = async (driverId, location) => {
    try {
        const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
            is_online: true,
            current_mode: location.mode || 'SOLO',
            last_location: `POINT(${location.longitude} ${location.latitude})`,
            updated_at: new Date().toISOString()
        });

        if (updatedByColumns) {
            return;
        }
    } catch (error) {
        console.warn('Supabase direct online update failed, using metadata fallback:', error);
    }

    await updateDriverMetadata(driverId, {
        isOnline: true,
        mode: location.mode || 'SOLO',
        lastLocation: location,
        lastSeen: new Date().toISOString()
    });
};

const fallbackSetDriverOffline = async (driverId) => {
    try {
        const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
            is_online: false,
            updated_at: new Date().toISOString()
        });

        if (updatedByColumns) {
            return;
        }
    } catch (error) {
        console.warn('Supabase direct offline update failed, using metadata fallback:', error);
    }

    await updateDriverMetadata(driverId, {
        isOnline: false,
        lastSeen: new Date().toISOString()
    });
};

const fallbackHeartbeat = async (driverId, location) => {
    try {
        const updatedByColumns = await applyDriverColumnUpdateWithFallback(driverId, {
            last_location: `POINT(${location.longitude} ${location.latitude})`,
            updated_at: new Date().toISOString()
        });

        if (updatedByColumns) {
            return;
        }
    } catch (error) {
        console.warn('Supabase direct heartbeat update failed, using metadata fallback:', error);
    }

    await updateDriverMetadata(driverId, {
        lastLocation: location,
        lastSeen: new Date().toISOString()
    });
};

/**
 * Calculate driver earnings from platform config
 * @param {number} totalAmount - Total trip amount
 * @returns {Promise<number>} Driver earnings
 */
export const calculateDriverEarnings = async (totalAmount) => {
    const platformFees = await getPlatformFees();
    const driverPercentage = platformFees.driverPayoutPercent || 0.75;
    const calculatedEarnings = totalAmount * driverPercentage;
    return Math.round(calculatedEarnings * 100) / 100;
};

/**
 * Get driver's completed trips
 * @param {string} driverId - Driver ID
 * @returns {Promise<Array>} Array of trip objects
 */
export const getDriverTrips = async (driverId) => {
    if (!driverId) {
        console.error('Driver ID is required');
        return [];
    }

    try {
        console.log('Fetching trips for driver:', driverId);

        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('driver_id', driverId)
            .eq('status', TRIP_STATUS.COMPLETED)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`Found ${data.length} completed trips for driver`);

        return Promise.all(data.map(async (trip) => {
            const mappedTrip = mapTripFromDb(trip);
            const price = parseFloat(trip.price || 0);
            const driverEarnings = await calculateDriverEarnings(price);
            return { ...mappedTrip, driverEarnings, pricing: { total: price } };
        }));

    } catch (error) {
        console.error('Error getting driver trips:', error);
        return [];
    }
};

/**
 * Get driver statistics
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object>} Driver stats object
 */
export const getDriverStats = async (driverId) => {
    try {
        console.log('Getting driver stats for:', driverId);

        const trips = await getDriverTrips(driverId);

        // Calculate current week (Monday to Sunday)
        const now = new Date();
        const currentDay = now.getDay();
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
        const mondayDate = new Date(now);
        mondayDate.setDate(now.getDate() + mondayOffset);
        mondayDate.setHours(0, 0, 0, 0);

        // Filter this week's trips
        const thisWeekTrips = trips.filter(trip => {
            const tripDate = new Date(trip.created_at);
            return tripDate >= mondayDate;
        });

        // Calculate totals
        const currentWeekTrips = thisWeekTrips.length;
        const weeklyEarnings = thisWeekTrips.reduce((sum, trip) => sum + (trip.driverEarnings || 0), 0);

        const totalTrips = trips.length;
        const totalEarnings = trips.reduce((sum, trip) => sum + (trip.driverEarnings || 0), 0);

        // Get driver profile data
        let driverProfile = {};
        try {
            const { data } = await supabase.from('drivers').select('*').eq('id', driverId).single();
            if (data) {
                driverProfile = { ...data, ...data.metadata };
            }
        } catch (profileError) {
            console.log('No driver profile found, using defaults');
        }

        const stats = {
            currentWeekTrips,
            weeklyEarnings,
            totalTrips,
            totalEarnings,
            availableBalance: driverProfile.availableBalance || totalEarnings,
            rating: driverProfile.rating || 4.9,
            acceptanceRate: driverProfile.acceptanceRate || 98,
            lastTripCompletedAt: trips.length > 0 ? trips[0].created_at : null
        };

        console.log('Driver stats calculated:', stats);
        return stats;

    } catch (error) {
        console.error('Error getting driver stats:', error);
        return {
            currentWeekTrips: 0,
            weeklyEarnings: 0,
            totalTrips: 0,
            totalEarnings: 0,
            availableBalance: 0,
            rating: 4.9,
            acceptanceRate: 98,
            lastTripCompletedAt: null
        };
    }
};

/**
 * Update driver earnings when trip is completed
 * @param {string} driverId - Driver ID
 * @param {Object} tripData - Trip data with pricing
 * @returns {Promise<Object>} Updated driver data
 */
export const updateDriverEarnings = async (driverId, tripData) => {
    try {
        console.log('Updating driver earnings for:', driverId);
        const tripEarnings = tripData.driverEarnings || await calculateDriverEarnings(tripData.pricing?.total || 0);

        // Fetch current profile
        const { data: profile } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .single();

        const currentMeta = profile?.metadata || {};
        const currentEarnings = currentMeta.totalEarnings || 0;
        const currentTrips = currentMeta.totalTrips || 0;

        const newMeta = {
            ...currentMeta,
            totalEarnings: currentEarnings + tripEarnings,
            totalTrips: currentTrips + 1,
            lastTripEarnings: tripEarnings,
            lastTripCompletedAt: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('drivers')
            .update({
                metadata: newMeta,
                completed_orders: (profile?.completed_orders || 0) + 1
            })
            .eq('id', driverId)
            .select()
            .single();

        if (error) throw error;
        return data;

    } catch (error) {
        console.error('Error updating driver earnings:', error);
        throw error;
    }
};

/**
 * Get driver profile by ID
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object|null>} Driver profile or null
 */
export const getDriverProfile = async (driverId) => {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .single();

        if (error) return null;

        const metadata = data?.metadata || {};
        const onboardingComplete =
            data?.onboarding_complete ??
            metadata?.onboardingComplete ??
            false;
        const canReceivePayments =
            data?.can_receive_payments ??
            metadata?.canReceivePayments ??
            false;
        const connectAccountId =
            data?.stripe_account_id ||
            metadata?.connectAccountId ||
            null;
        const documentsVerified =
            metadata?.documentsVerified ??
            false;

        return {
            ...data,
            metadata,
            onboardingComplete,
            canReceivePayments,
            connectAccountId,
            documentsVerified,
            driverProfile: {
                ...metadata,
                onboardingComplete,
                canReceivePayments,
                connectAccountId,
                documentsVerified,
                email: data.email
            }
        };
    } catch (error) {
        console.error('Error getting driver profile:', error);
        return null;
    }
};

/**
 * Set driver online with location
 * @param {string} driverId - Driver ID
 * @param {Object} location - { latitude, longitude }
 * @param {Function} authFetch - Authenticated fetch function
 * @returns {Promise<string>} Session ID
 */
export const setDriverOnline = async (driverId, location, authFetch) => {
    try {
        console.log('Setting driver online:', driverId, 'at location:', location);

        let response = null;
        try {
            response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/online`, {
                method: 'POST',
                body: JSON.stringify({
                    driverId,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    mode: location.mode || 'SOLO'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to set driver online: ${response.statusText}`);
            }
        } catch (networkError) {
            console.warn('Online API unavailable/timeout, falling back to Supabase:', networkError);
            await fallbackSetDriverOnline(driverId, location);
            return `local_session_${Date.now()}`;
        }

        const result = await response.json().catch(() => ({}));
        console.log('Driver set online successfully with session:', result.sessionId);
        return result.sessionId || `remote_session_${Date.now()}`;
    } catch (error) {
        console.error('Error setting driver online:', error);
        throw error;
    }
};

/**
 * Set driver offline
 * @param {string} driverId - Driver ID
 * @param {Function} authFetch - Authenticated fetch function
 * @returns {Promise<boolean>} Success status
 */
export const setDriverOffline = async (driverId, authFetch) => {
    try {
        console.log('Setting driver offline:', driverId);

        let response = null;
        try {
            response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/offline`, {
                method: 'POST',
                body: JSON.stringify({
                    driverId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to set driver offline: ${response.statusText}`);
            }
        } catch (networkError) {
            console.warn('Offline API unavailable/timeout, falling back to Supabase:', networkError);
            await fallbackSetDriverOffline(driverId);
            return true;
        }

        const result = await response.json().catch(() => ({}));
        console.log('Driver set offline successfully. Session duration:', result.onlineMinutes, 'minutes');
        return true;
    } catch (error) {
        console.error('Error setting driver offline:', error);
        throw error;
    }
};

/**
 * Update driver heartbeat (location ping)
 * @param {string} driverId - Driver ID
 * @param {Object} location - { latitude, longitude }
 * @param {Function} authFetch - Authenticated fetch function
 * @returns {Promise<boolean>} Success status
 */
export const updateDriverHeartbeat = async (driverId, location, authFetch) => {
    try {
        let response = null;
        try {
            response = await authFetchWithTimeout(authFetch, `${PAYMENT_SERVICE_URL}/driver/heartbeat`, {
                method: 'POST',
                body: JSON.stringify({
                    driverId,
                    latitude: location.latitude,
                    longitude: location.longitude
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update heartbeat: ${response.statusText}`);
            }
        } catch (networkError) {
            await fallbackHeartbeat(driverId, location);
            return true;
        }

        return true;
    } catch (error) {
        console.error('Error updating driver heartbeat:', error);
        throw error;
    }
};

/**
 * Get online drivers near a location
 * @param {Object} customerLocation - { latitude, longitude }
 * @param {number} radiusMiles - Search radius in miles
 * @param {Function} authFetch - Authenticated fetch function
 * @returns {Promise<Array>} Array of online drivers
 */
export const getOnlineDrivers = async (customerLocation, radiusMiles = 10, authFetch) => {
    try {
        const response = await authFetch(
            `${PAYMENT_SERVICE_URL}/drivers/online?lat=${customerLocation.latitude}&lng=${customerLocation.longitude}&radiusMiles=${radiusMiles}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error(`Failed to get online drivers: ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`Found ${result.count} online drivers within ${radiusMiles} miles`);
        return result.drivers || [];
    } catch (error) {
        console.error('Error getting online drivers:', error);
        throw error;
    }
};

/**
 * Get driver session stats for a specific date
 * @param {string} driverId - Driver ID
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {Function} authFetch - Authenticated fetch function
 * @returns {Promise<Object>} Session stats
 */
export const getDriverSessionStats = async (driverId, date = null, authFetch) => {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const response = await authFetch(
            `${PAYMENT_SERVICE_URL}/drivers/${driverId}/session-stats?date=${targetDate}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            throw new Error(`Failed to get session stats: ${response.statusText}`);
        }

        const result = await response.json();
        return {
            totalOnlineMinutes: result.totalOnlineMinutes || 0,
            tripsCompleted: result.tripsCompleted || 0,
            totalEarnings: result.totalEarnings || 0
        };
    } catch (error) {
        console.error('Error getting driver session stats:', error);
        return { totalOnlineMinutes: 0, tripsCompleted: 0, totalEarnings: 0 };
    }
};
