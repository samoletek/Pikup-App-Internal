import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePayment } from '../../contexts/PaymentContext';
import { useAuthIdentity } from '../../contexts/AuthContext';
import AddPaymentMethodModal from '../../components/AddPaymentMethodModal';
import PhoneVerificationModal from '../../components/PhoneVerificationModal';
import ScreenHeader from '../../components/ScreenHeader';
import AppButton from '../../components/ui/AppButton';
import { logger } from '../../services/logger';
import styles from './OrderSummaryScreen.styles';
import { getPaymentMethodDisplay, getPricingData } from './orderSummary.utils';
import {
  colors,
  layout,
  spacing,
} from '../../styles/theme';
import { isPhoneVerified } from '../../utils/profileFlags';

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

  const { currentUser, refreshProfile } = useAuthIdentity();

  const [addPaymentModalVisible, setAddPaymentModalVisible] = useState(false);
  const [phoneVerifyVisible, setPhoneVerifyVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [priceBreakdownAnim] = useState(new Animated.Value(0));
  const {
    defaultPaymentMethod,
    paymentMethods,
    loading: paymentLoading,
  } = usePayment();

  const handleScheduleRef = useRef(null);

  const handleSchedule = useCallback(async () => {
    if (!isPhoneVerified(currentUser)) {
      Alert.alert(
        'Phone Verification Required',
        'Please verify your phone number before requesting a pickup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify Now',
            onPress: () => setPhoneVerifyVisible(true),
          },
        ]
      );
      return;
    }

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
      navigation.replace('CustomerTabs', {
        screen: 'Home',
      });
    } catch (error) {
      logger.error('OrderSummaryScreen', 'Order confirmation failed', error);
      Alert.alert(
        'Order Issue',
        error.message || "We couldn't confirm your order. Please try again.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => setTimeout(() => handleScheduleRef.current?.(), 500) },
        ]
      );
    } finally {
      setProcessing(false);
    }
  }, [currentUser, defaultPaymentMethod, paymentMethods, navigation]);

  handleScheduleRef.current = handleSchedule;

  const handlePaymentMethodPress = () => {
    if (paymentMethods.length === 0) {
      setAddPaymentModalVisible(true);
      return;
    }
    navigation.navigate('PaymentMethodsScreen');
  };

  const pricing = getPricingData(selectedVehicle);
  const paymentDisplay = getPaymentMethodDisplay(defaultPaymentMethod);

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
          <AppButton
            title="Confirm Payment"
            style={[styles.confirmButton, (processing || paymentLoading) && styles.confirmButtonDisabled]}
            onPress={handleSchedule}
            disabled={processing || paymentLoading}
            loading={processing || paymentLoading}
            leftIcon={<Ionicons name="checkmark-circle" size={20} color={colors.white} style={styles.confirmIcon} />}
          />
        </View>
      </View>

      <AddPaymentMethodModal
        visible={addPaymentModalVisible}
        onClose={() => setAddPaymentModalVisible(false)}
        onSuccess={() => {
          setAddPaymentModalVisible(false);
          setTimeout(() => handleScheduleRef.current?.(), 500);
        }}
      />

      <PhoneVerificationModal
        visible={phoneVerifyVisible}
        onClose={() => setPhoneVerifyVisible(false)}
        onVerified={async () => {
          setPhoneVerifyVisible(false);
          await refreshProfile();
          setTimeout(() => handleScheduleRef.current?.(), 500);
        }}
        userId={currentUser?.uid || currentUser?.id}
        userTable="customers"
      />
    </View>
  );
}
