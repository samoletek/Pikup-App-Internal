import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { usePayment } from '../contexts/PaymentContext';

const { height } = Dimensions.get('window');

export default function AddPaymentMethodModal({ visible, onClose }) {
  const [cardDetails, setCardDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const stripe = useStripe();
  const { savePaymentMethod } = usePayment();

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: height,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.spring(slideAnim, {
      toValue: height,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      onClose();
      // Reset form
      setCardDetails(null);
    });
  };

  const handleAddCard = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Invalid Card', 'Please enter complete card details.');
      return;
    }

    setLoading(true);

    try {
      // Create payment method with Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        paymentMethodType: 'Card',
        card: cardDetails,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Safely access card properties with fallbacks
      const cardInfo = paymentMethod?.card || {};
      
      // Create payment method object for our app
      const newPaymentMethod = {
        id: paymentMethod.id,
        type: 'card',
        brand: cardInfo.brand || 'card',
        last4: cardInfo.last4 || '****',
        expMonth: cardInfo.expMonth || 1,
        expYear: cardInfo.expYear || 2025,
        stripePaymentMethodId: paymentMethod.id,
        createdAt: new Date().toISOString(),
      };

      console.log('Created payment method:', newPaymentMethod);

      // Save to our payment context
      const result = await savePaymentMethod(newPaymentMethod);

      if (result.success) {
        Alert.alert(
          'Payment Method Added',
          'Your card has been added successfully!',
          [{ text: 'OK', onPress: handleClose }]
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      {/* Backdrop */}
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.backdropOverlay} />
      </TouchableOpacity>

      {/* Modal Content */}
      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Add Payment Method</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={20} color="#00D4AA" />
            <Text style={styles.securityText}>
              Your payment information is encrypted and secure
            </Text>
          </View>

          {/* Card Input Section */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Card Information</Text>
            
            <View style={styles.cardFieldContainer}>
              <CardField
                postalCodeEnabled={true}
                placeholders={{
                  number: '4242 4242 4242 4242',
                  expiration: 'MM/YY',
                  cvc: 'CVC',
                  postalCode: '12345',
                }}
                cardStyle={styles.cardField}
                style={styles.cardFieldWrapper}
                onCardChange={(cardDetails) => {
                  setCardDetails(cardDetails);
                }}
              />
            </View>

            {/* Card Brands */}
            <View style={styles.cardBrands}>
              <Text style={styles.cardBrandsText}>We accept:</Text>
              <View style={styles.brandIcons}>
                <View style={styles.brandIcon}>
                  <Text style={styles.brandText}>VISA</Text>
                </View>
                <View style={styles.brandIcon}>
                  <Text style={styles.brandText}>MC</Text>
                </View>
                <View style={styles.brandIcon}>
                  <Text style={styles.brandText}>AMEX</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Features */}
          <View style={styles.featuresSection}>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={16} color="#00D4AA" />
              <Text style={styles.featureText}>Fast and secure payments</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="refresh" size={16} color="#00D4AA" />
              <Text style={styles.featureText}>Easy to update or remove</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="lock-closed" size={16} color="#00D4AA" />
              <Text style={styles.featureText}>Bank-level encryption</Text>
            </View>
          </View>
        </View>

        {/* Add Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[
              styles.addButton,
              (!cardDetails?.complete || loading) && styles.addButtonDisabled
            ]} 
            onPress={handleAddCard}
            disabled={!cardDetails?.complete || loading}
          >
            {loading ? (
              <Text style={styles.addButtonText}>Adding...</Text>
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Payment Method</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A3A2E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  securityText: {
    color: '#00D4AA',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  cardSection: {
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  cardFieldContainer: {
    backgroundColor: '#1A1A3A',
    borderRadius: 8,
    marginBottom: 16,
  },
  cardFieldWrapper: {
    height: 50,
  },
  cardField: {
    backgroundColor: '#1A1A3A',
    textColor: '#FFFFFF',
    placeholderColor: '#666666',
    borderRadius: 8,
    fontSize: 16,
  },
  cardBrands: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBrandsText: {
    color: '#999',
    fontSize: 14,
  },
  brandIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  brandIcon: {
    backgroundColor: '#1A1A3A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  brandText: {
    color: '#999',
    fontSize: 10,
    fontWeight: 'bold',
  },
  featuresSection: {
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#0A0A1F',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3B',
  },
  addButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 25,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});