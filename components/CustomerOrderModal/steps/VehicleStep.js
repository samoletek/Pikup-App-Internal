// Vehicle Step component: renders its UI and handles related interactions.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import VehicleCard from '../../order/VehicleCard';
import { getVehicleRates, calculatePrice } from '../../../services/PricingService';
import { logger } from '../../../services/logger';
import { styles } from '../styles';
import { colors, spacing } from '../../../styles/theme';

// Fallback weight limits (lbs) if not set in Supabase
const DEFAULT_MAX_WEIGHT = {
    midsize_suv: 400,
    fullsize_pickup: 1500,
    fullsize_truck: 3000,
    cargo_truck: 5000,
};
const TOO_SMALL_REASON = 'Too small for your items.';
const EMPTY_AI_FIT_BY_VEHICLE = {};

const VehicleStep = ({ orderData, setOrderData }) => {
    const [vehicles, setVehicles] = useState([]);
    const [prices, setPrices] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const aiRecommendation = orderData.aiVehicleRecommendation || {};
    const aiStatus = aiRecommendation.status || 'idle';
    const aiFitByVehicle = aiRecommendation.fitByVehicle || EMPTY_AI_FIT_BY_VEHICLE;

    // Calculate total weight from AI-analyzed items
    const totalWeight = useMemo(() => {
        if (!orderData.items?.length) return 0;
        return orderData.items.reduce((sum, item) => sum + (item.weightEstimate || 0), 0);
    }, [orderData.items]);

    const fitMetaByVehicle = useMemo(() => {
        const meta = {};

        vehicles.forEach(vehicle => {
            const maxWeight = vehicle.maxWeight || DEFAULT_MAX_WEIGHT[vehicle.id] || Infinity;
            const overweight = totalWeight > 0 && Number.isFinite(maxWeight) && totalWeight > maxWeight;
            const aiFit = aiStatus === 'success' ? aiFitByVehicle[vehicle.id] : null;

            if (aiFit && aiFit.fits === false) {
                meta[vehicle.id] = {
                    disabled: true,
                    reason: TOO_SMALL_REASON,
                };
                return;
            }

            if (overweight) {
                meta[vehicle.id] = {
                    disabled: true,
                    reason: TOO_SMALL_REASON,
                };
                return;
            }

            meta[vehicle.id] = {
                disabled: false,
                reason: '',
            };
        });

        return meta;
    }, [vehicles, totalWeight, aiStatus, aiFitByVehicle]);

    // Fallback recommendation (smallest by weight fit)
    const fallbackRecommendedVehicleId = useMemo(() => {
        if (totalWeight === 0 || vehicles.length === 0) return null;
        const fit = vehicles.find(v => {
            const maxWeight = v.maxWeight || DEFAULT_MAX_WEIGHT[v.id] || Infinity;
            return totalWeight <= maxWeight;
        });
        return fit ? fit.id : vehicles[vehicles.length - 1]?.id;
    }, [totalWeight, vehicles]);

    // AI recommendation (if available and valid), otherwise fallback
    const recommendedVehicleId = useMemo(() => {
        const aiRecommended = aiStatus === 'success' ? aiRecommendation.recommendedVehicleId : null;
        if (aiRecommended && !fitMetaByVehicle[aiRecommended]?.disabled) {
            return aiRecommended;
        }
        return fallbackRecommendedVehicleId;
    }, [aiStatus, aiRecommendation.recommendedVehicleId, fitMetaByVehicle, fallbackRecommendedVehicleId]);

    // Auto-expand & auto-select recommended (or first) vehicle once loaded
    useEffect(() => {
        if (vehicles.length === 0) return;

        const firstEnabledVehicle = vehicles.find(v => !fitMetaByVehicle[v.id]?.disabled);
        const selectedVehicleId = orderData.selectedVehicle?.id;
        const selectedVehicleIsValid = selectedVehicleId && !fitMetaByVehicle[selectedVehicleId]?.disabled;
        if (expandedId && selectedVehicleIsValid) return;

        const autoId = [recommendedVehicleId, selectedVehicleId, firstEnabledVehicle?.id, vehicles[0]?.id]
            .find(id => id && !fitMetaByVehicle[id]?.disabled) || firstEnabledVehicle?.id || vehicles[0]?.id;

        if (!autoId) return;

        setExpandedId(autoId);

        // Also auto-select if nothing selected yet (or selected became invalid)
        if (!orderData.selectedVehicle || fitMetaByVehicle[selectedVehicleId]?.disabled) {
            const v = vehicles.find(v => v.id === autoId);
            if (v) {
                setOrderData(prev => ({ ...prev, selectedVehicle: v }));
            }
        }
    }, [vehicles, recommendedVehicleId, expandedId, orderData.selectedVehicle, fitMetaByVehicle, setOrderData]);

    // Load vehicles
    useEffect(() => {
        const loadVehicles = async () => {
            try {
                const rates = await getVehicleRates();
                setVehicles(rates);
            } catch (error) {
                logger.error('VehicleStep', 'Failed to load vehicle rates', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadVehicles();
    }, []);

    // Calculate full prices for all vehicles
    useEffect(() => {
        if (vehicles.length === 0) return;

        const loadPrices = async () => {
            setIsLoadingPrices(true);
            try {
                const dist = orderData.distance || 10;
                const dur = orderData.duration || 0;
                const priceMap = {};

                await Promise.all(vehicles.map(async (vehicle) => {
                    const result = await calculatePrice(vehicle, dist, dur, {
                        pickup: orderData.pickup || null,
                        dropoff: orderData.dropoff || null,
                        items: orderData.items || [],
                        laborOptions: {
                            items: orderData.items || [],
                            pickupDetails: orderData.pickupDetails || {},
                            dropoffDetails: orderData.dropoffDetails || {},
                        },
                    });
                    priceMap[vehicle.id] = result.total;
                }));

                setPrices(priceMap);
            } catch (error) {
                logger.error('VehicleStep', 'Failed to calculate prices', error);
            } finally {
                setIsLoadingPrices(false);
            }
        };
        loadPrices();
    }, [
        vehicles,
        orderData.distance,
        orderData.duration,
        orderData.pickup,
        orderData.dropoff,
        orderData.items,
        orderData.pickupDetails,
        orderData.dropoffDetails,
    ]);

    const handleToggleExpand = (vehicleId) => {
        if (fitMetaByVehicle[vehicleId]?.disabled) return;
        setExpandedId(prev => prev === vehicleId ? null : vehicleId);
    };

    if (isLoading) {
        return (
            <View style={[styles.stepContent, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.text.muted, marginTop: spacing.md }}>Loading vehicles...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.vehicleHint}>
                {aiStatus === 'loading'
                    ? 'Analyzing your items for best vehicle fit...'
                    : aiStatus === 'success'
                        ? 'AI recommendation ready. Vehicles that will not fit are disabled.'
                        : aiStatus === 'error'
                            ? 'AI recommendation unavailable. Showing best estimate.'
                            : 'Choose the vehicle that fits your items'}
            </Text>

            {vehicles.map(vehicle => (
                <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={orderData.selectedVehicle?.id === vehicle.id}
                    isExpanded={expandedId === vehicle.id}
                    isRecommended={vehicle.id === recommendedVehicleId}
                    isDisabled={!!fitMetaByVehicle[vehicle.id]?.disabled}
                    disabledReason={fitMetaByVehicle[vehicle.id]?.reason || ''}
                    isLoadingPrice={isLoadingPrices}
                    displayPrice={prices[vehicle.id]}
                    onSelect={(v) => setOrderData(prev => ({
                        ...prev,
                        selectedVehicle: prev.selectedVehicle?.id === v.id ? null : v,
                    }))}
                    onToggleExpand={() => handleToggleExpand(vehicle.id)}
                />
            ))}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default VehicleStep;
