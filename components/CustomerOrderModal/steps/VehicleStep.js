import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import VehicleCard from '../../order/VehicleCard';
import { getVehicleRates } from '../../../services/PricingService';
import { styles } from '../styles';
import { colors, spacing } from '../../../styles/theme';

const VehicleStep = ({ orderData, setOrderData }) => {
    const [vehicles, setVehicles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedVehicleId, setExpandedVehicleId] = useState(null);

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

    // Auto-expand selected vehicle on mount
    useEffect(() => {
        if (orderData.selectedVehicle?.id) {
            setExpandedVehicleId(orderData.selectedVehicle.id);
        }
    }, []);

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
                    isExpanded={expandedVehicleId === vehicle.id}
                    onSelect={(v) => setOrderData(prev => ({ ...prev, selectedVehicle: v }))}
                    onToggleExpand={() => setExpandedVehicleId(
                        expandedVehicleId === vehicle.id ? null : vehicle.id
                    )}
                    distance={orderData.distance || 10}
                    duration={orderData.duration || 0}
                />
            ))}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default VehicleStep;
