// Add Payment Method Modal component: renders its UI and handles related interactions.
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Keyboard,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { usePayment } from "../contexts/PaymentContext";
import BaseModal from "./BaseModal";
import AppButton from "./ui/AppButton";
import { colors } from "../styles/theme";
import { logger } from "../services/logger";
import styles from "./AddPaymentMethodModal.styles";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AddPaymentMethodModal({ visible, onClose, onSuccess }) {
  const [cardDetails, setCardDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();
  const { savePaymentMethod } = usePayment();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCardDetails(null);
      setLoading(false);
    }
  }, [visible]);

  const handleAddCard = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Invalid Card', 'Please enter complete card details.');
      return;
    }

    const postalCode = String(cardDetails?.postalCode || '').trim();
    const postalDigits = postalCode.replace(/\D/g, '');
    if (postalCode && (postalCode !== postalDigits || ![5, 9].includes(postalDigits.length))) {
      Alert.alert('Invalid ZIP Code', 'Please enter a valid US ZIP code using digits only.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      // Create payment method with Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        paymentMethodType: 'Card',
        card: cardDetails,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Stripe SDK shape differs by version:
      // newer builds expose `card`, older ones expose `Card`.
      const stripeCardInfo = paymentMethod?.card || paymentMethod?.Card || {};
      const resolvedBrand = stripeCardInfo.brand || cardDetails?.brand;
      const resolvedLast4 = stripeCardInfo.last4 || cardDetails?.last4;
      const resolvedExpMonth = stripeCardInfo.expMonth ?? cardDetails?.expiryMonth;
      const resolvedExpYear = stripeCardInfo.expYear ?? cardDetails?.expiryYear;

      if (!resolvedLast4 || !resolvedExpMonth || !resolvedExpYear) {
        throw new Error('Unable to read card details. Please try adding the card again.');
      }

      // Create payment method object for our app
      const newPaymentMethod = {
        id: paymentMethod.id,
        type: 'card',
        brand: resolvedBrand && resolvedBrand !== 'Unknown' ? resolvedBrand : 'card',
        last4: resolvedLast4,
        expMonth: resolvedExpMonth,
        expYear: resolvedExpYear,
        stripePaymentMethodId: paymentMethod.id,
        createdAt: new Date().toISOString(),
      };

      logger.info('AddPaymentMethodModal', 'Created payment method', newPaymentMethod);

      // Save to our payment context
      const result = await savePaymentMethod(newPaymentMethod);

      if (result.success) {
        Alert.alert(
          'Success',
          'Payment method added successfully!',
          [{
            text: 'OK',
            onPress: () => {
              // Call success callback then close
              if (onSuccess) onSuccess();
              onClose();
            }
          }]
        );
      } else {
        throw new Error(result.error || 'Failed to save payment method');
      }
    } catch (error) {
      logger.error('AddPaymentMethodModal', 'Error adding payment method', error);
      Alert.alert('Error', error.message || 'Failed to add payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = (closeModal) => (
    <View style={styles.header}>
      <View style={styles.headerBtnPlaceholder} />
      <Text style={styles.headerTitle}>Add Payment Method</Text>
      <TouchableOpacity onPress={closeModal} style={styles.headerBtn}>
        <Ionicons name="close" size={24} color={colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      height={SCREEN_HEIGHT * 0.75}
      backgroundColor={colors.background.secondary}
      renderHeader={renderHeader}
      showHandle={true}
    >
      {() => (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.content}>
            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.securityText}>
                Powered by Stripe
              </Text>
            </View>

            {/* Card Input Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionLabel}>Card Details</Text>

              <View style={styles.cardFieldContainer}>
                <CardField
                  postalCodeEnabled={true}
                  countryCode="US"
                  placeholders={{
                    number: '0000 0000 0000 0000',
                    expiration: 'MM/YY',
                    cvc: 'CVC',
                    postalCode: 'ZIP Code',
                  }}
                  cardStyle={styles.cardField}
                  style={styles.cardFieldWrapper}
                  onCardChange={(cardDetails) => {
                    setCardDetails(cardDetails);
                  }}
                />
              </View>

              {/* Supported Brands */}
              <View style={styles.brandsContainer}>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>VISA</Text>
                </View>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>Mastercard</Text>
                </View>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>Amex</Text>
                </View>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandText}>Discover</Text>
                </View>
              </View>
            </View>

            {/* Features */}
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.border.light} />
                <Text style={styles.featureText}>Instant verification</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.border.light} />
                <Text style={styles.featureText}>Secure storage</Text>
              </View>
            </View>

            {/* Action Button */}
            <View style={styles.footer}>
              <AppButton
                title="Add Payment Method"
                onPress={handleAddCard}
                loading={loading}
                disabled={!cardDetails?.complete}
                style={[styles.btn, styles.btnPrimary]}
                labelStyle={styles.btnText}
                leftIcon={<Ionicons name="add-circle-outline" size={20} color={colors.text.primary} />}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </BaseModal>
  );
}
