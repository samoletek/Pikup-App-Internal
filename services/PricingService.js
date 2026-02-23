import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRICING_CACHE_KEY = '@pikup_pricing_config';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Vehicle image mapping (local assets)
const VEHICLE_IMAGES = {
    midsize_suv: require('../assets/suv.png'),
    fullsize_pickup: require('../assets/pickup-truck.png'),
    fullsize_truck: require('../assets/truck.png'),
    cargo_truck: require('../assets/cargo-truck.png'),
};

// Vehicle display order
const VEHICLE_ORDER = ['midsize_suv', 'fullsize_pickup', 'fullsize_truck', 'cargo_truck'];

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

        // Cache with timestamp
        await AsyncStorage.setItem(PRICING_CACHE_KEY, JSON.stringify({
            config,
            cachedAt: Date.now(),
        }));

        return config;
    } catch (error) {
        console.error('Error fetching pricing config:', error);
        throw error;
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
                return config;
            }
        }
    } catch (e) {
        // Cache read failed, fetch from server
    }

    return fetchPricingConfig();
};

/**
 * Get vehicle rates as an array sorted for display.
 * Each item includes id, label, capacity, items, image, and rate fields.
 */
export const getVehicleRates = async () => {
    const config = await getPricingConfig();
    const rates = config.vehicle_rates;

    if (!rates) return [];

    return VEHICLE_ORDER
        .filter(id => rates[id])
        .map(id => ({
            id,
            ...rates[id],
            type: rates[id].label,
            image: VEHICLE_IMAGES[id],
        }));
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
    const morningPeak = hour >= surgeConfig.peakHoursStart && hour < surgeConfig.peakHoursEnd;
    const eveningPeak = hour >= surgeConfig.peakHoursEveningStart && hour < surgeConfig.peakHoursEveningEnd;
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

    const dist = distance || 0;
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
    const laborFee = billableMinutes * vehicleRate.laborPerMin;

    // Gross fare (base + mileage + labor)
    const baseFare = vehicleRate.baseFare;
    let grossFare = baseFare + mileageFee + laborFee;

    // Surge
    let surgeFee = 0;
    let surgeLabel = null;

    if (isPeakTime(surgeConfig)) {
        const peakMultiplier = surgeConfig.peakTimeMultiplier || 1;
        surgeFee = grossFare * (peakMultiplier - 1);
        surgeLabel = 'Peak Time';
    }

    if (options.isTraffic) {
        const trafficMultiplier = surgeConfig.trafficMultiplierMin || 1.2;
        const trafficFee = grossFare * (trafficMultiplier - 1);
        surgeFee += trafficFee;
        surgeLabel = surgeLabel ? `${surgeLabel} + Traffic` : 'Traffic';
    }

    if (options.isWeather) {
        const hazardFee = surgeConfig.weatherHazardFee || 0;
        surgeFee += hazardFee;
        surgeLabel = surgeLabel ? `${surgeLabel} + Weather` : 'Weather';
    }

    const fareAfterSurge = grossFare + surgeFee;

    // Platform fees
    const serviceFeePercent = platformFees.serviceFeePercent || 0.25;
    const insuranceSpread = platformFees.insuranceSpread || 2;
    const mandatoryInsurance = platformFees.mandatoryInsurance || 12.99;

    const serviceFee = (fareAfterSurge * serviceFeePercent) + insuranceSpread;

    // Total
    const total = fareAfterSurge + serviceFee + mandatoryInsurance;

    // Driver payout
    const driverPayoutPercent = platformFees.driverPayoutPercent || 0.75;
    const driverPayout = fareAfterSurge * driverPayoutPercent;

    return {
        baseFare: round2(baseFare),
        mileageFee: round2(mileageFee),
        laborFee: round2(laborFee),
        laborMinutes: labor.totalMinutes,
        laborBillableMinutes: billableMinutes,
        laborPickupMinutes: labor.pickupMinutes,
        laborDropoffMinutes: labor.dropoffMinutes,
        laborBufferMinutes: labor.bufferMinutes,
        laborPerMin: vehicleRate.laborPerMin,
        grossFare: round2(grossFare),
        surgeFee: round2(surgeFee),
        surgeLabel,
        serviceFee: round2(serviceFee),
        mandatoryInsurance: round2(mandatoryInsurance),
        total: round2(total),
        driverPayout: round2(driverPayout),
        distance: dist,
    };
};

/**
 * Quick estimate for vehicle card display (no surge, no platform fees).
 */
export const calculateEstimate = (vehicleRate, distance, duration) => {
    const dist = distance || 0;
    const dur = duration || 0;
    const threshold = 10;

    const first10 = Math.min(dist, threshold);
    const after10 = Math.max(0, dist - threshold);
    const mileageFee = (first10 * vehicleRate.mileageFirst10) + (after10 * vehicleRate.mileageAfter10);
    const laborFee = dur * vehicleRate.laborPerMin;

    return round2(vehicleRate.baseFare + mileageFee + laborFee);
};

const round2 = (n) => Math.round(n * 100) / 100;
