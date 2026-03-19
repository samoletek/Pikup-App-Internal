import { evaluateTripForDriverPreferences, resolveDispatchRequirements } from './DispatchMatchingService';
import {
    REQUEST_POOLS,
    isTripOutsideDistanceWindow,
    isTripOutsideScheduledWindow,
    sortTripsForPool,
} from './tripDispatchUtils';
import { SUPPORTED_ORDER_STATE_CODES } from '../constants/orderAvailability';
import {
    isSupportedOrderStateCode,
    isTripWithinSupportedStates,
} from '../utils/locationState';

export const filterTripsForAvailability = ({
    trips,
    requestPool,
    driverLocation,
    driverId,
    mergedPreferences,
    driverStateCode = null,
    supportedStateCodes = SUPPORTED_ORDER_STATE_CODES,
}) => {
    const hiddenReasonCounts = {};
    const filteredTrips = [];
    let filteredByPoolCount = 0;
    let filteredByDistanceCount = 0;
    let filteredByTimeWindowCount = 0;
    let filteredByAssignedDriverCount = 0;
    let filteredByPreferenceCount = 0;
    let filteredByStateCount = 0;

    const isDriverStateAllowed = isSupportedOrderStateCode(
        driverStateCode,
        supportedStateCodes
    );

    if (!isDriverStateAllowed) {
        return {
            hiddenReasonCounts,
            stats: {
                filteredByPoolCount,
                filteredByDistanceCount,
                filteredByTimeWindowCount,
                filteredByAssignedDriverCount,
                filteredByPreferenceCount,
                filteredByStateCount: (trips || []).length,
                driverStateRestricted: true,
            },
            sortedTrips: [],
        };
    }

    trips.forEach((trip) => {
        if (trip?.driverId && trip.driverId !== driverId) {
            filteredByAssignedDriverCount += 1;
            return;
        }

        if (!isTripWithinSupportedStates(trip, supportedStateCodes)) {
            filteredByStateCount += 1;
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

    return {
        hiddenReasonCounts,
        stats: {
            filteredByPoolCount,
            filteredByDistanceCount,
            filteredByTimeWindowCount,
            filteredByAssignedDriverCount,
            filteredByPreferenceCount,
            filteredByStateCount,
            driverStateRestricted: false,
        },
        sortedTrips: sortTripsForPool(filteredTrips, {
            requestPool,
            driverLocation,
        }),
    };
};

export const getUniqueCustomerIdsFromTrips = (trips) =>
    [...new Set((trips || []).map((trip) => trip.customerId).filter(Boolean))];

export const buildCustomerMapFromRows = (customers = []) => {
    const customerMap = {};

    customers.forEach((customer) => {
        customerMap[customer.id] = {
            name:
                [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                customer.email?.split('@')[0] ||
                'Customer',
            email: customer.email,
        };
    });

    return customerMap;
};

export const mapAvailableRequestsForDriver = (sortedTrips, customerMap = {}) =>
    sortedTrips.map((trip) => {
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
