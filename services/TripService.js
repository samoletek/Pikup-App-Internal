// services/TripService.js
// Extracted from AuthContext.js - Trip/request lifecycle management

import { supabase } from '../config/supabase';
import { uploadToSupabase } from './StorageService';
import { createConversation } from './MessagingService';
import { TRIP_STATUS, normalizeTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';

// Payment service URL
const PAYMENT_SERVICE_URL = process.env.EXPO_PUBLIC_PAYMENT_SERVICE_URL || 'https://api.pikup.app';

const STATUS_TIMESTAMP_FIELDS = Object.freeze({
    [TRIP_STATUS.IN_PROGRESS]: 'in_progress_at',
    [TRIP_STATUS.ARRIVED_AT_PICKUP]: 'arrived_at_pickup_at',
    [TRIP_STATUS.PICKED_UP]: 'picked_up_at',
    [TRIP_STATUS.EN_ROUTE_TO_DROPOFF]: 'en_route_to_dropoff_at',
    [TRIP_STATUS.ARRIVED_AT_DROPOFF]: 'arrived_at_dropoff_at',
    [TRIP_STATUS.COMPLETED]: 'completed_at',
    [TRIP_STATUS.CANCELLED]: 'cancelled_at'
});

/**
 * Create a new pickup request
 * @param {Object} requestData - Request details
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Object>} Created request
 */
export const createPickupRequest = async (requestData, currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        console.log('Creating pickup request in Supabase...');

        const tripData = {
            customer_id: currentUser.uid || currentUser.id,
            pickup_location: requestData.pickup,
            dropoff_location: requestData.dropoff,
            vehicle_type: requestData.vehicle?.type || 'Standard',
            price: parseFloat(requestData.pricing?.total || 0),
            distance_miles: parseFloat(requestData.pricing?.distance || 0),
            items: requestData.items || [],
            scheduled_time: requestData.scheduledTime || null,
            status: TRIP_STATUS.PENDING,
            created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('trips')
            .insert(tripData)
            .select()
            .single();

        if (error) throw error;
        console.log('Trip created successfully:', data.id);

        return mapTripFromDb(data);

    } catch (error) {
        console.error('Error creating pickup request:', error);
        throw error;
    }
};

/**
 * Get user's pickup requests
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Array>} Array of requests
 */
export const getUserPickupRequests = async (currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .or(`customer_id.eq.${currentUser.id},driver_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(mapTripFromDb);

    } catch (error) {
        console.error('Error fetching pickup requests:', error);
        throw error;
    }
};

/**
 * Get available requests for drivers
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Array>} Array of available requests
 */
export const getAvailableRequests = async (currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('status', TRIP_STATUS.PENDING);

        if (error) throw error;

        return data
            .map(mapTripFromDb)
            .map((trip) => ({
                id: trip.id,
                price: `$${Number(trip.pricing?.total || 0).toFixed(2)}`,
                type: 'Moves',
                vehicle: { type: trip.vehicleType || 'Standard' },
                pickup: {
                    address: trip.pickupAddress || 'Unknown',
                    coordinates: trip.pickup?.coordinates || null
                },
                dropoff: {
                    address: trip.dropoffAddress || '',
                    coordinates: trip.dropoff?.coordinates || null
                },
                photos: trip.pickupPhotos || [],
                originalData: trip
            }))
            .sort((a, b) => new Date(b.originalData.createdAt || 0) - new Date(a.originalData.createdAt || 0));

    } catch (error) {
        console.error('Error fetching available requests:', error);
        throw error;
    }
};

/**
 * Accept a pickup request (for drivers)
 * @param {string} requestId - Request ID
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Object>} Updated request
 */
export const acceptRequest = async (requestId, currentUser) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const { data: result, error } = await supabase
            .from('trips')
            .update({
                status: TRIP_STATUS.ACCEPTED,
                driver_id: currentUser.uid || currentUser.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        console.log('Request accepted successfully:', result);

        // Create conversation
        try {
            const customerId = result.customer_id;

            if (customerId) {
                let customerName = 'Customer';
                let driverName = 'Driver';

                const { data: customerProfile } = await supabase.from('customers').select('first_name, last_name, email').eq('id', customerId).single();
                if (customerProfile) {
                    customerName = customerProfile.first_name || customerProfile.email?.split('@')[0] || 'Customer';
                }

                const { data: driverProfile } = await supabase.from('drivers').select('first_name, last_name, email').eq('id', currentUser.uid || currentUser.id).single();
                if (driverProfile) {
                    driverName = driverProfile.first_name || driverProfile.email?.split('@')[0] || 'Driver';
                }

                await createConversation(requestId, customerId, currentUser.uid || currentUser.id, customerName, driverName);
                console.log('Conversation created for request:', requestId);
            }
        } catch (convError) {
            console.error('Error creating conversation:', convError);
        }

        return mapTripFromDb(result);

    } catch (error) {
        console.error('Error accepting request:', error);
        throw error;
    }
};

/**
 * Update request status
 * @param {string} requestId - Request ID
 * @param {string} newStatus - New status
 * @param {Object} additionalData - Additional fields to update
 * @returns {Promise<Object>} Updated request
 */
export const updateRequestStatus = async (requestId, newStatus, additionalData = {}) => {
    try {
        const normalizedStatus = normalizeTripStatus(newStatus);
        const updates = {
            status: normalizedStatus,
            updated_at: new Date().toISOString(),
            ...additionalData
        };

        const { data, error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;
        return mapTripFromDb(data);
    } catch (error) {
        console.error('Error updating request status:', error);
        throw error;
    }
};

/**
 * Update driver status with location
 * @param {string} requestId - Request ID
 * @param {string} status - New status
 * @param {Object} location - Driver location (optional)
 * @param {Object} additionalData - Additional data
 * @returns {Promise<Object>} Updated trip
 */
export const updateDriverStatus = async (requestId, status, location = null, additionalData = {}) => {
    try {
        const normalizedStatus = normalizeTripStatus(status);
        const statusTimestampField = STATUS_TIMESTAMP_FIELDS[normalizedStatus] || `${normalizedStatus}_at`;
        const updates = {
            status: normalizedStatus,
            [statusTimestampField]: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...additionalData
        };
        if (location) {
            updates.driver_location = location;
        }

        const { data, error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;
        return mapTripFromDb(data);
    } catch (error) {
        console.error('Error updating driver status:', error);
        throw error;
    }
};

/**
 * Update driver location for active request
 * @param {string} requestId - Request ID
 * @param {Object} location - Driver location
 * @param {Object} currentUser - Current user object
 */
export const updateDriverLocation = async (requestId, location, currentUser) => {
    if (!currentUser || !requestId || !location) return;

    try {
        const { error } = await supabase
            .from('drivers')
            .update({
                metadata: {
                    lastLocation: location,
                    updatedAt: new Date().toISOString()
                }
            })
            .eq('id', currentUser.uid || currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.warn('Error updating driver location:', error);
    }
};

/**
 * Upload pickup/dropoff photos
 * @param {string} requestId - Request ID
 * @param {Array} photos - Array of photos
 * @param {string} photoType - 'pickup' or 'dropoff'
 * @returns {Promise<Object>} Upload result
 */
export const uploadRequestPhotos = async (requestId, photos, photoType = 'pickup') => {
    if (!photos || photos.length === 0) return null;

    try {
        console.log(`Uploading ${photos.length} ${photoType} photos for request ${requestId}`);

        const uploadedUrls = [];
        const bucket = 'trip_photos';

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            const uri = photo.uri || photo;
            const filename = `${requestId}/${photoType}_${Date.now()}_${i}.jpg`;
            const url = await uploadToSupabase(uri, bucket, filename);
            uploadedUrls.push(url);
        }

        let column = 'pickup_photos';
        if (photoType === 'dropoff' || photoType === 'delivery') column = 'dropoff_photos';

        const { data: trip } = await supabase.from('trips').select(column).eq('id', requestId).single();
        const existing = trip?.[column] || [];
        const newPhotos = [...existing, ...uploadedUrls];

        const { error } = await supabase
            .from('trips')
            .update({
                [column]: newPhotos,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        return { uploadedPhotos: uploadedUrls };
    } catch (error) {
        console.error('Error uploading photos:', error);
        throw error;
    }
};

/**
 * Get specific request by ID
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Request details
 */
export const getRequestById = async (requestId) => {
    try {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', requestId)
            .single();

        if (error) throw error;

        return mapTripFromDb(data);
    } catch (error) {
        console.error('Error fetching request:', error);
        throw error;
    }
};

/**
 * Complete delivery
 * @param {string} requestId - Request ID
 * @param {Object} completionData - Completion data
 * @returns {Promise<Object>} Updated request
 */
export const completeDelivery = async (requestId, completionData = {}) => {
    return updateDriverStatus(requestId, TRIP_STATUS.COMPLETED, null, completionData);
};

/**
 * Finish delivery wrapper
 * @param {string} requestId - Request ID
 * @param {Array} photos - Dropoff photos
 * @param {Object} driverLocation - Driver location
 * @param {number} customerRating - Customer rating
 * @param {Object} currentUser - Current user object
 * @returns {Promise<Object>} Result
 */
export const finishDelivery = async (requestId, photos = [], driverLocation = null, customerRating = null, currentUser) => {
    try {
        if (photos.length > 0) {
            await uploadRequestPhotos(requestId, photos, 'dropoff');
        }

        const request = await getRequestById(requestId);
        const driverEarnings = (request.price || 0) * 0.8;

        await completeDelivery(requestId, {
            completed_by: currentUser?.id
        });

        return { success: true };
    } catch (error) {
        console.error('Error finishing delivery:', error);
        throw error;
    }
};

// Driver status transition helpers
export const startDriving = (requestId, driverLocation) =>
    updateDriverStatus(requestId, TRIP_STATUS.IN_PROGRESS, driverLocation);

export const arriveAtPickup = (requestId, driverLocation) =>
    updateDriverStatus(requestId, TRIP_STATUS.ARRIVED_AT_PICKUP, driverLocation);

export const confirmPickup = async (requestId, photos = [], driverLocation = null) => {
    if (photos.length > 0) await uploadRequestPhotos(requestId, photos, 'pickup');
    return updateDriverStatus(requestId, TRIP_STATUS.PICKED_UP, driverLocation);
};

export const startDelivery = (requestId, driverLocation) =>
    updateDriverStatus(requestId, TRIP_STATUS.EN_ROUTE_TO_DROPOFF, driverLocation);

export const arriveAtDropoff = (requestId, driverLocation) =>
    updateDriverStatus(requestId, TRIP_STATUS.ARRIVED_AT_DROPOFF, driverLocation);

// Timer and request management
export const checkExpiredRequests = async () => {
    try {
        const now = new Date().toISOString();

        const { data: expiredRequests, error } = await supabase
            .from('trips')
            .select('*')
            .eq('status', TRIP_STATUS.PENDING)
            .lt('expires_at', now);

        if (error) throw error;
        if (!expiredRequests) return 0;

        for (const request of expiredRequests) {
            await resetExpiredRequest(request.id);
        }

        return expiredRequests.length;
    } catch (error) {
        console.error('Error checking expired requests:', error);
        return 0;
    }
};

export const resetExpiredRequest = async (requestId) => {
    try {
        const { error } = await supabase
            .from('trips')
            .update({
                status: TRIP_STATUS.PENDING,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;
        console.log(`Reset expired request ${requestId}`);
    } catch (error) {
        console.error('Error resetting expired request:', error);
        throw error;
    }
};

export const extendRequestTimer = async (requestId, additionalMinutes = 2) => {
    try {
        const { data: request, error: fetchError } = await supabase.from('trips').select('expires_at').eq('id', requestId).single();
        if (fetchError) throw fetchError;

        const currentExpiry = new Date(request.expires_at || new Date());
        const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

        const { error } = await supabase.from('trips').update({ expires_at: newExpiry.toISOString() }).eq('id', requestId);
        if (error) throw error;

        return newExpiry.toISOString();
    } catch (error) {
        console.error('Error extending request timer:', error);
        throw error;
    }
};

export const claimRequestForViewing = async (requestId, driverId) => {
    try {
        await supabase.from('trips').update({ viewing_driver_id: driverId, viewed_at: new Date().toISOString() }).eq('id', requestId);
    } catch (error) {
        console.error('Error claiming request for viewing:', error);
        throw error;
    }
};

export const releaseRequestViewing = async (requestId) => {
    try {
        await supabase.from('trips').update({ viewing_driver_id: null }).eq('id', requestId);
    } catch (error) {
        console.error('Error releasing request viewing:', error);
        throw error;
    }
};

// Cancellation functions
export const cancelOrder = async (orderId, reason = 'customer_request', currentUser) => {
    try {
        console.log('Cancelling order:', orderId);

        const orderData = await getRequestById(orderId);

        if (!orderData) throw new Error('Order not found');
        const normalizedOrderStatus = normalizeTripStatus(orderData.status);
        if (normalizedOrderStatus === TRIP_STATUS.COMPLETED || normalizedOrderStatus === TRIP_STATUS.CANCELLED) {
            throw new Error('Order already finalized');
        }

        const payload = {
            orderId,
            customerId: currentUser.uid || currentUser.id,
            reason,
            driverLocation: orderData.driver_location
        };

        const response = await fetch(`${PAYMENT_SERVICE_URL}/cancel-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.warn('Backend cancellation failed, proceeding with Database update if possible.');
        }

        const { error } = await supabase
            .from('trips')
            .update({
                status: TRIP_STATUS.CANCELLED,
                cancelled_at: new Date().toISOString(),
                cancelled_by: currentUser.uid || currentUser.id,
                cancellation_reason: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw error;
        console.log('Order cancelled successfully in Supabase');
        return { success: true };

    } catch (error) {
        console.error('Error cancelling order:', error);
        throw error;
    }
};

export const getCancellationInfo = (orderData) => {
    const status = normalizeTripStatus(orderData.status);
    const orderTotal = orderData.pricing?.total || 0;

    switch (status) {
        case TRIP_STATUS.PENDING:
            return {
                canCancel: true,
                fee: 0,
                reason: 'Free cancellation - no driver assigned yet',
                refundAmount: orderTotal,
                driverCompensation: 0
            };

        case TRIP_STATUS.ACCEPTED:
        case TRIP_STATUS.IN_PROGRESS:
            return {
                canCancel: true,
                fee: 0,
                reason: 'Free cancellation - driver is on the way',
                refundAmount: orderTotal,
                driverCompensation: 0
            };

        case TRIP_STATUS.ARRIVED_AT_PICKUP:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - driver has arrived at pickup location',
                refundAmount: 0,
                driverCompensation: 0
            };

        case TRIP_STATUS.PICKED_UP:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - items have been picked up',
                refundAmount: 0,
                driverCompensation: 0
            };

        case TRIP_STATUS.EN_ROUTE_TO_DROPOFF:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - delivery is in progress',
                refundAmount: 0,
                driverCompensation: 0
            };

        case TRIP_STATUS.COMPLETED:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - order has been completed',
                refundAmount: 0,
                driverCompensation: 0
            };

        case TRIP_STATUS.CANCELLED:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Order is already cancelled',
                refundAmount: 0,
                driverCompensation: 0
            };

        default:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Unknown order status',
                refundAmount: 0,
                driverCompensation: 0
            };
    }
};
