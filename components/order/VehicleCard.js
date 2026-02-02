import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../styles/theme';

// Vehicle data - same as VehicleSelectionModal
const VEHICLES = [
    {
        id: 'cargo-van',
        type: 'Cargo Van',
        image: require('../../assets/van.png'),
        capacity: 'Up to 500 lbs',
        items: [
            'Sofa or Loveseat',
            'Queen Mattress & Bed Frame',
            'Up to 15 Medium Boxes',
            'Large TV (boxed)',
            'Office Desk & Chair'
        ],
        basePrice: 30.00,
        perMile: 2.00
    },
    {
        id: 'pickup-truck',
        type: 'Pickup Truck',
        image: require('../../assets/pickup.png'),
        capacity: 'Up to 300 lbs',
        items: [
            'Loveseat or Small Couch',
            'Small to Medium Mattress',
            'Up to 10 Medium Boxes',
            'Medium TV (boxed)',
            'Office Desk & Chair'
        ],
        basePrice: 27.00,
        perMile: 1.50
    }
];

const VehicleCard = ({
    vehicle,
    isSelected,
    onSelect,
    distance,
    isLoadingPrice = false
}) => {
    // Calculate estimated price
    const estimatedPrice = vehicle.basePrice + (distance || 10) * vehicle.perMile;

    return (
        <TouchableOpacity
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(vehicle)}
            activeOpacity={0.8}
        >
            {/* Selected indicator */}
            {isSelected && (
                <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#A77BFF" />
                </View>
            )}

            {/* Vehicle Image */}
            <Image source={vehicle.image} style={styles.vehicleImage} />

            {/* Vehicle Info */}
            <View style={styles.info}>
                <Text style={styles.vehicleType}>{vehicle.type}</Text>
                <Text style={styles.capacity}>{vehicle.capacity}</Text>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
                {isLoadingPrice ? (
                    <ActivityIndicator size="small" color="#A77BFF" />
                ) : (
                    <>
                        <Text style={styles.price}>${estimatedPrice.toFixed(2)}</Text>
                        <Text style={styles.priceLabel}>estimated</Text>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
};

// Export VEHICLES for use in CustomerOrderModal
export { VEHICLES };

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.transparent
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: '#252538'
    },
    selectedBadge: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md
    },
    vehicleImage: {
        width: 80,
        height: 45,
        resizeMode: 'contain'
    },
    info: {
        flex: 1,
        marginLeft: spacing.base
    },
    vehicleType: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold
    },
    capacity: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs
    },
    priceContainer: {
        alignItems: 'flex-end'
    },
    price: {
        color: colors.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold
    },
    priceLabel: {
        color: colors.text.placeholder,
        fontSize: typography.fontSize.xs,
        marginTop: 2
    }
});

export default VehicleCard;
