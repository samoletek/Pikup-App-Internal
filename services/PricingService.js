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
 * Full pricing calculation.
 *
 * @param {Object} vehicleRate - Vehicle rate object from getVehicleRates()
 * @param {number} distance - Distance in miles
 * @param {number} duration - Duration in minutes
 * @param {Object} options - { isTraffic, isWeather }
 * @returns {Object} Full pricing breakdown
 */
export const calculatePrice = async (vehicleRate, distance, duration, options = {}) => {
    const config = await getPricingConfig();
    const surgeConfig = config.surge_config || {};
    const platformFees = config.platform_fees || {};

    const dist = distance || 0;
    const dur = duration || 0;
    const threshold = platformFees.mileageThreshold || 10;

    // Tiered mileage
    const first10Miles = Math.min(dist, threshold);
    const after10Miles = Math.max(0, dist - threshold);
    const mileageFee = (first10Miles * vehicleRate.mileageFirst10) + (after10Miles * vehicleRate.mileageAfter10);

    // Labor
    const laborFee = dur * vehicleRate.laborPerMin;

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
        grossFare: round2(grossFare),
        surgeFee: round2(surgeFee),
        surgeLabel,
        serviceFee: round2(serviceFee),
        mandatoryInsurance: round2(mandatoryInsurance),
        total: round2(total),
        driverPayout: round2(driverPayout),
        distance: dist,
        duration: dur,
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
