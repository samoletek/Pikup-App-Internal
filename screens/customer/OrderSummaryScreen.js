import React, { useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePayment } from '../../contexts/PaymentContext';
import AddPaymentMethodModal from '../../components/AddPaymentMethodModal';
import ScreenHeader from '../../components/ScreenHeader';
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from '../../styles/theme';

export default function OrderSummaryScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(layout.sheetMaxWidth, width - spacing.xl);

  const {
    selectedVehicle,
    selectedLocations = {},
    distance,
    duration,
  } = route.params || {};

  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [priceBreakdownAnim] = useState(new Animated.Value(0));

  const {
    defaultPaymentMethod,
    paymentMethods,
    createPaymentIntent,
    confirmPayment,
    loading: paymentLoading,
  } = usePayment();

  const getPricingData = () => {
    if (selectedVehicle?.pricing) {
      const vehiclePricing = selectedVehicle.pricing;
      return {
        basePrice: vehiclePricing.baseFare + vehiclePricing.mileageCharge,
        serviceFee: vehiclePricing.serviceFee,
        tax:
          vehiclePricing.tax ||
          (vehiclePricing.subtotal + vehiclePricing.serviceFee) * 0.08,
        total: vehiclePricing.total.toFixed(2),
      };
    }

    const basePrice = parseFloat(selectedVehicle?.price?.replace('$', '') || '40.00');
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
        'Payment Method Required',
        'Please add a payment method to confirm your order.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Payment Method',
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
        Math.round(parseFloat(pricing.total) * 100),
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

      navigation.replace('CustomerTabs', {
        screen: 'Home',
      });
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert(
        'Payment Issue',
        error.message || "We couldn't process your payment. Please try again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => setTimeout(() => handleSchedule(), 500) },
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentMethodPress = () => {
    if (paymentMethods.length === 0) {
      setAddPaymentModalVisible(true);
      return;
    }
    navigation.navigate('PaymentMethodsScreen');
  };

  const getPaymentMethodDisplay = () => {
    if (!defaultPaymentMethod) {
      return {
        icon: 'add-circle-outline',
        text: 'Add Payment Method',
        subtext: 'Required for pickup',
      };
    }

    return {
      icon: 'card',
      text: `${(defaultPaymentMethod.brand || defaultPaymentMethod.cardBrand || 'Card').toUpperCase()} •••• ${defaultPaymentMethod.last4}`,
      subtext: `Expires ${defaultPaymentMethod.expMonth}/${defaultPaymentMethod.expYear}`,
    };
  };

  const pricing = getPricingData();
  const paymentDisplay = getPaymentMethodDisplay();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Order Summary"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <View style={styles.locationRow}>
              <Ionicons name="radio-button-on" size={12} color={colors.success} />
              <Text style={styles.locationText} numberOfLines={2}>
                {selectedLocations?.pickup?.address || 'Pickup Location'}
              </Text>
            </View>
            <View style={styles.dotLine}>
              {[...Array(3)].map((_, i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={12} color={colors.primary} />
              <Text style={styles.locationText} numberOfLines={2}>
                {selectedLocations?.dropoff?.address || 'Drop-off Location'}
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Vehicle</Text>
            <View style={styles.vehicleRow}>
              {selectedVehicle?.image && (
                <Image source={selectedVehicle.image} style={styles.vehicleImage} />
              )}
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleType}>{selectedVehicle?.type || 'Vehicle'}</Text>
                <Text style={styles.vehicleEta}>
                  Arrives in {selectedVehicle?.arrival || '15 mins'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.priceHeader}
              onPress={() => {
                const next = !showPriceBreakdown;
                setShowPriceBreakdown(next);
                Animated.timing(priceBreakdownAnim, {
                  toValue: next ? 1 : 0,
                  duration: 200,
                  useNativeDriver: false,
                }).start();
              }}
            >
              <Text style={styles.sectionTitle}>Price</Text>
              <View style={styles.priceHeaderRight}>
                <Text style={styles.totalPrice}>${pricing.total}</Text>
                <Ionicons
                  name={showPriceBreakdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.breakdownContainer,
                {
                  opacity: priceBreakdownAnim,
                  maxHeight: priceBreakdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 150],
                  }),
                },
              ]}
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

          <TouchableOpacity style={styles.section} onPress={handlePaymentMethodPress}>
            <View style={styles.paymentRow}>
              <View style={styles.paymentLeft}>
                <Ionicons
                  name={paymentDisplay.icon}
                  size={24}
                  color={defaultPaymentMethod ? colors.success : colors.primary}
                />
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentText, !defaultPaymentMethod && styles.paymentTextHighlight]}>
                    {paymentDisplay.text}
                  </Text>
                  <Text style={styles.paymentSubtext}>{paymentDisplay.subtext}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + spacing.base }]}>
        <View style={[styles.bottomInner, { maxWidth: contentMaxWidth }]}>
          <TouchableOpacity
            style={[styles.confirmButton, (processing || paymentLoading) && styles.confirmButtonDisabled]}
            onPress={handleSchedule}
            disabled={processing || paymentLoading}
          >
            {processing || paymentLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.white}
                  style={styles.confirmIcon}
                />
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  section: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm + 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
    marginLeft: spacing.sm + 2,
    flex: 1,
    lineHeight: 20,
  },
  dotLine: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginLeft: spacing.xs + 1,
  },
  dot: {
    width: 2,
    height: 2,
    backgroundColor: colors.text.subtle,
    borderRadius: borderRadius.circle,
    marginVertical: 2,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  tripMetaText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
  },
  tripMetaDivider: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    marginHorizontal: spacing.sm,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleImage: {
    width: 60,
    height: 35,
    resizeMode: 'contain',
    marginRight: spacing.md,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleType: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  vehicleEta: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm + 1,
    marginTop: 2,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalPrice: {
    color: colors.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  breakdownContainer: {
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm - 2,
  },
  priceLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
  },
  priceValue: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  paymentText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base + 1,
    fontWeight: typography.fontWeight.medium,
  },
  paymentTextHighlight: {
    color: colors.primary,
  },
  paymentSubtext: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.strong,
  },
  bottomInner: {
    width: "100%",
    alignSelf: "center",
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.base,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.text.subtle,
  },
  confirmIcon: {
    marginRight: spacing.sm,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
