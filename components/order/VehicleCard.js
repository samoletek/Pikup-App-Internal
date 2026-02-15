import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../styles/theme';
import { calculateEstimate } from '../../services/PricingService';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VehicleCard = ({
    vehicle,
    isSelected,
    onSelect,
    distance,
    duration,
    isLoadingPrice = false,
    isExpanded = false,
    onToggleExpand
}) => {
    const estimatedPrice = calculateEstimate(vehicle, distance, duration);

    const handlePress = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onSelect(vehicle);
        if (onToggleExpand) {
            onToggleExpand();
        }
    };

    return (
        <TouchableOpacity
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            {/* Header Row */}
            <View style={styles.header}>
                {/* Vehicle Image */}
                <Image source={vehicle.image} style={styles.vehicleImage} />

                {/* Vehicle Info */}
                <View style={styles.info}>
                    <Text style={styles.vehicleType}>{vehicle.type}</Text>
                    <Text style={styles.capacity}>{vehicle.capacity}</Text>
                </View>

                {/* Price + Chevron */}
                <View style={styles.rightSection}>
                    <View style={styles.priceContainer}>
                        {isLoadingPrice ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                <Text style={styles.priceLabel}>starting at</Text>
                                <Text style={styles.price}>${estimatedPrice.toFixed(2)}</Text>
                            </>
                        )}
                    </View>
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.text.muted}
                        style={styles.chevron}
                    />
                </View>
            </View>

            {/* Expanded Content */}
            {isExpanded && vehicle.items && vehicle.items.length > 0 && (
                <View style={styles.expandedContent}>
                    <Text style={styles.whatFitsTitle}>What fits:</Text>
                    {vehicle.items.map((item, index) => (
                        <View key={index} style={styles.whatFitsItem}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                            <Text style={styles.whatFitsText}>{item}</Text>
                        </View>
                    ))}
                </View>
            )}
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
    rightSection: {
        alignItems: 'flex-end',
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    price: {
        color: colors.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold
    },
    priceLabel: {
        color: colors.text.placeholder,
        fontSize: typography.fontSize.xs,
        marginTop: 2
    },
    chevron: {
        marginTop: spacing.xs,
    },
    expandedContent: {
        marginTop: spacing.base,
        paddingTop: spacing.base,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    whatFitsTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        marginBottom: spacing.md,
    },
    whatFitsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    whatFitsText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.base,
        marginLeft: spacing.sm,
    },
});

export default VehicleCard;
