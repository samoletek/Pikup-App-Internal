import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import VehicleCard from '../../order/VehicleCard';
import { getVehicleRates, calculatePrice } from '../../../services/PricingService';
import { styles } from '../styles';
import { colors, spacing } from '../../../styles/theme';

// Fallback weight limits (lbs) if not set in Supabase
const DEFAULT_MAX_WEIGHT = {
    midsize_suv: 400,
    fullsize_pickup: 1500,
    fullsize_truck: 3000,
    cargo_truck: 5000,
};

const VehicleStep = ({ orderData, setOrderData }) => {
    const [vehicles, setVehicles] = useState([]);
    const [prices, setPrices] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);

    // Calculate total weight from AI-analyzed items
    const totalWeight = useMemo(() => {
        if (!orderData.items?.length) return 0;
        return orderData.items.reduce((sum, item) => sum + (item.weightEstimate || 0), 0);
    }, [orderData.items]);

    // Determine AI-recommended vehicle (smallest that fits the total weight)
    const recommendedVehicleId = useMemo(() => {
        if (totalWeight === 0 || vehicles.length === 0) return null;
        const fit = vehicles.find(v => {
            const maxWeight = v.maxWeight || DEFAULT_MAX_WEIGHT[v.id] || Infinity;
            return totalWeight <= maxWeight;
        });
        return fit ? fit.id : vehicles[vehicles.length - 1]?.id;
    }, [totalWeight, vehicles]);

    // Load vehicles
    useEffect(() => {
        const loadVehicles = async () => {
            try {
                const rates = await getVehicleRates();
                setVehicles(rates);
            } catch (error) {
                console.error('Failed to load vehicle rates:', error);
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
                    const result = await calculatePrice(vehicle, dist, dur);
                    priceMap[vehicle.id] = result.total;
                }));

                setPrices(priceMap);
            } catch (error) {
                console.error('Failed to calculate prices:', error);
            } finally {
                setIsLoadingPrices(false);
            }
        };
        loadPrices();
    }, [vehicles, orderData.distance, orderData.duration]);

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
            <Text style={styles.vehicleHint}>Choose the vehicle that fits your items</Text>

            {vehicles.map(vehicle => (
                <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={orderData.selectedVehicle?.id === vehicle.id}
                    isRecommended={vehicle.id === recommendedVehicleId}
                    isLoadingPrice={isLoadingPrices}
                    displayPrice={prices[vehicle.id]}
                    onSelect={(v) => setOrderData(prev => ({ ...prev, selectedVehicle: v }))}
                />
            ))}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default VehicleStep;
