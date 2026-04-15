import { evaluateTripForDriverPreferences, resolveDispatchRequirements } from './DispatchMatchingService';
import {
    hasScheduledTripConflict,
    REQUEST_POOLS,
    isTripOutsideDistanceWindow,
    isTripOutsideSearchLifetime,
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

const round2 = (value) => Math.round(value * 100) / 100;

const firstNonEmptyText = (...candidates) => {
    for (const candidate of candidates) {
        if (typeof candidate !== 'string') {
            continue;
        }

        const trimmed = candidate.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return '';
};

const resolveTripPointAddress = (trip = {}, pointName = 'pickup') => {
    if (pointName === 'dropoff') {
        return firstNonEmptyText(
            trip?.dropoff?.address,
            trip?.dropoff?.formatted_address,
            trip?.dropoff_location?.address,
            trip?.dropoff_location?.formatted_address,
            trip?.dropoffAddress,
            trip?.dropoff_address,
            trip?.originalData?.dropoff?.address,
            trip?.originalData?.dropoff?.formatted_address,
            trip?.originalData?.dropoff_location?.address,
            trip?.originalData?.dropoff_location?.formatted_address,
            trip?.originalData?.dropoffAddress,
            trip?.originalData?.dropoff_address
        );
    }

    return firstNonEmptyText(
        trip?.pickup?.address,
        trip?.pickup?.formatted_address,
        trip?.pickup_location?.address,
        trip?.pickup_location?.formatted_address,
        trip?.pickupAddress,
        trip?.pickup_address,
        trip?.originalData?.pickup?.address,
        trip?.originalData?.pickup?.formatted_address,
        trip?.originalData?.pickup_location?.address,
        trip?.originalData?.pickup_location?.formatted_address,
        trip?.originalData?.pickupAddress,
        trip?.originalData?.pickup_address
    );
};

const resolveDriverPayoutPercent = (pricing = {}) => {
    const configuredPercent = Number(pricing?.driverPayoutPercent);
    if (Number.isFinite(configuredPercent) && configuredPercent >= 0 && configuredPercent <= 1) {
        return configuredPercent;
    }

    return 0.75;
};

const resolveSplitBaseAmount = (pricing = {}) => {
    const directAmount = toAmount(
        pricing?.splitBaseAmount ?? pricing?.fareAfterSurge ?? pricing?.customerSubtotal
    );
    if (directAmount > 0) {
        return round2(directAmount);
    }

    const grossFare = toAmount(pricing?.grossFare);
    const surgeFee = toAmount(pricing?.surgeFee);
    if (grossFare > 0 || surgeFee > 0) {
        return round2(grossFare + surgeFee);
    }

    const totalAmount = toAmount(pricing?.total);
    const insuranceAmount = toAmount(pricing?.mandatoryInsurance);
    const platformShare = toAmount(pricing?.platformShare ?? pricing?.serviceFee);
    const serviceFeeIncludedInTotal = pricing?.serviceFeeIncludedInTotal !== false;

    if (totalAmount > 0) {
        return round2(
            Math.max(
                0,
                totalAmount - insuranceAmount - (serviceFeeIncludedInTotal ? platformShare : 0)
            )
        );
    }

    return 0;
};

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

    const splitBaseAmount = resolveSplitBaseAmount(pricing);
    if (splitBaseAmount > 0) {
        return round2(splitBaseAmount * resolveDriverPayoutPercent(pricing));
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
    let filteredBySearchLifetimeCount = 0;
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
                filteredBySearchLifetimeCount,
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
            isTripOutsideSearchLifetime(normalizedTrip)
        ) {
            filteredBySearchLifetimeCount += 1;
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
            filteredBySearchLifetimeCount,
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
                address: resolveTripPointAddress(trip, 'pickup') || 'Unknown',
                coordinates: trip.pickup?.coordinates || null,
                details: trip.pickup?.details || {},
            },
            dropoff: {
                address: resolveTripPointAddress(trip, 'dropoff') || '',
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
