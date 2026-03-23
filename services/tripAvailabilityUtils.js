import { evaluateTripForDriverPreferences, resolveDispatchRequirements } from './DispatchMatchingService';
import {
    hasScheduledTripConflict,
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
import {
    resolveDisplayFromProfile,
    resolveCustomerDisplayFromRequest,
} from '../utils/profileDisplay';

const toAmount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toMoneyLabel = (value) => `$${toAmount(value).toFixed(2)}`;

const resolveDriverPayoutAmount = (trip = {}) => {
    const pricing = trip?.pricing || {};
    const candidates = [
        trip?.driverPayout,
        trip?.driver_payout,
        trip?.earnings,
        pricing?.driverPayout,
        pricing?.driver_payout,
    ];

    for (const candidate of candidates) {
        const amount = toAmount(candidate);
        if (Number.isFinite(amount) && amount > 0) {
            return amount;
        }
    }

    return toAmount(pricing?.total ?? trip?.price);
};

export const filterTripsForAvailability = ({
    trips,
    requestPool,
    driverLocation,
    driverId,
    driverActiveTrips = [],
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
    let filteredByScheduleConflictCount = 0;
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
                filteredByScheduleConflictCount,
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

        const tripStateCoverage = isTripWithinSupportedStates(trip, supportedStateCodes);
        if (!tripStateCoverage.supported) {
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

        if (
            normalizedRequirements.scheduleType === REQUEST_POOLS.SCHEDULED &&
            hasScheduledTripConflict({
                candidateTrip: normalizedTrip,
                candidateRequirements: normalizedRequirements,
                driverActiveTrips,
            })
        ) {
            filteredByScheduleConflictCount += 1;
            hiddenReasonCounts.blocked_schedule_conflict = (
                hiddenReasonCounts.blocked_schedule_conflict || 0
            ) + 1;
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
            filteredByScheduleConflictCount,
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
        const display = resolveDisplayFromProfile(customer, {
            fallbackName: 'Customer',
            fallbackEmail: customer?.email || null,
        });

        customerMap[customer.id] = {
            id: customer.id,
            name: display.name,
            email: customer.email || null,
            avatarUrl: display.avatarUrl,
            initials: display.initials,
            firstName: customer.first_name || customer.firstName || null,
            lastName: customer.last_name || customer.lastName || null,
        };
    });

    return customerMap;
};

export const mapAvailableRequestsForDriver = (sortedTrips, customerMap = {}) =>
    sortedTrips.map((trip) => {
        const customer = customerMap[trip.customerId] || {};
        const customerDisplay = resolveCustomerDisplayFromRequest(
            {
                customerName: customer.name,
                customerEmail: customer.email,
                customerAvatarUrl: customer.avatarUrl,
                customerFirstName: customer.firstName,
                customerLastName: customer.lastName,
            },
            { fallbackName: 'Customer' }
        );
        const driverPayoutAmount = resolveDriverPayoutAmount(trip);
        const driverPayoutLabel = toMoneyLabel(driverPayoutAmount);
        const customerTotalAmount = toAmount(trip.pricing?.total);
        const customerTotalLabel = toMoneyLabel(customerTotalAmount);

        return {
            id: trip.id,
            // Driver-facing card amount must always be payout, not customer total.
            price: driverPayoutLabel,
            driverPayout: driverPayoutLabel,
            earnings: driverPayoutLabel,
            customerTotal: customerTotalLabel,
            pricing: {
                ...(trip.pricing || {}),
                total: customerTotalAmount,
                driverPayout: driverPayoutAmount,
            },
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
            customerName: customerDisplay.name,
            customerEmail: customer.email || null,
            customerFirstName: customer.firstName || null,
            customerLastName: customer.lastName || null,
            customerAvatarUrl: customerDisplay.avatarUrl,
            customerProfileImageUrl: customerDisplay.avatarUrl,
            customerPhoto: customerDisplay.avatarUrl,
            customerInitials: customerDisplay.initials,
            customer: {
                id: customer.id || trip.customerId || null,
                name: customerDisplay.name,
                first_name: customer.firstName || null,
                last_name: customer.lastName || null,
                email: customer.email || null,
                profileImageUrl: customerDisplay.avatarUrl,
                profile_image_url: customerDisplay.avatarUrl,
                photo: customerDisplay.avatarUrl,
                initials: customerDisplay.initials,
            },
            originalData: trip,
        };
    });
