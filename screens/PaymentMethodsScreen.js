import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePayment } from '../contexts/PaymentContext';
import AddPaymentMethodModal from '../components/AddPaymentMethodModal';

export default function PaymentMethodsScreen({ navigation, route }) {
  const { paymentMethods, defaultPaymentMethod, removePaymentMethod, setDefault } = usePayment();
  const [addModalVisible, setAddModalVisible] = useState(false);
  
  // Get route params for return navigation
  const returnTo = route?.params?.returnTo;
  const bookingContext = route?.params?.bookingContext;

  const handleRemovePaymentMethod = (methodId, isDefault) => {
    if (isDefault && paymentMethods.length > 1) {
      Alert.alert(
        'Remove Default Payment Method',
        'This is your default payment method. Another method will be set as default.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removePaymentMethod(methodId),
          },
        ]
      );
    } else if (paymentMethods.length === 1) {
      Alert.alert(
        'Remove Payment Method',
        'You need at least one payment method for pickups.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Remove Payment Method',
        'Are you sure you want to remove this payment method?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removePaymentMethod(methodId),
          },
        ]
      );
    }
  };

  const handleSetDefault = (paymentMethod) => {
    setDefault(paymentMethod);
  };

  // Handle back navigation with context preservation
  const handleBack = () => {
    if (returnTo === 'PriceSummary' && bookingContext) {
      // Return to CustomerHomeScreen with booking context
      navigation.navigate('CustomerHomeScreen', {
        returnFromPayment: true,
        bookingContext: bookingContext
      });
    } else {
      // Regular back navigation
      navigation.goBack();
    }
  };

  // Handle successful payment method addition
  const handlePaymentMethodAdded = () => {
    setAddModalVisible(false);
    
    // If we came from the booking flow, return to price summary
    if (returnTo === 'PriceSummary' && bookingContext) {
      setTimeout(() => {
        navigation.navigate('CustomerHomeScreen', {
          returnFromPayment: true,
          bookingContext: bookingContext
        });
      }, 500); // Small delay to ensure modal closes
    }
  };

  const getCardIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'card';
      case 'mastercard':
        return 'card';
      case 'amex':
        return 'card';
      default:
        return 'card-outline';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={24} color="#00D4AA" />
          </TouchableOpacity>
        </View>

        {/* Payment Methods List */}
        <View style={styles.methodsContainer}>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={64} color="#666" />
              <Text style={styles.emptyTitle}>No Payment Methods</Text>
              <Text style={styles.emptySubtitle}>
                Add a payment method to start using PikUp
              </Text>
              <TouchableOpacity
                style={styles.addFirstButton}
                onPress={() => setAddModalVisible(true)}
              >
                <Text style={styles.addFirstButtonText}>Add Payment Method</Text>
              </TouchableOpacity>
            </View>
          ) : (
            paymentMethods.map((method) => {
              const isDefault = defaultPaymentMethod?.id === method.id;
              return (
                <View key={method.id} style={styles.methodCard}>
                  <View style={styles.methodRow}>
                    <View style={styles.methodLeft}>
                      <View style={styles.cardIconContainer}>
                        <Ionicons
                          name={getCardIcon(method.brand)}
                          size={24}
                          color="#00D4AA"
                        />
                      </View>
                      <View style={styles.methodInfo}>
                        <Text style={styles.methodType}>
                          {method.brand?.toUpperCase()} •••• {method.last4}
                        </Text>
                        <Text style={styles.methodExpiry}>
                          Expires {method.expMonth}/{method.expYear}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.methodActions}>
                      {isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultText}>Default</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleRemovePaymentMethod(method.id, isDefault)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!isDefault && (
                    <TouchableOpacity
                      style={styles.makeDefaultButton}
                      onPress={() => handleSetDefault(method)}
                    >
                      <Text style={styles.makeDefaultText}>Make Default</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={24} color="#00D4AA" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Secure Payments</Text>
              <Text style={styles.infoText}>
                Your payment information is encrypted and secure. We never store your full card details.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="time" size={24} color="#A77BFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Automatic Billing</Text>
              <Text style={styles.infoText}>
                You'll be charged automatically when your pickup is completed.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={handlePaymentMethodAdded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#141426',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  addFirstButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  methodCard: {
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: '#1A1A3A',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  methodExpiry: {
    color: '#999',
    fontSize: 14,
  },
  methodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defaultBadge: {
    backgroundColor: '#1A3A2E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    color: '#00D4AA',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  makeDefaultButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1A1A3A',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  makeDefaultText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 18,
  },
});