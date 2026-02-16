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
import { colors, borderRadius, spacing, typography, sizing } from '../../styles/theme';

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
            {/* Price - top right */}
            <View style={styles.priceContainer}>
                {isLoadingPrice ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : displayPrice != null ? (
                    <Text style={styles.price}>${displayPrice.toFixed(2)}</Text>
                ) : null}
            </View>

            {/* Header Row */}
            <View style={styles.header}>
                {/* Vehicle Image + Badge */}
                <View style={styles.imageColumn}>
                    <Image source={vehicle.image} style={styles.vehicleImage} />
                    {isRecommended && (
                        <View style={styles.recommendedBadge}>
                            <Ionicons name="sparkles" size={sizing.badgeIconSize} color={colors.primary} />
                            <Text style={styles.recommendedText}>AI Recommended</Text>
                        </View>
                    )}
                </View>

                {/* Vehicle Info */}
                <View style={styles.info}>
                    <Text style={styles.vehicleType}>{vehicle.type}</Text>
                    <Text style={styles.capacity}>{vehicle.capacity}</Text>
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
        borderWidth: sizing.vehicleCardBorderWidth,
        borderColor: colors.transparent,
        minHeight: sizing.vehicleCardMinHeight,
        justifyContent: 'center',
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.background.elevated
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageColumn: {
        alignItems: 'center',
    },
    vehicleImage: {
        width: sizing.vehicleImageWidth,
        height: sizing.vehicleImageHeight,
        resizeMode: 'contain'
    },
    recommendedBadge: {
        position: 'absolute',
        bottom: sizing.badgeOffset,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryLight,
        borderRadius: borderRadius.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: sizing.badgePaddingVertical,
    },
    recommendedText: {
        color: colors.primary,
        fontSize: sizing.badgeFontSize,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: sizing.badgeTextMargin,
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
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        zIndex: 1,
    },
    price: {
        color: colors.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold
    },
});

export default VehicleCard;
