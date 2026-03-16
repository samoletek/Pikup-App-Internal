import { evaluateTripForDriverPreferences, resolveDispatchRequirements } from './DispatchMatchingService';
import {
    REQUEST_POOLS,
    isTripOutsideDistanceWindow,
    isTripOutsideScheduledWindow,
    sortTripsForPool,
} from './tripDispatchUtils';

export const filterTripsForAvailability = ({
    trips,
    requestPool,
    driverLocation,
    driverId,
    mergedPreferences,
}) => {
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

    return {
        hiddenReasonCounts,
        stats: {
            filteredByPoolCount,
            filteredByDistanceCount,
            filteredByTimeWindowCount,
            filteredByAssignedDriverCount,
            filteredByPreferenceCount,
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
