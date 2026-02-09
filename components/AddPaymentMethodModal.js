import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { usePayment } from "../contexts/PaymentContext";
import BaseModal from "./BaseModal";
import { colors, spacing, typography } from "../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use consistent button style from AuthModal
const Button = ({ title, onPress, variant = 'primary', disabled, loading, style, icon }) => {
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? colors.success : 'transparent';
  const textColor = isPrimary ? colors.text.primary : colors.success;
  const borderColor = isPrimary ? 'transparent' : colors.success;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor, borderColor, borderWidth: isPrimary ? 0 : 1, opacity: disabled ? 0.6 : 1 },
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.btnContent}>
          {icon && <Ionicons name={icon} size={20} color={textColor} style={{ marginRight: 8 }} />}
          <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

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

      console.log('Created payment method:', newPaymentMethod);

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
      console.error('Error adding payment method:', error);
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
            <Button
              title="Add Payment Method"
              onPress={handleAddCard}
              loading={loading}
              disabled={!cardDetails?.complete}
              icon="add-circle-outline"
            />
          </View>
        </View>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.base,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successLight,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.success,
  },
  securityText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  cardSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardFieldContainer: {
    backgroundColor: colors.background.input,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 4,
  },
  cardFieldWrapper: {
    height: 50,
    marginVertical: 5,
  },
  cardField: {
    backgroundColor: colors.background.input,
    textColor: colors.text.primary,
    placeholderColor: colors.text.placeholder,
    borderRadius: 30,
    fontSize: 16,
    cursorColor: colors.success,
    textErrorColor: colors.error,
  },
  brandsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  brandBadge: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  brandText: {
    color: colors.text.placeholder,
    fontSize: 10,
    fontWeight: 'bold',
  },
  featuresList: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 'auto',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    color: colors.text.placeholder,
    fontSize: 12,
    marginLeft: 4,
  },
  footer: {
    paddingBottom: 20,
  },
  // Button Styles
  btn: {
    height: 56,
    borderRadius: 30,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
