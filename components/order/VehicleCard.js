import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../styles/theme';

const VehicleCard = ({
    vehicle,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpand,
    isLoadingPrice = false,
    isRecommended = false,
    displayPrice
}) => {
    return (
        <Animated.View
            layout={LinearTransition.duration(350)}
            style={[
                styles.card,
                isExpanded && styles.cardExpanded,
                isSelected && styles.cardSelected,
            ]}
        >
            <TouchableOpacity
                onPress={isExpanded ? undefined : onToggleExpand}
                activeOpacity={isExpanded ? 1 : 0.7}
            >
                {/* Header row — always visible */}
                <Animated.View layout={LinearTransition.duration(350)} style={styles.headerRow}>
                    <Image
                        source={vehicle.image}
                        style={isExpanded ? styles.expandedImage : styles.collapsedImage}
                    />

                    {!isExpanded ? (
                        <>
                            <Text style={styles.collapsedName} numberOfLines={1}>{vehicle.type}</Text>
                            <View style={styles.collapsedRight}>
                                {isLoadingPrice ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : displayPrice != null ? (
                                    <Text style={styles.collapsedPrice}>${displayPrice.toFixed(2)}</Text>
                                ) : null}
                                <Ionicons name="chevron-down" size={16} color={colors.text.subtle} style={styles.chevron} />
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={styles.expandedInfo}>
                                <Text style={styles.expandedName}>{vehicle.type}</Text>
                                <Text style={styles.expandedCapacity}>{vehicle.capacity}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.collapseButton}
                                onPress={onToggleExpand}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="chevron-up" size={18} color={colors.text.subtle} />
                            </TouchableOpacity>
                        </>
                    )}
                </Animated.View>
            </TouchableOpacity>

            {/* Expanded content */}
            {isExpanded && (
                <Animated.View
                    entering={FadeInDown.duration(300).delay(50)}
                    exiting={FadeOutUp.duration(200)}
                >
                    {/* Price — large, centered */}
                    <View style={styles.expandedPriceRow}>
                        {isLoadingPrice ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : displayPrice != null ? (
                            <Text style={styles.expandedPrice}>${displayPrice.toFixed(2)}</Text>
                        ) : null}
                    </View>

                    {/* Select / AI Recommended button */}
                    <TouchableOpacity
                        style={[
                            styles.selectButton,
                            isRecommended && !isSelected && styles.selectButtonRecommended,
                            isSelected && styles.selectButtonActive,
                        ]}
                        onPress={() => onSelect(vehicle)}
                        activeOpacity={0.7}
                    >
                        {isSelected ? (
                            <Ionicons name="checkmark-circle" size={18} color={colors.white} style={{ marginRight: spacing.xs }} />
                        ) : isRecommended ? (
                            <Ionicons name="sparkles" size={16} color={colors.white} style={{ marginRight: spacing.xs }} />
                        ) : null}
                        <Text style={[
                            styles.selectButtonText,
                            (isSelected || isRecommended) && styles.selectButtonTextActive,
                        ]}>
                            {isSelected ? 'Selected' : isRecommended ? 'Select · AI Recommended' : 'Select'}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 2,
        borderColor: colors.transparent,
        overflow: 'hidden',
    },
    cardExpanded: {
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.base,
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.background.elevated,
    },

    // ─── Header row ───
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    collapsedImage: {
        width: 48,
        height: 28,
        resizeMode: 'contain',
    },
    expandedImage: {
        width: 160,
        height: 90,
        resizeMode: 'contain',
    },
    collapsedName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        flex: 1,
        marginLeft: spacing.md,
    },
    collapsedRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    collapsedPrice: {
        color: colors.primary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.bold,
    },
    chevron: {
        marginLeft: spacing.sm,
    },

    // ─── Expanded ───
    expandedInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    expandedName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.bold,
    },
    expandedCapacity: {
        color: colors.text.muted,
        fontSize: typography.fontSize.sm,
        marginTop: spacing.xs,
    },
    collapseButton: {
        padding: spacing.xs,
    },
    expandedPriceRow: {
        alignItems: 'center',
        marginTop: spacing.md,
    },
    expandedPrice: {
        color: colors.primary,
        fontSize: typography.fontSize.xxl,
        fontWeight: typography.fontWeight.bold,
    },
    selectButton: {
        marginTop: spacing.md,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.full,
        paddingVertical: spacing.sm + 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    selectButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    selectButtonRecommended: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    selectButtonText: {
        color: colors.text.secondary,
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
    },
    selectButtonTextActive: {
        color: colors.white,
    },
});

export default VehicleCard;
