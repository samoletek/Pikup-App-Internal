// Review Step component: renders summary cards for route, items, pricing, and payment before order confirmation.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { styles } from '../styles';
import { colors } from '../../../styles/theme';
import PaymentMethodsScreen from '../../../screens/customer/PaymentMethodsScreen';
import ReviewHandlingEstimate from './review/ReviewHandlingEstimate';
import ReviewLaborAdjustmentCard from './review/ReviewLaborAdjustmentCard';
import ReviewPriceBreakdownCard from './review/ReviewPriceBreakdownCard';
import ReviewPaymentMethodsCard from './review/ReviewPaymentMethodsCard';
import { useReviewStepPricing } from './review/useReviewStepPricing';

const BOTTOM_SPACER_HEIGHT = 100;

const ReviewStep = ({
  orderData,
  pricing,
  insuranceQuote = null,
  insuranceLoading = false,
  insuranceError = false,
  onLaborAdjustmentChange,
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

  const {
    isSelfHandling,
    laborAdjustment,
    laborSliderConfig,
    currentLaborMinutes,
    displayPricing,
    handlingEstimate,
    handleLaborStep,
  } = useReviewStepPricing({
    orderData,
    pricing,
    onLaborAdjustmentChange,
  });

  void insuranceQuote;

  return (
    <>
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
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

        <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(2)} activeOpacity={0.7}>
          <Text style={styles.summaryCardTitle}>Items ({orderData.items.length})</Text>
          {orderData.items.map((item) => (
            <View key={item.id} style={styles.itemSummaryRow}>
              <Text style={styles.itemSummaryName}>{item.name}</Text>
              <View style={styles.itemSummaryBadges}>
                {item.isFragile && <Text style={styles.fragileTag}>Fragile</Text>}
                {(item.condition === 'new' && item.hasInsurance) && <Text style={styles.insuredTag}>Insured</Text>}
              </View>
            </View>
          ))}

          <ReviewHandlingEstimate
            isSelfHandling={isSelfHandling}
            handlingEstimate={handlingEstimate}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.summaryCard} onPress={() => onNavigateToStep(5)} activeOpacity={0.7}>
          <Text style={styles.summaryCardTitle}>Vehicle</Text>
          <View style={styles.vehicleSummary}>
            <Image source={orderData.selectedVehicle?.image} style={styles.vehicleSummaryImg} />
            <Text style={styles.vehicleSummaryName}>{orderData.selectedVehicle?.type}</Text>
          </View>
        </TouchableOpacity>

        {!isSelfHandling && (
          <ReviewLaborAdjustmentCard
            laborSliderConfig={laborSliderConfig}
            currentLaborMinutes={currentLaborMinutes}
            laborAdjustment={laborAdjustment}
            onLaborStep={handleLaborStep}
          />
        )}

        <ReviewPriceBreakdownCard
          pricing={displayPricing}
          insuranceLoading={insuranceLoading}
          insuranceError={insuranceError}
        />

        <ReviewPaymentMethodsCard
          paymentMethods={paymentMethods}
          selectedPaymentMethod={selectedPaymentMethod}
          defaultPaymentMethodId={defaultPaymentMethodId}
          onSelectPaymentMethod={onSelectPaymentMethod}
          onAddCard={() => setShowPaymentMethodsModal(true)}
        />

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

export default ReviewStep;
