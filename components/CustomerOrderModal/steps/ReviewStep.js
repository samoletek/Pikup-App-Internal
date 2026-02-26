import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { colors, typography, spacing, borderRadius, sizing, hitSlopDefault } from '../../../styles/theme';
import PaymentMethodsScreen from '../../../screens/customer/PaymentMethodsScreen';
import { estimateLaborMinutes } from '../../../services/PricingService';

const SLIDER_VALUE_MIN_WIDTH = 80;
const BOTTOM_SPACER_HEIGHT = 100;

const ReviewStep = ({
    orderData,
    pricing,
    onNavigateToStep,
    paymentMethods = [],
    selectedPaymentMethod = null,
    defaultPaymentMethodId = null,
    onSelectPaymentMethod,
}) => {
    const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);

    const modalNavigation = useMemo(() => ({
        goBack: () => setShowPaymentMethodsModal(false),
    }), []);

    const selectedMethodDisplay = useMemo(() => {
        if (!selectedPaymentMethod) {
            return {
                title: 'Select a card',
                subtitle: 'Choose a saved payment method',
                icon: 'alert-circle-outline',
                iconColor: colors.warning
            };
        }

        const brand = selectedPaymentMethod.brand || selectedPaymentMethod.cardBrand || 'Card';
        return {
            title: `${brand.toUpperCase()} •••• ${selectedPaymentMethod.last4}`,
            subtitle: `Expires ${selectedPaymentMethod.expMonth}/${selectedPaymentMethod.expYear}`,
            icon: 'card',
            iconColor: colors.success
        };
    }, [selectedPaymentMethod]);

    const isSelfHandling = orderData.pickupDetails?.driverHelpsLoading !== true
        && orderData.dropoffDetails?.driverHelpsUnloading !== true;

    // Labor time adjustment slider
    const [laborAdjustment, setLaborAdjustment] = useState(null); // null = use estimate

    const laborSliderConfig = useMemo(() => {
        if (!pricing || isSelfHandling) return null;
        const estimateMinutes = pricing.laborMinutes || 0;
        if (estimateMinutes === 0) return null;

        const bufferMinutes = pricing.laborBufferMinutes || 0;
        const min = estimateMinutes;
        const max = estimateMinutes * 2;
        const step = 5;

        return { min, max, step, estimateMinutes, bufferMinutes };
    }, [pricing, isSelfHandling]);

    const currentLaborMinutes = laborSliderConfig
        ? (laborAdjustment ?? laborSliderConfig.estimateMinutes)
        : (pricing?.laborMinutes || 0);

    const adjustedPricing = useMemo(() => {
        if (!pricing || !laborSliderConfig || laborAdjustment === null) return pricing;

        const bufferMinutes = laborSliderConfig.bufferMinutes;
        const billable = Math.max(0, laborAdjustment - bufferMinutes);
        const newLaborFee = Math.round(billable * (pricing.laborPerMin || 0) * 100) / 100;
        const laborDiff = newLaborFee - (pricing.laborFee || 0);

        return {
            ...pricing,
            laborFee: newLaborFee,
            laborMinutes: laborAdjustment,
            laborBillableMinutes: billable,
            total: Math.round((pricing.total + laborDiff) * 100) / 100,
        };
    }, [pricing, laborSliderConfig, laborAdjustment]);

    const handleLaborStep = useCallback((direction) => {
        if (!laborSliderConfig) return;
        const { min, max, step } = laborSliderConfig;
        const current = laborAdjustment ?? laborSliderConfig.estimateMinutes;
        const next = direction === 'up'
            ? Math.min(max, current + step)
            : Math.max(min, current - step);
        setLaborAdjustment(next);
    }, [laborSliderConfig, laborAdjustment]);

    // Use adjustedPricing for display
    const displayPricing = adjustedPricing || pricing;

    const handlingEstimate = useMemo(() => {
        const aiVehicleRecommendation = orderData.aiVehicleRecommendation || {};

        const labor = pricing
            ? {
                pickupMinutes: Number(pricing.laborPickupMinutes) || 0,
                dropoffMinutes: Number(pricing.laborDropoffMinutes) || 0,
                bufferMinutes: Number(pricing.laborBufferMinutes) || 0,
            }
            : estimateLaborMinutes({
                items: orderData.items || [],
                pickupDetails: orderData.pickupDetails || {},
                dropoffDetails: orderData.dropoffDetails || {},
            });

        const formatLegMinutes = (minutes) => (
            minutes > 0 ? `${minutes} min` : 'Not requested'
        );

        const totalHandlingMinutes = (labor.pickupMinutes || 0) + (labor.dropoffMinutes || 0);

        if (totalHandlingMinutes === 0) {
            return {
                loading: 'Not requested',
                unloading: 'Not requested',
                hint: 'No loading/unloading assistance selected.',
            };
        }

        const baseHint = labor.bufferMinutes > 0
            ? `Based on labor settings. Includes ${labor.bufferMinutes} min free buffer.`
            : 'Based on labor settings in your request.';

        return {
            loading: formatLegMinutes(labor.pickupMinutes),
            unloading: formatLegMinutes(labor.dropoffMinutes),
            hint: aiVehicleRecommendation.step6Description || aiVehicleRecommendation.notes || baseHint,
        };
    }, [
        pricing,
        orderData.items,
        orderData.pickupDetails,
        orderData.dropoffDetails,
        orderData.aiVehicleRecommendation,
    ]);

    return (
        <>
            <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
                {/* Route Summary */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(1)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Route</Text>
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                        <Text style={styles.routeAddress} numberOfLines={1}>{orderData.pickup.address}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                        <Text style={styles.routeAddress} numberOfLines={1}>{orderData.dropoff.address}</Text>
                    </View>
                </TouchableOpacity>

                {/* Items Summary */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(2)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Items ({orderData.items.length})</Text>
                    {orderData.items.map(item => (
                        <View key={item.id} style={styles.itemSummaryRow}>
                            <Text style={styles.itemSummaryName}>{item.name}</Text>
                            <View style={styles.itemSummaryBadges}>
                                {item.isFragile && <Text style={styles.fragileTag}>Fragile</Text>}
                                {(item.condition === 'new' && item.hasInsurance) && <Text style={styles.insuredTag}>Insured</Text>}
                            </View>
                        </View>
                    ))}
                    {isSelfHandling ? (
                        <View style={styles.handlingEstimateBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <Ionicons name="time-outline" size={18} color={colors.secondary} />
                                <Text style={styles.handlingEstimateTitle}>Self-Handling</Text>
                            </View>
                            <Text style={styles.handlingEstimateHint}>
                                Please be at the location ~5 min before the driver arrives. You will handle loading and unloading yourself.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.handlingEstimateBox}>
                            <Text style={styles.handlingEstimateTitle}>Estimated Loading & Unloading</Text>
                            <View style={styles.handlingEstimateRow}>
                                <Text style={styles.handlingEstimateLabel}>Loading</Text>
                                <Text style={styles.handlingEstimateValue}>{handlingEstimate.loading}</Text>
                            </View>
                            <View style={styles.handlingEstimateRow}>
                                <Text style={styles.handlingEstimateLabel}>Unloading</Text>
                                <Text style={styles.handlingEstimateValue}>{handlingEstimate.unloading}</Text>
                            </View>
                            <Text style={styles.handlingEstimateHint}>{handlingEstimate.hint}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Vehicle */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(5)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Vehicle</Text>
                    <View style={styles.vehicleSummary}>
                        <Image source={orderData.selectedVehicle?.image} style={styles.vehicleSummaryImg} />
                        <Text style={styles.vehicleSummaryName}>{orderData.selectedVehicle?.type}</Text>
                    </View>
                </TouchableOpacity>

                {/* Labor Time Adjustment */}
                {laborSliderConfig && !isSelfHandling && (
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryCardTitle}>Adjust Labor Time</Text>
                        <Text style={[styles.priceLabel, { marginBottom: spacing.md }]}>
                            Move items take time. Adjust if you need more time.
                        </Text>

                        <View style={localStyles.sliderRow}>
                            <TouchableOpacity
                                style={[
                                    localStyles.sliderBtn,
                                    currentLaborMinutes <= laborSliderConfig.min && localStyles.sliderBtnDisabled,
                                ]}
                                onPress={() => handleLaborStep('down')}
                                hitSlop={hitSlopDefault}
                            >
                                <Ionicons
                                    name="remove"
                                    size={22}
                                    color={currentLaborMinutes <= laborSliderConfig.min ? colors.text.muted : colors.text.primary}
                                />
                            </TouchableOpacity>

                            <View style={localStyles.sliderValueBox}>
                                <Text style={localStyles.sliderValueText}>{currentLaborMinutes} min</Text>
                                {laborAdjustment === null && (
                                    <Text style={localStyles.sliderEstimateLabel}>estimated</Text>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[
                                    localStyles.sliderBtn,
                                    currentLaborMinutes >= laborSliderConfig.max && localStyles.sliderBtnDisabled,
                                ]}
                                onPress={() => handleLaborStep('up')}
                                hitSlop={hitSlopDefault}
                            >
                                <Ionicons
                                    name="add"
                                    size={22}
                                    color={currentLaborMinutes >= laborSliderConfig.max ? colors.text.muted : colors.text.primary}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.sliderRange}>
                            <Text style={localStyles.sliderRangeText}>{laborSliderConfig.min} min</Text>
                            <Text style={localStyles.sliderRangeText}>{laborSliderConfig.max} min</Text>
                        </View>

                        {laborSliderConfig.bufferMinutes > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs }}>
                                <Ionicons name="information-circle" size={14} color={colors.primary} />
                                <Text style={[styles.priceLabel, { fontSize: typography.fontSize.xs, color: colors.text.muted }]}>
                                    Includes {laborSliderConfig.bufferMinutes} min free buffer
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Price Breakdown */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Price Breakdown</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Base Fare</Text>
                        <Text style={styles.priceValue}>${displayPricing?.baseFare?.toFixed(2) || '0.00'}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Mileage ({displayPricing?.distance || 0} mi)</Text>
                        <Text style={styles.priceValue}>${displayPricing?.mileageFee?.toFixed(2) || '0.00'}</Text>
                    </View>

                    {displayPricing?.laborFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>
                                Labor ({displayPricing.laborBillableMinutes || displayPricing.laborMinutes} min @ ${displayPricing.laborPerMin?.toFixed(2)}/min)
                            </Text>
                            <Text style={styles.priceValue}>${displayPricing.laborFee.toFixed(2)}</Text>
                        </View>
                    )}

                    {displayPricing?.laborBufferMinutes > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { fontSize: typography.fontSize.xs, color: colors.text.muted }]}>
                                Includes {displayPricing.laborBufferMinutes} min free buffer
                            </Text>
                        </View>
                    )}

                    {displayPricing?.surgeFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Surge ({displayPricing.surgeLabel})</Text>
                            <Text style={styles.priceValue}>${displayPricing.surgeFee.toFixed(2)}</Text>
                        </View>
                    )}

                    {displayPricing?.mandatoryInsurance > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Mandatory Insurance</Text>
                            <Text style={styles.priceValue}>${displayPricing.mandatoryInsurance.toFixed(2)}</Text>
                        </View>
                    )}

                    <View style={styles.priceDivider} />

                    <View style={styles.priceRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${displayPricing?.total?.toFixed(2) || '0.00'}</Text>
                    </View>
                </View>

                {/* Card Selection (Bottom) */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Choose Card</Text>

                    {paymentMethods.length === 0 ? (
                        <View style={styles.noCardsContainer}>
                            <Ionicons name={selectedMethodDisplay.icon} size={20} color={selectedMethodDisplay.iconColor} />
                            <View style={styles.paymentSummaryCopy}>
                                <Text style={styles.paymentSummaryTitle}>{selectedMethodDisplay.title}</Text>
                                <Text style={styles.paymentSummarySubtitle}>{selectedMethodDisplay.subtitle}</Text>
                            </View>
                        </View>
                    ) : (
                        paymentMethods.map(method => {
                            const methodBrand = method.brand || method.cardBrand || 'Card';
                            const isSelected = selectedPaymentMethod?.id === method.id;
                            const isDefault = defaultPaymentMethodId
                                ? defaultPaymentMethodId === method.id
                                : method.isDefault;

                            return (
                                <TouchableOpacity
                                    key={method.id}
                                    style={[styles.paymentMethodRow, isSelected && styles.paymentMethodRowSelected]}
                                    onPress={() => {
                                        if (onSelectPaymentMethod) onSelectPaymentMethod(method);
                                    }}
                                >
                                    <View style={styles.paymentMethodRowLeft}>
                                        <Ionicons name="card" size={20} color={isSelected ? colors.success : colors.text.secondary} />
                                        <View style={styles.paymentMethodCopy}>
                                            <Text style={styles.paymentMethodTitle}>
                                                {methodBrand.toUpperCase()} •••• {method.last4}
                                            </Text>
                                            <Text style={styles.paymentMethodSubtitle}>
                                                Expires {method.expMonth}/{method.expYear}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.paymentMethodBadges}>
                                        {isDefault && <Text style={styles.defaultMethodBadge}>Default</Text>}
                                        {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}

                    <TouchableOpacity
                        style={styles.addPaymentCardButton}
                        onPress={() => setShowPaymentMethodsModal(true)}
                    >
                        <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                        <Text style={styles.addPaymentCardButtonText}>Add Card</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: BOTTOM_SPACER_HEIGHT }} />
            </ScrollView>

            <Modal
                visible={showPaymentMethodsModal}
                animationType="slide"
                transparent
                presentationStyle="overFullScreen"
                statusBarTranslucent
                onRequestClose={() => setShowPaymentMethodsModal(false)}
            >
                <PaymentMethodsScreen navigation={modalNavigation} />
            </Modal>
        </>
    );
};

const localStyles = StyleSheet.create({
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    sliderBtn: {
        width: sizing.touchTargetMin,
        height: sizing.touchTargetMin,
        borderRadius: sizing.touchTargetMin / 2,
        backgroundColor: colors.background.input,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sliderBtnDisabled: {
        opacity: 0.4,
    },
    sliderValueBox: {
        minWidth: SLIDER_VALUE_MIN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sliderValueText: {
        color: colors.text.primary,
        fontSize: typography.fontSize.xl,
        fontWeight: typography.fontWeight.bold,
    },
    sliderEstimateLabel: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        marginTop: spacing.xxs,
    },
    sliderRange: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    sliderRangeText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
    },
});

export default ReviewStep;
