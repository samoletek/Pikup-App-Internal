import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';

const ReviewStep = ({ orderData, pricing, onNavigateToStep }) => {
    return (
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
                    <Text style={styles.priceLabel}>Distance ({pricing?.distance || 0} mi × ${orderData.selectedVehicle?.perMile?.toFixed(2) || '0.00'})</Text>
                    <Text style={styles.priceValue}>${pricing?.perMileFee?.toFixed(2) || '0.00'}</Text>
                </View>

                {pricing?.loadingFee > 0 && (
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Loading/Unloading Help</Text>
                        <Text style={styles.priceValue}>${pricing.loadingFee.toFixed(2)}</Text>
                    </View>
                )}

                {pricing?.insuranceFee > 0 && (
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Insurance ({orderData.items.filter(i => i.hasInsurance).length} items)</Text>
                        <Text style={styles.priceValue}>${pricing.insuranceFee.toFixed(2)}</Text>
                    </View>
                )}

                <View style={styles.priceDivider} />

                <View style={styles.priceRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${pricing?.total?.toFixed(2) || '0.00'}</Text>
                </View>
            </View>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

export default ReviewStep;
