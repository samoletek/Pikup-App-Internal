import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';
import PaymentMethodsScreen from '../../../screens/customer/PaymentMethodsScreen';

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
                                {item.hasInsurance && <Text style={styles.insuredTag}>Insured</Text>}
                            </View>
                        </View>
                    ))}
                </TouchableOpacity>

                {/* Vehicle */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(5)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Vehicle</Text>
                    <View style={styles.vehicleSummary}>
                        <Image source={orderData.selectedVehicle?.image} style={styles.vehicleSummaryImg} />
                        <Text style={styles.vehicleSummaryName}>{orderData.selectedVehicle?.type}</Text>
                    </View>
                </TouchableOpacity>

                {/* Price Breakdown */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Price Breakdown</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Base Fare</Text>
                        <Text style={styles.priceValue}>${pricing?.baseFare?.toFixed(2) || '0.00'}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Mileage ({pricing?.distance || 0} mi)</Text>
                        <Text style={styles.priceValue}>${pricing?.mileageFee?.toFixed(2) || '0.00'}</Text>
                    </View>

                    {pricing?.laborFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Labor ({pricing?.duration || 0} min)</Text>
                            <Text style={styles.priceValue}>${pricing.laborFee.toFixed(2)}</Text>
                        </View>
                    )}

                    {pricing?.surgeFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Surge ({pricing.surgeLabel})</Text>
                            <Text style={styles.priceValue}>${pricing.surgeFee.toFixed(2)}</Text>
                        </View>
                    )}

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Service & Technology Fee</Text>
                        <Text style={styles.priceValue}>${pricing?.serviceFee?.toFixed(2) || '0.00'}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Mandatory Insurance</Text>
                        <Text style={styles.priceValue}>${pricing?.mandatoryInsurance?.toFixed(2) || '0.00'}</Text>
                    </View>

                    <View style={styles.priceDivider} />

                    <View style={styles.priceRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${pricing?.total?.toFixed(2) || '0.00'}</Text>
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

                <View style={{ height: 100 }} />
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

export default ReviewStep;
