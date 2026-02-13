import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator
} from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../styles/theme';
import { calculateEstimate } from '../../services/PricingService';

const VehicleCard = ({
    vehicle,
    isSelected,
    onSelect,
    distance,
    duration,
    isLoadingPrice = false
}) => {
    const estimatedPrice = calculateEstimate(vehicle, distance, duration);

    return (
        <TouchableOpacity
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(vehicle)}
            activeOpacity={0.8}
        >
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
                    <ActivityIndicator size="small" color={colors.primary} />
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
        backgroundColor: colors.background.elevated
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
