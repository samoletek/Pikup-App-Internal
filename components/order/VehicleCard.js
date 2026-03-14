import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    LayoutAnimation,
    UIManager,
    Platform,
} from 'react-native';
import Animated, {
    Easing, useAnimatedStyle, useSharedValue, withTiming
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography, sizing } from '../../styles/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLLAPSED_W = 80;
const COLLAPSED_H = 48;
const EXPANDED_W = 160;
const EXPANDED_H = 90;

// Timing — match LayoutAnimation easeInEaseOut curve
const ANIM_MS = 300;
const EASING = Easing.inOut(Easing.ease);

const VehicleCard = ({
    vehicle,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpand,
    isLoadingPrice = false,
    isRecommended = false,
    displayPrice,
    isDisabled = false,
    disabledReason = '',
}) => {
    const imageW = useSharedValue(isExpanded ? EXPANDED_W : COLLAPSED_W);
    const imageH = useSharedValue(isExpanded ? EXPANDED_H : COLLAPSED_H);
    const priceOp = useSharedValue(isExpanded ? 1 : 0);
    const shadowOp = useSharedValue(isSelected ? 0.85 : 0);
    const shadowRad = useSharedValue(isSelected ? 18 : 2);

    useEffect(() => {
        LayoutAnimation.configureNext(
            LayoutAnimation.create(ANIM_MS, 'easeInEaseOut', 'opacity')
        );

        const cfg = { duration: ANIM_MS, easing: EASING };
        imageW.value = withTiming(isExpanded ? EXPANDED_W : COLLAPSED_W, cfg);
        imageH.value = withTiming(isExpanded ? EXPANDED_H : COLLAPSED_H, cfg);
        priceOp.value = withTiming(isExpanded ? 1 : 0, cfg);
    }, [imageH, imageW, isExpanded, priceOp]);

    // Shadow grows smoothly on select, shrinks on deselect
    useEffect(() => {
        shadowOp.value = withTiming(isSelected ? 0.85 : 0, { duration: 300 });
        shadowRad.value = withTiming(isSelected ? 18 : 2, { duration: 300 });
    }, [isSelected, shadowOp, shadowRad]);

    const imageAnimStyle = useAnimatedStyle(() => ({
        width: imageW.value,
        height: imageH.value,
    }));
    const priceStyle = useAnimatedStyle(() => ({ opacity: priceOp.value }));
    const shadowStyle = useAnimatedStyle(() => ({
        shadowOpacity: shadowOp.value,
        shadowRadius: shadowRad.value,
    }));

    return (
        <TouchableOpacity
            onPress={isExpanded || isDisabled ? undefined : () => { onToggleExpand(); onSelect(vehicle); }}
            activeOpacity={isExpanded || isDisabled ? 1 : 0.7}
            disabled={isDisabled}
            style={[
                styles.card,
                isExpanded && styles.cardExpanded,
                isSelected && styles.cardSelected,
                isDisabled && styles.cardDisabled,
            ]}
        >
            {isRecommended && (
                <View style={styles.aiBadge}>
                    <Ionicons name="sparkles" size={10} color={colors.white} />
                    <Text style={styles.aiBadgeText}>AI Pick</Text>
                </View>
            )}
            {isDisabled && (
                <View style={styles.unfitBadge}>
                    <Ionicons name="close-circle" size={sizing.badgeIconSize} color={colors.white} />
                    <Text style={styles.unfitBadgeText}>Won't Fit</Text>
                </View>
            )}
                {/* Header row */}
                <View style={[styles.headerRow, isExpanded && styles.headerRowExpanded]}>
                    <Animated.View style={[
                        styles.imageWrap,
                        isExpanded && styles.imageWrapExpanded,
                        shadowStyle
                    ]}>
                        <Animated.Image
                            source={vehicle.image}
                            style={[styles.vehicleImage, imageAnimStyle]}
                        />
                    </Animated.View>

                    {!isExpanded ? (
                        <>
                            <View style={styles.collapsedInfo}>
                                <Text style={styles.collapsedName} numberOfLines={1}>{vehicle.type}</Text>
                                {vehicle.capacity ? (
                                    <Text style={styles.collapsedCapacity} numberOfLines={1}>{vehicle.capacity}</Text>
                                ) : null}
                                {isDisabled && !!disabledReason ? (
                                    <Text style={styles.unfitReason} numberOfLines={2}>{disabledReason}</Text>
                                ) : null}
                            </View>
                            <View style={styles.collapsedRight}>
                                {isLoadingPrice ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : displayPrice != null ? (
                                    <Text style={styles.collapsedPrice}>${displayPrice.toFixed(2)}</Text>
                                ) : null}
                            </View>
                        </>
                    ) : (
                        <View style={styles.expandedRight}>
                            <Text style={styles.expandedName}>{vehicle.type}</Text>
                            {vehicle.capacity ? (
                                <Text style={styles.expandedCapacity}>{vehicle.capacity}</Text>
                            ) : null}
                            {isDisabled && !!disabledReason && (
                                <Text style={styles.unfitReason} numberOfLines={2}>{disabledReason}</Text>
                            )}
                            <Animated.View style={[styles.expandedPriceWrap, priceStyle]}>
                                {isLoadingPrice ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : displayPrice != null ? (
                                    <Text style={styles.expandedPrice}>${displayPrice.toFixed(2)}</Text>
                                ) : null}
                            </Animated.View>
                        </View>
                    )}
                </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        paddingVertical: spacing.base,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 2,
        borderColor: colors.transparent,
        overflow: 'hidden',
    },
    cardExpanded: {
        borderRadius: borderRadius.lg,
    },
    cardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.background.elevated,
    },
    cardDisabled: {
        opacity: 0.45,
    },

    // --- Header row ---
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRowExpanded: {
        alignItems: 'flex-start',
    },
    imageWrap: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        elevation: 12,
    },
    imageWrapExpanded: {
        width: EXPANDED_W,
        height: EXPANDED_H,
    },
    vehicleImage: {
        resizeMode: 'contain',
    },
    collapsedInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    collapsedName: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
    },
    collapsedCapacity: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginTop: 2,
    },
    collapsedRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    collapsedPrice: {
        color: colors.primary,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
    },
    // --- Expanded ---
    expandedRight: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'center',
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
    expandedPriceWrap: {
        marginTop: spacing.md,
        alignItems: 'flex-end',
    },
    aiBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        zIndex: 1,
    },
    aiBadgeText: {
        color: colors.white,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: 3,
    },
    unfitBadge: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.error,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: sizing.badgePaddingVertical,
        zIndex: 1,
    },
    unfitBadgeText: {
        color: colors.white,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        marginLeft: sizing.badgeTextMargin,
    },
    unfitReason: {
        marginTop: spacing.xs,
        color: colors.error,
        fontSize: typography.fontSize.xs,
    },
    expandedPrice: {
        color: colors.primary,
        fontSize: typography.fontSize.xxl,
        fontWeight: typography.fontWeight.bold,
    },
});

export default VehicleCard;
