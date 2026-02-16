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

const VehicleCard = ({
    vehicle,
    isSelected,
    onSelect,
    isLoadingPrice = false,
    isRecommended = false,
    displayPrice
}) => {
    return (
        <TouchableOpacity
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(vehicle)}
            activeOpacity={0.8}
        >
            {/* AI Recommended Badge */}
            {isRecommended && (
                <View style={styles.recommendedBadge}>
                    <Ionicons name="sparkles" size={14} color={colors.primary} />
                    <Text style={styles.recommendedText}>AI Recommended</Text>
                </View>
            )}

            {/* Header Row */}
            <View style={styles.header}>
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
                    ) : displayPrice != null ? (
                        <Text style={styles.price}>${displayPrice.toFixed(2)}</Text>
                    ) : null}
                </View>
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
        borderWidth: 2,
        borderColor: colors.transparent,
        minHeight: 88,
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.background.elevated
    },
    recommendedBadge: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        zIndex: 1,
    },
    recommendedText: {
        color: colors.primary,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: spacing.xs,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: 'flex-end',
    },
    price: {
        color: colors.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold
    },
});

export default VehicleCard;
