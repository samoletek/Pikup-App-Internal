// services/TripService.js
// Extracted from AuthContext.js - Trip/request lifecycle management

import { supabase } from '../config/supabase';
import { compressImage, uploadToSupabase } from './StorageService';
import { createConversation } from './MessagingService';
import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import {
    buildDispatchRequirementsFromRequest,
    evaluateTripForDriverPreferences,
    mergeDriverPreferences,
    resolveDispatchRequirements,
} from './DispatchMatchingService';

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

let hasTripExpiresAtColumn = true;
const NETWORK_RETRY_PATTERNS = Object.freeze([
    'network request failed',
    'failed to fetch',
    'network error',
    'load failed'
]);
const TRIP_UPDATE_MAX_RETRIES = 3;
const TRIP_FETCH_MAX_RETRIES = 3;
const STATUS_FLOW = Object.freeze([
    TRIP_STATUS.PENDING,
    TRIP_STATUS.ACCEPTED,
    TRIP_STATUS.IN_PROGRESS,
    TRIP_STATUS.ARRIVED_AT_PICKUP,
    TRIP_STATUS.PICKED_UP,
    TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    TRIP_STATUS.ARRIVED_AT_DROPOFF,
    TRIP_STATUS.COMPLETED
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseEnvNumber = (value, fallback, { min = null, max = null } = {}) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    if (typeof min === 'number' && parsed < min) {
        return fallback;
    }
    if (typeof max === 'number' && parsed > max) {
        return fallback;
    }

    return parsed;
};

const REQUEST_POOLS = Object.freeze({
    ALL: 'all',
    ASAP: 'asap',
    SCHEDULED: 'scheduled',
});
const DRIVER_REQUEST_POOL_FUNCTION = 'get-driver-request-pool';
const MAX_REQUEST_DISTANCE_BY_POOL_MILES = Object.freeze({
    [REQUEST_POOLS.ASAP]: parseEnvNumber(
        process.env.EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_ASAP_MILES,
        15,
        { min: 1, max: 500 }
    ),
    [REQUEST_POOLS.SCHEDULED]: parseEnvNumber(
        process.env.EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES,
        35,
        { min: 1, max: 1000 }
    ),
    [REQUEST_POOLS.ALL]: parseEnvNumber(
        process.env.EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES,
        35,
        { min: 1, max: 1000 }
    ),
});
const SCHEDULED_LOOKAHEAD_HOURS = parseEnvNumber(
    process.env.EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS,
    72,
    { min: 1, max: 24 * 30 }
);
const SCHEDULED_PAST_GRACE_MINUTES = parseEnvNumber(
    process.env.EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES,
    5,
    { min: 0, max: 120 }
);

const normalizeRequestPool = (value) => {
    const pool = String(value || REQUEST_POOLS.ALL).trim().toLowerCase();
    if (pool === REQUEST_POOLS.ASAP) return REQUEST_POOLS.ASAP;
    if (pool === REQUEST_POOLS.SCHEDULED) return REQUEST_POOLS.SCHEDULED;
    return REQUEST_POOLS.ALL;
};

const formatEdgeInvokeError = (error) => {
    if (!error) return 'Unknown edge function error';
    const status = error.status ? `status ${error.status}` : null;
    const message = error.message || error.details || String(error);
    return [status, message].filter(Boolean).join(': ');
};

const getAvailableRequestsFromEdge = async ({ requestPool, driverLocation }) => {
    const payload = { requestPool };
    if (driverLocation) {
        payload.driverLocation = driverLocation;
    }

    const { data, error } = await supabase.functions.invoke(DRIVER_REQUEST_POOL_FUNCTION, {
        body: payload,
    });

    if (error) {
        throw error;
    }

    const requests = Array.isArray(data)
        ? data
        : Array.isArray(data?.requests)
            ? data.requests
            : null;

    if (!Array.isArray(requests)) {
        throw new Error('get-driver-request-pool returned an invalid response shape');
    }

    return requests;
};

const hasValidCoordinatePair = (value) => {
    if (!value) return false;
    const lat = Number(value.latitude);
    const lng = Number(value.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const distanceMilesBetweenPoints = (first, second) => {
    if (!hasValidCoordinatePair(first) || !hasValidCoordinatePair(second)) {
        return Number.POSITIVE_INFINITY;
    }

    const earthRadiusMiles = 3959;
    const lat1 = Number(first.latitude);
    const lng1 = Number(first.longitude);
    const lat2 = Number(second.latitude);
    const lng2 = Number(second.longitude);

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMiles * c;
};

const getPickupCoordinates = (trip) => {
    const coordinates = trip?.pickup?.coordinates;
    if (hasValidCoordinatePair(coordinates)) {
        return {
            latitude: Number(coordinates.latitude),
            longitude: Number(coordinates.longitude),
        };
    }
    return null;
};

const toTimestampOrInfinity = (value) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const getRequestDistanceLimitMiles = (requestPool, scheduleType) => {
    if (requestPool === REQUEST_POOLS.ASAP || requestPool === REQUEST_POOLS.SCHEDULED) {
        return MAX_REQUEST_DISTANCE_BY_POOL_MILES[requestPool];
    }
    return scheduleType === REQUEST_POOLS.SCHEDULED
        ? MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.SCHEDULED]
        : MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP];
};

const isTripOutsideScheduledWindow = (requirements, nowDate = new Date()) => {
    if (requirements?.scheduleType !== REQUEST_POOLS.SCHEDULED) {
        return false;
    }

    const scheduledAtMs = toTimestampOrInfinity(requirements?.scheduledTime);
    if (!Number.isFinite(scheduledAtMs)) {
        return false;
    }

    const nowMs = nowDate.getTime();
    const minAllowedMs = nowMs - SCHEDULED_PAST_GRACE_MINUTES * 60 * 1000;
    const maxAllowedMs = nowMs + SCHEDULED_LOOKAHEAD_HOURS * 60 * 60 * 1000;
    return scheduledAtMs < minAllowedMs || scheduledAtMs > maxAllowedMs;
};

const isTripOutsideDistanceWindow = ({
    trip,
    requirements,
    requestPool,
    driverLocation,
}) => {
    if (!hasValidCoordinatePair(driverLocation)) {
        return false;
    }

    const pickupCoordinates = getPickupCoordinates(trip);
    const distanceMiles = distanceMilesBetweenPoints(driverLocation, pickupCoordinates);
    if (!Number.isFinite(distanceMiles)) {
        return false;
    }

    const maxDistanceMiles = getRequestDistanceLimitMiles(requestPool, requirements?.scheduleType);
    return distanceMiles > maxDistanceMiles;
};

const sortTripsForPool = (trips, { requestPool = REQUEST_POOLS.ALL, driverLocation = null } = {}) => {
    const normalizedPool = normalizeRequestPool(requestPool);
    const sorted = [...trips];

    if (normalizedPool === REQUEST_POOLS.SCHEDULED) {
        sorted.sort((first, second) => {
            const firstTime = toTimestampOrInfinity(
                first?.dispatchRequirements?.scheduledTime || first?.scheduledTime
            );
            const secondTime = toTimestampOrInfinity(
                second?.dispatchRequirements?.scheduledTime || second?.scheduledTime
            );
            if (firstTime !== secondTime) {
                return firstTime - secondTime;
            }

            const firstDistance = distanceMilesBetweenPoints(
                driverLocation,
                getPickupCoordinates(first)
            );
            const secondDistance = distanceMilesBetweenPoints(
                driverLocation,
                getPickupCoordinates(second)
            );
            if (firstDistance !== secondDistance) {
                return firstDistance - secondDistance;
            }

            const firstCreatedAt = new Date(first?.createdAt || 0).getTime();
            const secondCreatedAt = new Date(second?.createdAt || 0).getTime();
            return secondCreatedAt - firstCreatedAt;
        });

        return sorted;
    }

    sorted.sort((first, second) => {
        const firstDistance = distanceMilesBetweenPoints(
            driverLocation,
            getPickupCoordinates(first)
        );
        const secondDistance = distanceMilesBetweenPoints(
            driverLocation,
            getPickupCoordinates(second)
        );
        const firstNormalizedDistance = Number.isFinite(firstDistance)
            ? firstDistance
            : Number.POSITIVE_INFINITY;
        const secondNormalizedDistance = Number.isFinite(secondDistance)
            ? secondDistance
            : Number.POSITIVE_INFINITY;

        if (firstNormalizedDistance !== secondNormalizedDistance) {
            return firstNormalizedDistance - secondNormalizedDistance;
        }

        const firstCreatedAt = new Date(first?.createdAt || 0).getTime();
        const secondCreatedAt = new Date(second?.createdAt || 0).getTime();
        return firstCreatedAt - secondCreatedAt;
    });
    return sorted;
};

const ensureAuthenticatedUserId = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user?.id) {
        return userData.user.id;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshedData?.user?.id) {
            return refreshedData.user.id;
        }
    }

    return null;
};

const isNetworkRequestFailure = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();

    return NETWORK_RETRY_PATTERNS.some((pattern) => message.includes(pattern) || details.includes(pattern));
};

const hasReachedOrPassedStatus = (currentStatus, targetStatus) => {
    const current = normalizeTripStatus(currentStatus);
    const target = normalizeTripStatus(targetStatus);

    if (current === target) {
        return true;
    }

    const currentIndex = STATUS_FLOW.indexOf(current);
    const targetIndex = STATUS_FLOW.indexOf(target);

    if (currentIndex === -1 || targetIndex === -1) {
        return false;
    }

    return currentIndex >= targetIndex;
};

const fetchTripByIdWithRetry = async (requestId, maxAttempts = TRIP_FETCH_MAX_RETRIES) => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (!error) {
            return { data, error: null };
        }

        lastError = error;
        if (attempt < maxAttempts && isNetworkRequestFailure(error)) {
            await sleep(250 * attempt);
            continue;
        }

        return { data: null, error };
    }

    return { data: null, error: lastError };
};

const isMissingColumnError = (error, columnName) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const target = String(columnName || '').toLowerCase();

    return (
        (message.includes('does not exist') || details.includes('does not exist')) &&
        (message.includes(target) || details.includes(target))
    );
};

const isTripStatusConstraintError = (error) => {
    if (error?.code !== '23514') return false;
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    return message.includes('trips_status_check') || details.includes('trips_status_check');
};

const getAlternateTripStatusFormat = (status) => {
    if (typeof status !== 'string' || !status.trim()) return null;

    const normalizedStatus = normalizeTripStatus(status);
    const dbStatus = toDbTripStatus(normalizedStatus);

    // If we already send DB-format status, fallback to app-normalized format.
    if (status === dbStatus) {
        return normalizedStatus;
    }

    // If we send app format, fallback to DB-format status.
    if (status === normalizedStatus) {
        return dbStatus;
    }

    // Best effort fallback for unknown variants.
    return status.includes('_') ? normalizedStatus : dbStatus;
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

const isMissingRpcFunctionError = (error, functionName) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const target = String(functionName || '').toLowerCase();

    return (
        error?.code === 'PGRST202' ||
        message.includes('could not find the function') ||
        details.includes('could not find the function') ||
        (target && (message.includes(target) || details.includes(target)))
    );
};

const REQUEST_UNAVAILABLE_ERROR_CODE = 'REQUEST_UNAVAILABLE';

const createRequestUnavailableError = (message = 'Request is no longer available') => {
    const error = new Error(message);
    error.code = REQUEST_UNAVAILABLE_ERROR_CODE;
    return error;
};

const applyTripUpdateWithColumnFallback = async (requestId, rawUpdates = {}) => {
    const updates = { ...rawUpdates };
    const attemptedStatuses = new Set();
    let networkAttempts = 0;

    while (Object.keys(updates).length > 0) {
        if (typeof updates.status === 'string' && updates.status) {
            attemptedStatuses.add(updates.status);
        }

        const { error } = await supabase
            .from('trips')
            .update(updates)
            .eq('id', requestId);

        if (!error) {
            return updates;
        }

        if (isNetworkRequestFailure(error) && networkAttempts < TRIP_UPDATE_MAX_RETRIES - 1) {
            networkAttempts += 1;
            console.warn(
                `Retrying trip update (${networkAttempts}/${TRIP_UPDATE_MAX_RETRIES}) for request ${requestId}:`,
                error?.message || error
            );
            await sleep(300 * networkAttempts);
            continue;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
            console.warn(`Trips table is missing "${missingColumn}". Retrying without it.`);
            delete updates[missingColumn];
            continue;
        }

        if (isTripStatusConstraintError(error) && typeof updates.status === 'string') {
            const alternateStatus = getAlternateTripStatusFormat(updates.status);
            if (alternateStatus && !attemptedStatuses.has(alternateStatus)) {
                console.warn(
                    `Trips status constraint rejected "${updates.status}". Retrying with "${alternateStatus}".`
                );
                updates.status = alternateStatus;
                continue;
            }
        }

        throw error;
    }

    return {};
};

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

        const pricingData = requestData.pricing || null;
        const createdAt = new Date().toISOString();
        const dispatchRequirements = buildDispatchRequirementsFromRequest({
            ...requestData,
            createdAt,
        });

        const tripData = {
            customer_id: currentUser.uid || currentUser.id,
            pickup_location: {
                ...requestData.pickup,
                details: {
                    ...(requestData.pickupDetails || {}),
                    dispatchRequirements,
                },
                pricing: pricingData,
                dispatchRequirements,
            },
            dropoff_location: {
                ...requestData.dropoff,
                details: requestData.dropoffDetails || {},
            },
            vehicle_type: requestData.vehicle?.type || 'Standard',
            price: parseFloat(requestData.pricing?.total || 0),
            distance_miles: parseFloat(requestData.pricing?.distance || 0),
            items: requestData.items || [],
            scheduled_time: requestData.scheduledTime || null,
            status: toDbTripStatus(TRIP_STATUS.PENDING),
            created_at: createdAt,
            // Insurance fields (nullable — only set when insured items exist)
            insurance_quote_id: requestData.insurance?.quoteId || null,
            insurance_booking_id: requestData.insurance?.bookingId || null,
            insurance_premium: requestData.insurance?.premium != null
                ? parseFloat(requestData.insurance.premium)
                : null,
            insurance_status: requestData.insurance?.status || null,
        };

        // Only include insurance fields when data exists (avoids column-missing errors on unmigrated DB)
        if (requestData.insurance) {
            tripData.insurance_quote_id = requestData.insurance.quoteId || null;
            tripData.insurance_booking_id = requestData.insurance.bookingId || null;
            tripData.insurance_premium = requestData.insurance.premium != null
                ? parseFloat(requestData.insurance.premium)
                : null;
            tripData.insurance_status = requestData.insurance.status || null;
        }

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
 * @param {Object} options - Request feed options
 * @returns {Promise<Array>} Array of available requests
 */
export const getAvailableRequests = async (currentUser, options = {}) => {
    if (!currentUser) throw new Error('User not authenticated');

    try {
        const requestPool = normalizeRequestPool(options?.requestPool);
        const driverLocation = hasValidCoordinatePair(options?.driverLocation)
            ? {
                latitude: Number(options.driverLocation.latitude),
                longitude: Number(options.driverLocation.longitude),
            }
            : null;

        try {
            const edgeRequests = await getAvailableRequestsFromEdge({
                requestPool,
                driverLocation,
            });
            return edgeRequests;
        } catch (edgeError) {
            console.warn(
                'get-driver-request-pool edge function failed, falling back to client-side filtering:',
                formatEdgeInvokeError(edgeError)
            );
        }

        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('status', toDbTripStatus(TRIP_STATUS.PENDING));

        if (error) throw error;

        const trips = data.map(mapTripFromDb);
        const driverId = currentUser?.uid || currentUser?.id;
        let mergedPreferences = null;

        if (driverId) {
            const { data: driverProfile, error: driverError } = await supabase
                .from('drivers')
                .select('metadata')
                .eq('id', driverId)
                .maybeSingle();

            if (driverError) {
                console.warn('Unable to load driver preferences for request filtering:', driverError);
            } else if (driverProfile?.metadata?.driverPreferences) {
                mergedPreferences = mergeDriverPreferences(driverProfile.metadata.driverPreferences);
            }
        }

        const hiddenReasonCounts = {};
        const filteredTrips = [];
        let filteredByPoolCount = 0;
        let filteredByDistanceCount = 0;
        let filteredByTimeWindowCount = 0;
        let filteredByAssignedDriverCount = 0;
        let filteredByPreferenceCount = 0;

        trips.forEach((trip) => {
            if (trip?.driverId && trip.driverId !== driverId) {
                filteredByAssignedDriverCount += 1;
                return;
            }

            const normalizedRequirements = resolveDispatchRequirements(trip);
            const normalizedTrip = {
                ...trip,
                dispatchRequirements: normalizedRequirements,
            };

            if (
                requestPool === REQUEST_POOLS.SCHEDULED &&
                normalizedRequirements.scheduleType !== REQUEST_POOLS.SCHEDULED
            ) {
                filteredByPoolCount += 1;
                return;
            }
            if (
                requestPool === REQUEST_POOLS.ASAP &&
                normalizedRequirements.scheduleType !== REQUEST_POOLS.ASAP
            ) {
                filteredByPoolCount += 1;
                return;
            }

            if (
                requestPool !== REQUEST_POOLS.SCHEDULED &&
                isTripOutsideScheduledWindow(normalizedRequirements)
            ) {
                filteredByTimeWindowCount += 1;
                return;
            }

            if (
                isTripOutsideDistanceWindow({
                    trip: normalizedTrip,
                    requirements: normalizedRequirements,
                    requestPool,
                    driverLocation,
                })
            ) {
                filteredByDistanceCount += 1;
                return;
            }

            if (!mergedPreferences) {
                filteredTrips.push(normalizedTrip);
                return;
            }

            const evaluation = evaluateTripForDriverPreferences(normalizedTrip, mergedPreferences);
            if (evaluation.eligible) {
                filteredTrips.push({
                    ...normalizedTrip,
                    dispatchRequirements: evaluation.requirements,
                });
                return;
            }

            filteredByPreferenceCount += 1;
            evaluation.hardReasons.forEach((reasonCode) => {
                hiddenReasonCounts[reasonCode] = (hiddenReasonCounts[reasonCode] || 0) + 1;
            });
        });

        if (mergedPreferences && filteredByPreferenceCount > 0) {
            console.log(
                `Filtered out ${filteredByPreferenceCount} requests by driver preferences`,
                hiddenReasonCounts
            );
        }
        if (
            filteredByPoolCount > 0 ||
            filteredByDistanceCount > 0 ||
            filteredByTimeWindowCount > 0 ||
            filteredByAssignedDriverCount > 0
        ) {
            console.log('Filtered requests by dispatch windows', {
                filteredByPoolCount,
                filteredByDistanceCount,
                filteredByTimeWindowCount,
                filteredByAssignedDriverCount,
            });
        }

        const sortedTrips = sortTripsForPool(filteredTrips, {
            requestPool,
            driverLocation,
        });

        // Fetch customer names for all trips
        const customerIds = [...new Set(sortedTrips.map(t => t.customerId).filter(Boolean))];
        let customerMap = {};
        if (customerIds.length > 0) {
            const { data: customers } = await supabase
                .from('customers')
                .select('id, first_name, last_name, email')
                .in('id', customerIds);
            if (customers) {
                customers.forEach(c => {
                    customerMap[c.id] = {
                        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email?.split('@')[0] || 'Customer',
                        email: c.email,
                    };
                });
            }
        }

        return sortedTrips
            .map((trip) => {
                const customer = customerMap[trip.customerId] || {};
                return {
                    id: trip.id,
                    price: `$${Number(trip.pricing?.total || 0).toFixed(2)}`,
                    pricing: trip.pricing || {},
                    type: 'Moves',
                    vehicle: { type: trip.vehicleType || 'Standard' },
                    pickup: {
                        address: trip.pickupAddress || 'Unknown',
                        coordinates: trip.pickup?.coordinates || null,
                        details: trip.pickup?.details || {},
                    },
                    dropoff: {
                        address: trip.dropoffAddress || '',
                        coordinates: trip.dropoff?.coordinates || null,
                        details: trip.dropoff?.details || {},
                    },
                    items: trip.items || [],
                    item: trip.item || null,
                    photos: trip.pickupPhotos || [],
                    scheduledTime: trip.scheduledTime || null,
                    dispatchRequirements: trip.dispatchRequirements || null,
                    customerName: customer.name || 'Customer',
                    customerEmail: customer.email || null,
                    originalData: trip,
                };
            });

    } catch (error) {
        console.error('Error fetching available requests:', error);
        throw error;
    }
};

/**
 * Mark a trip offer as declined for the current driver.
 * The edge function persists decline state so the same trip is not re-offered.
 * @param {string} requestId - Trip/request ID
 * @param {Object} currentUser - Current user object
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Decline result
 */
export const declineRequestOffer = async (requestId, currentUser, options = {}) => {
    if (!currentUser) throw new Error('User not authenticated');

    const normalizedRequestId = String(requestId || '').trim();
    if (!normalizedRequestId) {
        return { success: false, error: 'Request ID is required' };
    }

    const requestPool = normalizeRequestPool(options?.requestPool);

    try {
        const { data, error } = await supabase.functions.invoke(DRIVER_REQUEST_POOL_FUNCTION, {
            body: {
                action: 'decline',
                tripId: normalizedRequestId,
                requestPool,
            },
        });

        if (error) {
            throw new Error(formatEdgeInvokeError(error));
        }

        if (data?.error) {
            throw new Error(String(data.error));
        }

        return {
            success: true,
            ...data,
        };
    } catch (error) {
        console.error('Error declining request offer:', error);
        return {
            success: false,
            error: error?.message || 'Failed to decline request offer',
        };
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
        const driverId = currentUser.uid || currentUser.id;
        const { data: requestSnapshot, error: snapshotError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();

        if (snapshotError) throw snapshotError;
        if (!requestSnapshot) {
            throw createRequestUnavailableError('Request is no longer available');
        }

        const normalizedStatus = normalizeTripStatus(requestSnapshot.status);
        if (normalizedStatus === TRIP_STATUS.ACCEPTED && requestSnapshot.driver_id === driverId) {
            return mapTripFromDb(requestSnapshot);
        }
        if (normalizedStatus !== TRIP_STATUS.PENDING) {
            throw createRequestUnavailableError('Request is no longer pending');
        }

        if (requestSnapshot.driver_id && requestSnapshot.driver_id !== driverId) {
            throw createRequestUnavailableError('Request already accepted by another driver');
        }

        const acceptedAt = new Date().toISOString();
        let acceptedRequest = null;
        let rpcAccepted = false;

        // Primary path: RPC with SECURITY DEFINER to bypass restrictive RLS during accept race.
        const { data: rpcAcceptedRows, error: rpcAcceptError } = await supabase.rpc('accept_trip_request', {
            p_trip_id: requestId,
            p_driver_id: driverId
        });

        if (rpcAcceptError) {
            if (isMissingRpcFunctionError(rpcAcceptError, 'accept_trip_request')) {
                console.warn('accept_trip_request RPC is missing. Falling back to direct trips update.');
            } else {
                throw rpcAcceptError;
            }
        } else {
            rpcAccepted = true;
            if (Array.isArray(rpcAcceptedRows) && rpcAcceptedRows.length > 0) {
                acceptedRequest = rpcAcceptedRows[0];
            }
        }

        if (!acceptedRequest && rpcAccepted) {
            const { data: latestTrip, error: latestTripError } = await supabase
                .from('trips')
                .select('*')
                .eq('id', requestId)
                .maybeSingle();

            if (latestTripError) {
                throw latestTripError;
            }

            if (!latestTrip) {
                throw createRequestUnavailableError('Request is no longer available');
            }

            const latestStatus = normalizeTripStatus(latestTrip.status);
            if (latestStatus === TRIP_STATUS.ACCEPTED && latestTrip.driver_id === driverId) {
                acceptedRequest = latestTrip;
            } else {
                throw createRequestUnavailableError('Request is no longer pending');
            }
        }

        if (!acceptedRequest && !rpcAccepted) {
            const acceptedStatus = toDbTripStatus(TRIP_STATUS.ACCEPTED);
            const updates = {
                status: acceptedStatus,
                driver_id: driverId,
                updated_at: acceptedAt
            };

            const driverMatchOrNull = `driver_id.is.null,driver_id.eq.${driverId}`;
            const { error: updateError } = await supabase
                .from('trips')
                .update(updates)
                .eq('id', requestId)
                .eq('status', toDbTripStatus(TRIP_STATUS.PENDING))
                .or(driverMatchOrNull);

            if (updateError) throw updateError;

            acceptedRequest = {
                ...requestSnapshot,
                ...updates
            };

            const { data: refetchedRequest, error: refetchError } = await supabase
                .from('trips')
                .select('*')
                .eq('id', requestId)
                .maybeSingle();

            if (refetchError) {
                console.warn('Could not re-fetch accepted request after direct update:', refetchError);
            } else if (refetchedRequest) {
                acceptedRequest = refetchedRequest;
            }
        }

        if (
            normalizeTripStatus(acceptedRequest?.status) !== TRIP_STATUS.ACCEPTED ||
            acceptedRequest?.driver_id !== driverId
        ) {
            throw new Error('Request acceptance was not persisted. Please apply the latest Supabase migration and try again.');
        }

        console.log('Request accepted successfully:', requestId);

        // Create conversation
        try {
            const customerId =
                requestSnapshot.customer_id ||
                acceptedRequest?.customer_id ||
                acceptedRequest?.customerId ||
                null;

            if (customerId) {
                let customerName = 'Customer';
                let driverName = 'Driver';

                const { data: customerProfile } = await supabase
                    .from('customers')
                    .select('first_name, last_name, email')
                    .eq('id', customerId)
                    .maybeSingle();
                if (customerProfile) {
                    customerName = customerProfile.first_name || customerProfile.email?.split('@')[0] || 'Customer';
                }

                const { data: driverProfile } = await supabase
                    .from('drivers')
                    .select('first_name, last_name, email')
                    .eq('id', driverId)
                    .maybeSingle();
                if (driverProfile) {
                    driverName = driverProfile.first_name || driverProfile.email?.split('@')[0] || 'Driver';
                }

                await createConversation(requestId, customerId, driverId, customerName, driverName);
                console.log('Conversation created for request:', requestId);
            } else {
                console.warn('Skipping conversation creation: missing customer id for request', requestId);
            }
        } catch (convError) {
            console.error('Error creating conversation:', convError);
        }

        return mapTripFromDb(acceptedRequest);

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
        const requestedUpdates = {
            ...additionalData,
            status: toDbTripStatus(normalizedStatus),
            updated_at: new Date().toISOString(),
        };

        const appliedUpdates = await applyTripUpdateWithColumnFallback(requestId, requestedUpdates);

        const { data, error } = await fetchTripByIdWithRetry(requestId);

        if (error) {
            if (isNetworkRequestFailure(error)) {
                console.warn('Returning optimistic request status after network failure while reloading trip.');
                return mapTripFromDb({
                    id: requestId,
                    ...requestedUpdates,
                    ...appliedUpdates,
                });
            }
            throw error;
        }
        if (!data) {
            return mapTripFromDb({
                id: requestId,
                ...requestedUpdates,
                ...appliedUpdates,
            });
        }
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
    const normalizedStatus = normalizeTripStatus(status);
    const statusTimestampField = STATUS_TIMESTAMP_FIELDS[normalizedStatus] || `${normalizedStatus}_at`;
    const requestedUpdates = {
        ...additionalData,
        status: toDbTripStatus(normalizedStatus),
        [statusTimestampField]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    if (location) {
        requestedUpdates.driver_location = location;
    }

    try {
        const appliedUpdates = await applyTripUpdateWithColumnFallback(requestId, requestedUpdates);

        const { data, error } = await fetchTripByIdWithRetry(requestId);

        if (error) {
            if (isNetworkRequestFailure(error)) {
                console.warn('Returning optimistic driver status after network failure while reloading trip.');
                return mapTripFromDb({
                    id: requestId,
                    ...requestedUpdates,
                    ...appliedUpdates,
                });
            }
            throw error;
        }
        if (!data) {
            return mapTripFromDb({
                id: requestId,
                ...requestedUpdates,
                ...appliedUpdates,
            });
        }
        return mapTripFromDb(data);
    } catch (error) {
        if (isNetworkRequestFailure(error)) {
            const { data: latestTrip, error: latestError } = await fetchTripByIdWithRetry(requestId);
            if (!latestError && latestTrip && hasReachedOrPassedStatus(latestTrip.status, normalizedStatus)) {
                console.warn(
                    `Driver status ${normalizedStatus} appears persisted despite transient network failure for request ${requestId}.`
                );
                return mapTripFromDb(latestTrip);
            }
        }

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
        const authUserId = await ensureAuthenticatedUserId();
        if (!authUserId) {
            throw new Error('Session expired. Please sign in again.');
        }

        console.log(`Uploading ${photos.length} ${photoType} photos for request ${requestId}`);

        const uploadedUrls = [];
        const bucket = 'trip_photos';

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            const uri = photo.uri || photo;
            const compressedUri = await compressImage(uri);
            const filename = `${authUserId}/${requestId}/${photoType}_${Date.now()}_${i}.jpg`;
            const url = await uploadToSupabase(compressedUri, bucket, filename);
            uploadedUrls.push(url);
        }

        let column = 'pickup_photos';
        if (photoType === 'dropoff' || photoType === 'delivery') column = 'dropoff_photos';

        let existing = [];
        let canPersistToTrip = true;

        const { data: trip, error: selectError } = await supabase
            .from('trips')
            .select(column)
            .eq('id', requestId)
            .single();

        if (selectError) {
            const missingColumn = getMissingColumnFromError(selectError);
            if (missingColumn === column) {
                canPersistToTrip = false;
                console.warn(`Trips table is missing "${column}". Skipping photo URL persistence.`);
            } else {
                throw selectError;
            }
        } else {
            existing = trip?.[column] || [];
        }

        if (canPersistToTrip) {
            const newPhotos = [...existing, ...uploadedUrls];
            const { error: updateError } = await supabase
                .from('trips')
                .update({
                    [column]: newPhotos,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) {
                const missingColumn = getMissingColumnFromError(updateError);
                if (missingColumn === column) {
                    canPersistToTrip = false;
                    console.warn(`Trips table is missing "${column}" during update. Uploaded files were kept in storage.`);
                } else {
                    throw updateError;
                }
            }
        }

        return {
            uploadedPhotos: uploadedUrls,
            persistedToTrip: canPersistToTrip
        };
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
        const { data, error } = await fetchTripByIdWithRetry(requestId, TRIP_FETCH_MAX_RETRIES);

        if (error) throw error;
        if (!data) {
            throw new Error(`Request ${requestId} not found`);
        }

        return mapTripFromDb(data);
    } catch (error) {
        if (isNetworkRequestFailure(error)) {
            console.warn('Transient network failure while fetching request:', error?.message || error);
        } else {
            console.error('Error fetching request:', error);
        }
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
    if (!hasTripExpiresAtColumn) {
        return 0;
    }

    try {
        const now = new Date().toISOString();

        const { data: expiredRequests, error } = await supabase
            .from('trips')
            .select('*')
            .eq('status', toDbTripStatus(TRIP_STATUS.PENDING))
            .lt('expires_at', now);

        if (error) {
            if (isMissingColumnError(error, 'expires_at')) {
                hasTripExpiresAtColumn = false;
                console.warn('Skipping expired request checks: trips.expires_at column is missing.');
                return 0;
            }
            throw error;
        }
        if (!expiredRequests) return 0;

        let resetCount = 0;
        for (const request of expiredRequests) {
            const didReset = await resetExpiredRequest(request.id);
            if (didReset) {
                resetCount += 1;
            }
        }

        return resetCount;
    } catch (error) {
        console.error('Error checking expired requests:', error);
        return 0;
    }
};

export const resetExpiredRequest = async (requestId) => {
    try {
        const nextExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        const baseUpdates = {
            status: toDbTripStatus(TRIP_STATUS.PENDING),
            updated_at: new Date().toISOString(),
            viewing_driver_id: null,
        };

        let updates = { ...baseUpdates, expires_at: nextExpiry };
        let wasUpdated = false;

        while (Object.keys(updates).length > 0) {
            const { data, error } = await supabase
                .from('trips')
                .update(updates)
                .eq('id', requestId)
                .eq('status', toDbTripStatus(TRIP_STATUS.PENDING))
                .is('driver_id', null)
                .select('id');

            if (!error) {
                wasUpdated = Array.isArray(data) && data.length > 0;
                break;
            }

            const missingColumn = getMissingColumnFromError(error);
            if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
                console.warn(`Trips table is missing "${missingColumn}" during expiry reset. Retrying without it.`);
                delete updates[missingColumn];
                continue;
            }

            throw error;
        }

        if (wasUpdated) {
            console.log(`Reset expired request ${requestId}`);
            return true;
        } else {
            console.log(`Skipped expired reset for ${requestId} (already accepted or unavailable).`);
            return false;
        }
    } catch (error) {
        console.error('Error resetting expired request:', error);
        throw error;
    }
};

export const extendRequestTimer = async (requestId, additionalMinutes = 2) => {
    if (!hasTripExpiresAtColumn) {
        return null;
    }

    try {
        const { data: request, error: fetchError } = await supabase.from('trips').select('expires_at').eq('id', requestId).single();
        if (fetchError) {
            if (isMissingColumnError(fetchError, 'expires_at')) {
                hasTripExpiresAtColumn = false;
                console.warn('Skipping request timer extension: trips.expires_at column is missing.');
                return null;
            }
            throw fetchError;
        }

        const currentExpiry = new Date(request.expires_at || new Date());
        const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

        const { error } = await supabase.from('trips').update({ expires_at: newExpiry.toISOString() }).eq('id', requestId);
        if (error) {
            if (isMissingColumnError(error, 'expires_at')) {
                hasTripExpiresAtColumn = false;
                console.warn('Skipping request timer extension: trips.expires_at column is missing.');
                return null;
            }
            throw error;
        }

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
        const orderData = await getRequestById(orderId);

        if (!orderData) throw new Error('Order not found');
        const normalizedOrderStatus = normalizeTripStatus(orderData.status);
        if (normalizedOrderStatus === TRIP_STATUS.COMPLETED || normalizedOrderStatus === TRIP_STATUS.CANCELLED) {
            throw new Error('Order already finalized');
        }

        const shouldNotifyPaymentBackend = normalizedOrderStatus !== TRIP_STATUS.PENDING;
        const customerId = currentUser?.uid || currentUser?.id || orderData?.customerId || orderData?.customer_id;

        if (shouldNotifyPaymentBackend) {
            const payload = {
                orderId,
                customerId,
                reason,
                driverLocation: orderData.driverLocation || orderData.driver_location || null
            };

            try {
                const response = await fetch(`${PAYMENT_SERVICE_URL}/cancel-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.warn(
                        `Payment backend cancellation returned ${response.status}. Proceeding with Supabase cancellation.`
                    );
                }
            } catch (backendError) {
                console.warn(
                    'Payment backend cancellation request failed. Proceeding with Supabase cancellation.',
                    backendError
                );
            }
        }

        const cancellationUpdates = {
            status: toDbTripStatus(TRIP_STATUS.CANCELLED),
            cancelled_at: new Date().toISOString(),
            cancelled_by: customerId || null,
            cancellation_reason: reason,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('trips')
            .update(cancellationUpdates)
            .eq('id', orderId);

        if (error) throw error;

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
