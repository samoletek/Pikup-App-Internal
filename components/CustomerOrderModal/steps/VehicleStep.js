import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VehicleCard, { VEHICLES } from '../../order/VehicleCard';
import { styles } from '../styles';

const VehicleStep = ({ orderData, setOrderData }) => {
    return (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.vehicleHint}>Choose the vehicle that fits your items</Text>

            {VEHICLES.map(vehicle => (
                <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={orderData.selectedVehicle?.id === vehicle.id}
                    onSelect={(v) => setOrderData(prev => ({ ...prev, selectedVehicle: v }))}
                    distance={orderData.distance || 10}
                />
            ))}

            {orderData.selectedVehicle && (
                <View style={styles.whatFitsSection}>
                    <Text style={styles.whatFitsTitle}>What fits in a {orderData.selectedVehicle.type}:</Text>
                    {orderData.selectedVehicle.items.map((item, index) => (
                        <View key={index} style={styles.whatFitsItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#00D4AA" />
                            <Text style={styles.whatFitsText}>{item}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default VehicleStep;
