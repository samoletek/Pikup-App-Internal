import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRICING_CACHE_KEY = '@pikup_pricing_config';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_DRIVER_PAYOUT_PERCENT = 0.75;

const PRICING_2026_DEFAULTS = Object.freeze({
    vehicle_rates: {
        midsize_suv: {
            label: 'Midsize Truck / SUV',
            baseFare: 18.5,
            laborPerMin: 0.75,
            mileageFirst10: 1.65,
            mileageAfter10: 0.85,
        },
        fullsize_pickup: {
            label: 'Full Sized Truck / SUV',
            baseFare: 28.5,
            laborPerMin: 0.95,
            mileageFirst10: 1.9,
            mileageAfter10: 1.0,
        },
        fullsize_truck: {
            label: 'Cargo Van',
            baseFare: 48.5,
            laborPerMin: 1.15,
            mileageFirst10: 2.45,
            mileageAfter10: 1.25,
        },
        cargo_truck: {
            label: 'Box Truck',
            baseFare: 92.5,
            laborPerMin: 1.65,
            mileageFirst10: 3.0,
            mileageAfter10: 1.5,
        },
    },
    surge_config: {
        trafficMultiplierMin: 1.2,
        trafficMultiplierMax: 1.4,
        peakTimeMultiplier: 1.5,
        weatherHazardFee: 7.5,
        // Defaults; can be overridden via pricing_config.
        peakHoursStart: 7,
        peakHoursEnd: 10,
        peakHoursEveningStart: 16,
        peakHoursEveningEnd: 19,
    },
    platform_fees: {
        mileageThreshold: 10,
        serviceFeePercent: 0.25,
        taxRate: 0.25,
        insuranceSpread: 2,
        mandatoryInsurance: 12.99,
        driverPayoutPercent: DEFAULT_DRIVER_PAYOUT_PERCENT,
    },
});

// Vehicle image mapping (local assets)
const VEHICLE_IMAGES = {
    midsize_suv: require('../assets/suv.png'),
    fullsize_pickup: require('../assets/pickup-truck.png'),
    fullsize_truck: require('../assets/truck.png'),
    cargo_truck: require('../assets/cargo-truck.png'),
};

// Vehicle display order
const VEHICLE_ORDER = ['midsize_suv', 'fullsize_pickup', 'fullsize_truck', 'cargo_truck'];
const VEHICLE_RATE_ALIASES = Object.freeze({
    midsize_suv: ['midsize_suv', 'midsize_truck_suv', 'midsize_truck', 'midsize'],
    fullsize_pickup: ['fullsize_pickup', 'fullsize_truck_suv', 'fullsize_suv', 'fullsize'],
    fullsize_truck: ['fullsize_truck', 'cargo_van', 'van'],
    cargo_truck: ['cargo_truck', 'box_truck', 'boxtruck'],
});

const round2 = (n) => Math.round(n * 100) / 100;
const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const deepMerge = (base, override) => {
    if (!base || typeof base !== 'object') {
        return override && typeof override === 'object' ? { ...override } : override;
    }
    if (!override || typeof override !== 'object') {
        return { ...base };
    }

    const merged = { ...base };
    Object.keys(override).forEach((key) => {
        const baseValue = base[key];
        const overrideValue = override[key];

        if (
            baseValue &&
            overrideValue &&
            typeof baseValue === 'object' &&
            typeof overrideValue === 'object' &&
            !Array.isArray(baseValue) &&
            !Array.isArray(overrideValue)
        ) {
            merged[key] = deepMerge(baseValue, overrideValue);
            return;
        }

        merged[key] = overrideValue;
    });

    return merged;
};

const normalizePricingConfig = (rawConfig = {}) =>
    deepMerge(PRICING_2026_DEFAULTS, rawConfig || {});

const getPeakWindowNumber = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24) {
        return fallback;
    }
    return parsed;
};

const resolveTaxRate = (source = {}, fallback = 0.25) => {
    const rateFromTax = toFiniteNumber(source?.taxRate, NaN);
    if (Number.isFinite(rateFromTax) && rateFromTax >= 0) {
        return rateFromTax;
    }

    const rateFromServiceFee = toFiniteNumber(source?.serviceFeePercent, NaN);
    if (Number.isFinite(rateFromServiceFee) && rateFromServiceFee >= 0) {
        return rateFromServiceFee;
    }

    return fallback;
};

const calculateDriverPayoutFromGrossFare = ({
    grossFare,
    mandatoryInsurance,
    taxRate,
    taxAmount,
    insuranceSpread = 0,
    driverPayoutPercent,
}) => {
    const normalizedGrossFare = Math.max(0, toFiniteNumber(grossFare, 0));
    const normalizedInsurance = Math.max(0, toFiniteNumber(mandatoryInsurance, 12.99));
    const normalizedTaxRate = Math.max(0, toFiniteNumber(taxRate, 0.25));
    const explicitTaxAmount = toFiniteNumber(taxAmount, NaN);
    const normalizedInsuranceSpread = Math.max(0, toFiniteNumber(insuranceSpread, 0));
    const normalizedTaxAmount = Number.isFinite(explicitTaxAmount)
        ? Math.max(0, explicitTaxAmount)
        : Math.max(
            0,
            ((normalizedGrossFare - normalizedInsurance) * normalizedTaxRate) + normalizedInsuranceSpread
        );
    const normalizedPayoutPercent = Math.max(
        0,
        toFiniteNumber(driverPayoutPercent, DEFAULT_DRIVER_PAYOUT_PERCENT)
    );
    // Ordered flow from finance: total -> minus taxes -> minus insurance -> apply 25% platform cut.
    const afterTaxAmount = Math.max(0, normalizedGrossFare - normalizedTaxAmount);
    const payoutTaxableFare = Math.max(0, afterTaxAmount - normalizedInsurance);
    const payoutBase = payoutTaxableFare * normalizedPayoutPercent;
    const payout = payoutBase;

    return {
        payout: round2(payout),
        payoutBase: round2(payoutBase),
        payoutTaxableFare: round2(payoutTaxableFare),
        taxAmount: round2(normalizedTaxAmount),
        tipAmount: 0,
    };
};

/**
 * Fetch all pricing config rows from Supabase and cache them.
 */
export const fetchPricingConfig = async () => {
    try {
        const { data, error } = await supabase
            .from('pricing_config')
            .select('id, value');

        if (error) throw error;

        const config = {};
        data.forEach(row => {
            config[row.id] = row.value;
        });
        const normalizedConfig = normalizePricingConfig(config);

        // Cache with timestamp
        await AsyncStorage.setItem(PRICING_CACHE_KEY, JSON.stringify({
            config: normalizedConfig,
            cachedAt: Date.now(),
        }));

        return normalizedConfig;
    } catch (error) {
        console.error('Error fetching pricing config:', error);
        return normalizePricingConfig();
    }
};

/**
 * Get pricing config from cache or fetch from Supabase.
 */
export const getPricingConfig = async () => {
    try {
        const cached = await AsyncStorage.getItem(PRICING_CACHE_KEY);
        if (cached) {
            const { config, cachedAt } = JSON.parse(cached);
            if (Date.now() - cachedAt < CACHE_TTL_MS) {
                return normalizePricingConfig(config);
            }
        }
    } catch (e) {
        // Cache read failed, fetch from server
    }

    try {
        return await fetchPricingConfig();
    } catch (error) {
        return normalizePricingConfig();
    }
};

/**
 * Get vehicle rates as an array sorted for display.
 * Each item includes id, label, capacity, items, image, and rate fields.
 */
export const getVehicleRates = async () => {
    const config = await getPricingConfig();
    const rates = config.vehicle_rates;

    if (!rates) return [];

    const resolveRate = (id) => {
        const aliases = VEHICLE_RATE_ALIASES[id] || [id];
        const key = aliases.find((candidate) => rates[candidate]);
        return key ? rates[key] : null;
    };

    return VEHICLE_ORDER
        .map(id => {
            const rate = resolveRate(id);
            if (!rate) return null;
            return {
                id,
                ...rate,
                type: rate.label,
                image: VEHICLE_IMAGES[id],
            };
        })
        .filter(Boolean);
};

/**
 * Get surge configuration.
 */
export const getSurgeConfig = async () => {
    const config = await getPricingConfig();
    return config.surge_config || {};
};

/**
 * Get platform fees configuration.
 */
export const getPlatformFees = async () => {
    const config = await getPricingConfig();
    return config.platform_fees || {};
};

/**
 * Check if current time is within peak hours.
 */
const isPeakTime = (surgeConfig) => {
    const hour = new Date().getHours();
    const morningStart = getPeakWindowNumber(surgeConfig.peakHoursStart, 7);
    const morningEnd = getPeakWindowNumber(surgeConfig.peakHoursEnd, 10);
    const eveningStart = getPeakWindowNumber(surgeConfig.peakHoursEveningStart, 16);
    const eveningEnd = getPeakWindowNumber(surgeConfig.peakHoursEveningEnd, 19);

    const morningPeak = hour >= morningStart && hour < morningEnd;
    const eveningPeak = hour >= eveningStart && hour < eveningEnd;
    return morningPeak || eveningPeak;
};

/**
 * Estimate labor time in minutes based on order details.
 *
 * @param {Object} laborOptions
 * @param {Array}  laborOptions.items - Order items with weightEstimate
 * @param {Object} laborOptions.pickupDetails - { driverHelpsLoading, hasElevator, floor }
 * @param {Object} laborOptions.dropoffDetails - { driverHelpsUnloading, hasElevator, floor }
 * @returns {{ totalMinutes: number, pickupMinutes: number, dropoffMinutes: number, bufferMinutes: number }}
 */
export const estimateLaborMinutes = (laborOptions = {}) => {
    const { items = [], pickupDetails = {}, dropoffDetails = {} } = laborOptions;

    const needsPickupLabor = pickupDetails.driverHelpsLoading === true;
    const needsDropoffLabor = dropoffDetails.driverHelpsUnloading === true;

    if (!needsPickupLabor && !needsDropoffLabor) {
        return { totalMinutes: 0, pickupMinutes: 0, dropoffMinutes: 0, bufferMinutes: 0 };
    }

    const BASE_PER_ITEM = 5;       // min per item
    const HEAVY_THRESHOLD = 50;     // lbs
    const HEAVY_EXTRA = 3;          // extra min per heavy item
    const STAIRS_PER_FLOOR = 2;     // extra min per floor without elevator
    const BUFFER = 10;              // buffer min

    // Per-item time
    let itemMinutes = 0;
    items.forEach(item => {
        itemMinutes += BASE_PER_ITEM;
        if ((item.weightEstimate || 0) > HEAVY_THRESHOLD) {
            itemMinutes += HEAVY_EXTRA;
        }
    });

    // Stairs penalty per location
    const stairsPenalty = (details) => {
        if (details.hasElevator || details.hasElevator === null) return 0;
        const flights = parseInt(details.numberOfStairs, 10) || 0;
        return flights > 0 ? flights * STAIRS_PER_FLOOR : 0;
    };

    const pickupMinutes = needsPickupLabor ? itemMinutes + stairsPenalty(pickupDetails) : 0;
    const dropoffMinutes = needsDropoffLabor ? itemMinutes + stairsPenalty(dropoffDetails) : 0;
    const bufferMinutes = (pickupMinutes + dropoffMinutes) > 0 ? BUFFER : 0;
    const totalMinutes = pickupMinutes + dropoffMinutes + bufferMinutes;

    return { totalMinutes, pickupMinutes, dropoffMinutes, bufferMinutes };
};

/**
 * Derive driver payout amount from pricing object.
 * Falls back safely for legacy trips that only have total.
 */
export const deriveDriverPayoutAmount = (
    pricing = {},
    fallbackCustomerTotal = 0,
    fallbackPayoutPercent = DEFAULT_DRIVER_PAYOUT_PERCENT
) => {
    const source = pricing && typeof pricing === 'object' ? pricing : {};
    const explicitPayout = toFiniteNumber(source.driverPayout, NaN);

    const driverPayoutPercent = toFiniteNumber(source.driverPayoutPercent, fallbackPayoutPercent);
    const mandatoryInsurance = toFiniteNumber(source.mandatoryInsurance, 12.99);
    const taxRate = resolveTaxRate(source, 0.25);
    const taxAmount = toFiniteNumber(source.taxAmount ?? source.serviceFee, NaN);
    const insuranceSpread = toFiniteNumber(source.insuranceSpread, 2);

    const driverGrossFare = toFiniteNumber(
        source.driverGrossFare ?? source.customerTotal ?? source.total ?? fallbackCustomerTotal,
        NaN
    );
    if (Number.isFinite(driverGrossFare) && driverGrossFare > 0) {
        return calculateDriverPayoutFromGrossFare({
            grossFare: driverGrossFare,
            mandatoryInsurance,
            taxRate,
            taxAmount,
            insuranceSpread,
            driverPayoutPercent,
        }).payout;
    }

    // Legacy fallback: reconstruct customer-side gross from ride fare fields.
    const fareAfterSurge = toFiniteNumber(source.fareAfterSurge, NaN);
    if (Number.isFinite(fareAfterSurge) && fareAfterSurge > 0) {
        const insuranceSpread = toFiniteNumber(source.insuranceSpread, 2);
        const serviceFeePercent = toFiniteNumber(source.serviceFeePercent, 0.25);
        const reconstructedTaxAmount = (fareAfterSurge * serviceFeePercent) + insuranceSpread;
        const customerGrossFromFare = fareAfterSurge + reconstructedTaxAmount + mandatoryInsurance;

        return calculateDriverPayoutFromGrossFare({
            grossFare: customerGrossFromFare,
            mandatoryInsurance,
            taxRate,
            taxAmount: reconstructedTaxAmount,
            driverPayoutPercent,
        }).payout;
    }

    const legacyGrossFare = toFiniteNumber(source.grossFare, NaN);
    const legacySurgeFee = toFiniteNumber(source.surgeFee, 0);
    if (Number.isFinite(legacyGrossFare) && legacyGrossFare > 0) {
        const legacyFareAfterSurge = legacyGrossFare + legacySurgeFee;
        const insuranceSpread = toFiniteNumber(source.insuranceSpread, 2);
        const serviceFeePercent = toFiniteNumber(source.serviceFeePercent, 0.25);
        const reconstructedTaxAmount = (legacyFareAfterSurge * serviceFeePercent) + insuranceSpread;
        const customerGrossFromLegacy = legacyFareAfterSurge + reconstructedTaxAmount + mandatoryInsurance;

        return calculateDriverPayoutFromGrossFare({
            grossFare: customerGrossFromLegacy,
            mandatoryInsurance,
            taxRate,
            taxAmount: reconstructedTaxAmount,
            driverPayoutPercent,
        }).payout;
    }

    const customerTotal = toFiniteNumber(source.customerTotal ?? source.total ?? fallbackCustomerTotal, 0);
    if (customerTotal > 0) {
        return calculateDriverPayoutFromGrossFare({
            grossFare: customerTotal,
            mandatoryInsurance,
            taxRate,
            taxAmount,
            insuranceSpread,
            driverPayoutPercent,
        }).payout;
    }

    if (Number.isFinite(explicitPayout) && explicitPayout > 0) {
        return round2(explicitPayout);
    }

    return 0;
};

/**
 * Recalculate pricing when labor minutes are adjusted from the review step.
 */
export const applyLaborAdjustment = (pricing = {}, laborMinutes) => {
    if (!pricing || typeof pricing !== 'object') {
        return pricing;
    }

    const normalizedLaborMinutes = Math.max(0, toFiniteNumber(laborMinutes, 0));
    const laborBufferMinutes = toFiniteNumber(pricing.laborBufferMinutes, 0);
    const laborPerMin = toFiniteNumber(pricing.laborPerMin, 0);
    const billableMinutes = Math.max(0, normalizedLaborMinutes - laborBufferMinutes);
    const nextLaborFee = round2(billableMinutes * laborPerMin);

    const baseFare = toFiniteNumber(pricing.baseFare, 0);
    const mileageFee = toFiniteNumber(pricing.mileageFee, 0);
    const peakMultiplier = Math.max(1, toFiniteNumber(pricing.peakMultiplier, 1));
    const trafficMultiplier = Math.max(1, toFiniteNumber(pricing.trafficMultiplier, 1));
    const weatherFee = Math.max(0, toFiniteNumber(pricing.weatherFee, 0));
    const peakSurcharge = baseFare * Math.max(0, peakMultiplier - 1);
    const trafficSurcharge = baseFare * Math.max(0, trafficMultiplier - 1);
    const surgeFee = peakSurcharge + trafficSurcharge + weatherFee;

    const baseTripFare = baseFare + mileageFee + nextLaborFee;
    const fareAfterSurge = baseTripFare + surgeFee;

    const serviceFeePercent = toFiniteNumber(pricing.serviceFeePercent, 0.25);
    const taxRate = resolveTaxRate(pricing, serviceFeePercent);
    const insuranceSpread = toFiniteNumber(pricing.insuranceSpread, 2);
    const mandatoryInsurance = toFiniteNumber(pricing.mandatoryInsurance, 12.99);
    const driverPayoutPercent = toFiniteNumber(pricing.driverPayoutPercent, DEFAULT_DRIVER_PAYOUT_PERCENT);

    const taxAmount = (fareAfterSurge * taxRate) + insuranceSpread;
    const serviceFee = taxAmount;
    const customerTotal = fareAfterSurge + taxAmount + mandatoryInsurance;
    const payoutDetails = calculateDriverPayoutFromGrossFare({
        grossFare: customerTotal,
        mandatoryInsurance,
        taxRate,
        taxAmount,
        driverPayoutPercent,
    });

    const baseSurgeMultiplier = baseFare > 0
        ? 1 + ((peakSurcharge + trafficSurcharge) / baseFare)
        : 1;

    return {
        ...pricing,
        laborFee: nextLaborFee,
        laborMinutes: normalizedLaborMinutes,
        laborBillableMinutes: billableMinutes,
        grossFare: round2(baseTripFare),
        baseTripFare: round2(baseTripFare),
        peakSurcharge: round2(peakSurcharge),
        trafficSurcharge: round2(trafficSurcharge),
        surgeFee: round2(surgeFee),
        surgeMultiplier: round2(baseSurgeMultiplier),
        fareAfterSurge: round2(fareAfterSurge),
        serviceFeePercent: round2(serviceFeePercent),
        taxRate: round2(taxRate),
        taxAmount: round2(taxAmount),
        serviceFee: round2(serviceFee),
        total: round2(customerTotal),
        customerTotal: round2(customerTotal),
        customerPrice: round2(customerTotal),
        driverGrossFare: round2(customerTotal),
        driverTaxAmount: payoutDetails.taxAmount,
        tipAmount: payoutDetails.tipAmount,
        driverPayout: payoutDetails.payout,
    };
};

/**
 * Full pricing calculation.
 *
 * @param {Object} vehicleRate - Vehicle rate object from getVehicleRates()
 * @param {number} distance - Distance in miles
 * @param {number} duration - Duration in minutes (route time, not used for labor)
 * @param {Object} options - { isTraffic, isWeather, laborOptions }
 * @returns {Object} Full pricing breakdown
 */
export const calculatePrice = async (vehicleRate, distance, duration, options = {}) => {
    const config = await getPricingConfig();
    const surgeConfig = config.surge_config || {};
    const platformFees = config.platform_fees || {};

    const dist = toFiniteNumber(distance, 0);
    const threshold = platformFees.mileageThreshold || 10;

    // Tiered mileage
    const first10Miles = Math.min(dist, threshold);
    const after10Miles = Math.max(0, dist - threshold);
    const mileageFee = (first10Miles * vehicleRate.mileageFirst10) + (after10Miles * vehicleRate.mileageAfter10);

    // Labor time — based on items & location details, not route duration
    const labor = options.laborOptions
        ? estimateLaborMinutes(options.laborOptions)
        : { totalMinutes: 0, pickupMinutes: 0, dropoffMinutes: 0, bufferMinutes: 0 };
    const billableMinutes = Math.max(0, labor.totalMinutes - labor.bufferMinutes);
    const laborPerMin = toFiniteNumber(vehicleRate?.laborPerMin, 0);
    const laborFee = billableMinutes * laborPerMin;

    // Base ride fare (base + mileage + labor)
    const baseFare = toFiniteNumber(vehicleRate?.baseFare, 0);
    const baseTripFare = baseFare + mileageFee + laborFee;

    // Surge multipliers
    const rawPeakMultiplier = toFiniteNumber(
        options.peakMultiplier,
        toFiniteNumber(surgeConfig.peakTimeMultiplier, 1.5)
    );
    const peakActive =
        options.isPeakTime === true ||
        (options.isPeakTime !== false && isPeakTime(surgeConfig));
    const peakMultiplier = peakActive ? Math.max(1, rawPeakMultiplier) : 1;

    const trafficMin = toFiniteNumber(surgeConfig.trafficMultiplierMin, 1.2);
    const trafficMax = Math.max(trafficMin, toFiniteNumber(surgeConfig.trafficMultiplierMax, 1.4));
    const configuredTrafficMultiplier = toFiniteNumber(
        options.trafficMultiplier,
        toFiniteNumber(surgeConfig.trafficMultiplier, trafficMin)
    );
    const clampedTrafficMultiplier = clamp(configuredTrafficMultiplier, trafficMin, trafficMax);
    const trafficMultiplier = options.isTraffic ? Math.max(1, clampedTrafficMultiplier) : 1;

    const weatherFee = options.isWeather
        ? toFiniteNumber(surgeConfig.weatherHazardFee, 7.5)
        : 0;
    const peakSurcharge = baseFare * Math.max(0, peakMultiplier - 1);
    const trafficSurcharge = baseFare * Math.max(0, trafficMultiplier - 1);
    const surgeFee = peakSurcharge + trafficSurcharge + weatherFee;
    const fareAfterSurge = baseTripFare + surgeFee;
    const surgeMultiplier = baseFare > 0
        ? 1 + ((peakSurcharge + trafficSurcharge) / baseFare)
        : 1;

    const surgeLabels = [];
    if (peakMultiplier > 1) surgeLabels.push('Peak Time');
    if (trafficMultiplier > 1) surgeLabels.push('Traffic');
    if (weatherFee > 0) surgeLabels.push('Weather');
    const surgeLabel = surgeLabels.length > 0 ? surgeLabels.join(' + ') : null;

    // Platform fees
    const serviceFeePercent = toFiniteNumber(platformFees.serviceFeePercent, 0.25);
    const taxRate = resolveTaxRate(platformFees, serviceFeePercent);
    const insuranceSpread = toFiniteNumber(platformFees.insuranceSpread, 2);
    const mandatoryInsurance = toFiniteNumber(platformFees.mandatoryInsurance, 12.99);

    const taxAmount = (fareAfterSurge * taxRate) + insuranceSpread;
    const serviceFee = taxAmount;

    // Customer total
    const customerTotal = fareAfterSurge + taxAmount + mandatoryInsurance;

    // Driver payout
    const driverPayoutPercent = toFiniteNumber(
        platformFees.driverPayoutPercent,
        DEFAULT_DRIVER_PAYOUT_PERCENT
    );
    const payoutDetails = calculateDriverPayoutFromGrossFare({
        grossFare: customerTotal,
        mandatoryInsurance,
        taxRate,
        taxAmount,
        driverPayoutPercent,
    });

    return {
        baseFare: round2(baseFare),
        mileageFee: round2(mileageFee),
        laborFee: round2(laborFee),
        laborMinutes: labor.totalMinutes,
        laborBillableMinutes: billableMinutes,
        laborPickupMinutes: labor.pickupMinutes,
        laborDropoffMinutes: labor.dropoffMinutes,
        laborBufferMinutes: labor.bufferMinutes,
        laborPerMin,
        grossFare: round2(baseTripFare),
        baseTripFare: round2(baseTripFare),
        fareAfterSurge: round2(fareAfterSurge),
        surgeFee: round2(surgeFee),
        peakSurcharge: round2(peakSurcharge),
        trafficSurcharge: round2(trafficSurcharge),
        surgeMultiplier: round2(surgeMultiplier),
        peakMultiplier: round2(peakMultiplier),
        trafficMultiplier: round2(trafficMultiplier),
        weatherFee: round2(weatherFee),
        surgeLabel,
        serviceFeePercent: round2(serviceFeePercent),
        taxRate: round2(taxRate),
        taxAmount: round2(taxAmount),
        serviceFee: round2(serviceFee),
        mandatoryInsurance: round2(mandatoryInsurance),
        insuranceApplied: mandatoryInsurance > 0,
        insuranceSpread: round2(insuranceSpread),
        total: round2(customerTotal),
        customerTotal: round2(customerTotal),
        customerPrice: round2(customerTotal),
        driverGrossFare: round2(customerTotal),
        driverTaxAmount: payoutDetails.taxAmount,
        tipAmount: payoutDetails.tipAmount,
        driverPayoutPercent: round2(driverPayoutPercent),
        driverPayout: payoutDetails.payout,
        distance: dist,
    };
};

/**
 * Quick estimate for vehicle card display (no surge, no platform fees).
 */
export const calculateEstimate = (vehicleRate, distance, duration) => {
    const dist = toFiniteNumber(distance, 0);
    const dur = toFiniteNumber(duration, 0);
    const threshold = 10;

    const first10 = Math.min(dist, threshold);
    const after10 = Math.max(0, dist - threshold);
    const mileageFee =
        (first10 * toFiniteNumber(vehicleRate?.mileageFirst10, 0)) +
        (after10 * toFiniteNumber(vehicleRate?.mileageAfter10, 0));
    const laborFee = dur * toFiniteNumber(vehicleRate?.laborPerMin, 0);

    return round2(toFiniteNumber(vehicleRate?.baseFare, 0) + mileageFee + laborFee);
};
