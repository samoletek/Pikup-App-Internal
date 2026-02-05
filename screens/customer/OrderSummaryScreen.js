import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Alert,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePayment } from "../../contexts/PaymentContext";
import { useAuth } from "../../contexts/AuthContext";
import AddPaymentMethodModal from "../../components/AddPaymentMethodModal";

export default function OrderSummaryScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();

    // Get data from route params
    const {
        selectedVehicle,
        selectedLocations = {},
        distance,
        duration,
        summaryData = {},
    } = route.params || {};

    const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Expandable sections
    const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
    const [priceBreakdownAnim] = useState(new Animated.Value(0));

    const {
        defaultPaymentMethod,
        paymentMethods,
        createPaymentIntent,
        confirmPayment,
        loading: paymentLoading,
    } = usePayment();

    const handleGoBack = () => {
        navigation.goBack();
    };

    // Calculate total from vehicle pricing
    const getPricingData = () => {
        if (selectedVehicle?.pricing) {
            const vehiclePricing = selectedVehicle.pricing;
            return {
                basePrice: vehiclePricing.baseFare + vehiclePricing.mileageCharge,
                serviceFee: vehiclePricing.serviceFee,
                tax: vehiclePricing.tax || ((vehiclePricing.subtotal + vehiclePricing.serviceFee) * 0.08),
                total: vehiclePricing.total.toFixed(2),
            };
        }

        // Fallback calculation
        const basePrice = parseFloat(selectedVehicle?.price?.replace("$", "") || "40.00");
        const serviceFee = 2.99;
        const tax = (basePrice + serviceFee) * 0.08;

        return {
            basePrice,
            serviceFee,
            tax,
            total: (basePrice + serviceFee + tax).toFixed(2),
        };
    };

    const handleSchedule = async () => {
        if (!defaultPaymentMethod && paymentMethods.length === 0) {
            Alert.alert(
                "Payment Method Required",
                "Please add a payment method to confirm your order.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Add Payment Method",
                        onPress: () => setAddPaymentModalVisible(true),
                    },
                ]
            );
            return;
        }

        setProcessing(true);

        try {
            const pricing = getPricingData();
            const rideDetails = {
                vehicleType: selectedVehicle?.type,
                pickup: selectedLocations?.pickup,
                dropoff: selectedLocations?.dropoff,
                distance,
                duration,
                timestamp: new Date().toISOString(),
            };

            const paymentIntentResult = await createPaymentIntent(
                parseFloat(pricing.total),
                'usd',
                rideDetails
            );

            if (!paymentIntentResult.success) {
                Alert.alert('Payment Error', paymentIntentResult.error || 'Failed to create payment.');
                return;
            }

            const paymentResult = await confirmPayment(
                paymentIntentResult.paymentIntent.client_secret,
                defaultPaymentMethod?.stripePaymentMethodId
            );

            if (!paymentResult.success) {
                throw new Error(paymentResult.error);
            }

            // Navigate to tracking screen
            navigation.replace('DeliveryTrackingScreen', {
                bookingData: {
                    selectedVehicle,
                    selectedLocations,
                    paymentIntent: paymentResult.paymentIntent,
                    total: pricing.total,
                    distance,
                    duration,
                }
            });

        } catch (error) {
            console.error("Payment failed:", error);
            Alert.alert(
                "Payment Issue",
                error.message || "We couldn't process your payment. Please try again.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Try Again", onPress: () => setTimeout(() => handleSchedule(), 500) }
                ]
            );
        } finally {
            setProcessing(false);
        }
    };

    const handlePaymentMethodPress = () => {
        if (paymentMethods.length === 0) {
            setAddPaymentModalVisible(true);
        } else {
            navigation.navigate('PaymentMethodsScreen');
        }
    };

    const getPaymentMethodDisplay = () => {
        if (!defaultPaymentMethod) {
            return {
                icon: "add-circle-outline",
                text: "Add Payment Method",
                subtext: "Required for pickup",
            };
        }

        return {
            icon: "card",
            text: `${defaultPaymentMethod.brand?.toUpperCase()} •••• ${defaultPaymentMethod.last4}`,
            subtext: `Expires ${defaultPaymentMethod.expMonth}/${defaultPaymentMethod.expYear}`,
        };
    };

    const pricing = getPricingData();
    const paymentDisplay = getPaymentMethodDisplay();

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* Header */}
                <View style={[styles.header, { marginTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Order Summary</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Trip Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Trip Details</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="radio-button-on" size={12} color="#00D4AA" />
                        <Text style={styles.locationText} numberOfLines={2}>
                            {selectedLocations?.pickup?.address || "Pickup Location"}
                        </Text>
                    </View>
                    <View style={styles.dotLine}>
                        {[...Array(3)].map((_, i) => (
                            <View key={i} style={styles.dot} />
                        ))}
                    </View>
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={12} color="#A77BFF" />
                        <Text style={styles.locationText} numberOfLines={2}>
                            {selectedLocations?.dropoff?.address || "Drop-off Location"}
                        </Text>
                    </View>
                    {(distance || duration) && (
                        <View style={styles.tripMeta}>
                            {distance && <Text style={styles.tripMetaText}>{distance} mi</Text>}
                            {distance && duration && <Text style={styles.tripMetaDivider}>•</Text>}
                            {duration && <Text style={styles.tripMetaText}>{duration} min</Text>}
                        </View>
                    )}
                </View>

                {/* Vehicle Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Selected Vehicle</Text>
                    <View style={styles.vehicleRow}>
                        {selectedVehicle?.image && (
                            <Image source={selectedVehicle.image} style={styles.vehicleImage} />
                        )}
                        <View style={styles.vehicleInfo}>
                            <Text style={styles.vehicleType}>
                                {selectedVehicle?.type || "Vehicle"}
                            </Text>
                            <Text style={styles.vehicleEta}>
                                Arrives in {selectedVehicle?.arrival || "15 mins"}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Price Breakdown */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.priceHeader}
                        onPress={() => {
                            const newValue = !showPriceBreakdown;
                            setShowPriceBreakdown(newValue);
                            Animated.timing(priceBreakdownAnim, {
                                toValue: newValue ? 1 : 0,
                                duration: 200,
                                useNativeDriver: false,
                            }).start();
                        }}
                    >
                        <Text style={styles.sectionTitle}>Price</Text>
                        <View style={styles.priceHeaderRight}>
                            <Text style={styles.totalPrice}>${pricing.total}</Text>
                            <Ionicons
                                name={showPriceBreakdown ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#A77BFF"
                            />
                        </View>
                    </TouchableOpacity>

                    <Animated.View
                        style={[{
                            opacity: priceBreakdownAnim,
                            maxHeight: priceBreakdownAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 150]
                            }),
                            overflow: 'hidden',
                        }]}
                    >
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Base Fare</Text>
                            <Text style={styles.priceValue}>${pricing.basePrice.toFixed(2)}</Text>
                        </View>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Service Fee</Text>
                            <Text style={styles.priceValue}>${pricing.serviceFee.toFixed(2)}</Text>
                        </View>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Tax</Text>
                            <Text style={styles.priceValue}>${pricing.tax.toFixed(2)}</Text>
                        </View>
                    </Animated.View>
                </View>

                {/* Payment Method */}
                <TouchableOpacity style={styles.section} onPress={handlePaymentMethodPress}>
                    <View style={styles.paymentRow}>
                        <View style={styles.paymentLeft}>
                            <Ionicons
                                name={paymentDisplay.icon}
                                size={24}
                                color={defaultPaymentMethod ? "#00D4AA" : "#A77BFF"}
                            />
                            <View style={styles.paymentInfo}>
                                <Text style={[
                                    styles.paymentText,
                                    !defaultPaymentMethod && styles.paymentTextHighlight
                                ]}>
                                    {paymentDisplay.text}
                                </Text>
                                <Text style={styles.paymentSubtext}>{paymentDisplay.subtext}</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </View>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        (processing || paymentLoading) && styles.confirmButtonDisabled,
                    ]}
                    onPress={handleSchedule}
                    disabled={processing || paymentLoading}
                >
                    {processing || paymentLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Add Payment Modal */}
            <AddPaymentMethodModal
                visible={addPaymentModalVisible}
                onClose={() => setAddPaymentModalVisible(false)}
                onSuccess={() => {
                    setAddPaymentModalVisible(false);
                    setTimeout(handleSchedule, 500);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0A0A1F",
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1A1A2E",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    section: {
        backgroundColor: "#141426",
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#2A2A3B",
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    locationText: {
        color: "#eee",
        fontSize: 14,
        marginLeft: 10,
        flex: 1,
        lineHeight: 20,
    },
    dotLine: {
        flexDirection: "column",
        alignItems: "center",
        paddingVertical: 4,
        marginLeft: 5,
    },
    dot: {
        width: 2,
        height: 2,
        backgroundColor: "#666",
        borderRadius: 1,
        marginVertical: 2,
    },
    tripMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#2A2A3B",
    },
    tripMetaText: {
        color: "#888",
        fontSize: 13,
    },
    tripMetaDivider: {
        color: "#888",
        fontSize: 13,
        marginHorizontal: 8,
    },
    vehicleRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    vehicleImage: {
        width: 60,
        height: 35,
        resizeMode: "contain",
        marginRight: 12,
    },
    vehicleInfo: {
        flex: 1,
    },
    vehicleType: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    vehicleEta: {
        color: "#888",
        fontSize: 13,
        marginTop: 2,
    },
    priceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    priceHeaderRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    totalPrice: {
        color: "#A77BFF",
        fontSize: 20,
        fontWeight: "bold",
        marginRight: 8,
    },
    priceRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
    },
    priceLabel: {
        color: "#888",
        fontSize: 14,
    },
    priceValue: {
        color: "#fff",
        fontSize: 14,
    },
    paymentRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    paymentLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    paymentInfo: {
        marginLeft: 12,
        flex: 1,
    },
    paymentText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "500",
    },
    paymentTextHighlight: {
        color: "#A77BFF",
    },
    paymentSubtext: {
        color: "#888",
        fontSize: 12,
        marginTop: 2,
    },
    bottomContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: "#0A0A1F",
        borderTopWidth: 1,
        borderTopColor: "#1A1A2E",
    },
    confirmButton: {
        backgroundColor: "#A77BFF",
        borderRadius: 25,
        paddingVertical: 16,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    confirmButtonDisabled: {
        backgroundColor: "#444",
    },
    confirmButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },
});
