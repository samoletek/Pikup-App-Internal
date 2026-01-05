import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

export default function DriverPaymentSettingsScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [paymentData, setPaymentData] = useState({
    instantPay: false,
    weeklyDeposit: true,
    bankAccount: {
      last4: '1234',
      bankName: 'Chase Bank',
      isDefault: true,
    },
    stripeAccount: {
      connected: true,
      last4: '5678',
      cardBrand: 'visa',
    },
    earnings: {
      weeklyTotal: 847.50,
      availableBalance: 125.30,
      pendingBalance: 45.20,
    },
    instantPayEnabled: true,
    notificationsEnabled: true,
    taxDocuments: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In production, load actual payment data
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      // In production, fetch from your payment service
      console.log('Loading payment data...');
    } catch (error) {
      console.error('Error loading payment data:', error);
    }
  };

  const handleInstantPayToggle = async (value) => {
    setPaymentData(prev => ({ ...prev, instantPay: value }));
    // In production, update the setting via API
  };

  const handleNotificationsToggle = async (value) => {
    setPaymentData(prev => ({ ...prev, notificationsEnabled: value }));
    // In production, update the setting via API
  };

  const handleAddBankAccount = () => {
    Alert.alert(
      'Add Bank Account',
      'You will be redirected to Stripe to securely add your bank account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => console.log('Open Stripe Connect') }
      ]
    );
  };

  const handleInstantPayout = () => {
    if (!paymentData.instantPayEnabled) {
      Alert.alert(
        'Instant Pay Unavailable',
        'Instant Pay is not available for your account. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Instant Payout',
      `Transfer $${paymentData.earnings.availableBalance.toFixed(2)} to your bank account?\n\nFee: $0.50`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Transfer', 
          onPress: () => {
            setLoading(true);
            // Simulate instant payout
            setTimeout(() => {
              setLoading(false);
              Alert.alert('Success', 'Your payout is being processed!');
            }, 2000);
          }
        }
      ]
    );
  };

  const handleViewTaxDocs = () => {
    Alert.alert(
      'Tax Documents',
      'Your tax documents will be available at the end of the tax year.',
      [{ text: 'OK' }]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Payment Support',
      'Need help with payments? Contact our support team.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact Support', onPress: () => console.log('Open support') }
      ]
    );
  };

  const renderEarningsCard = () => (
    <View style={styles.earningsCard}>
      <LinearGradient
        colors={['#A77BFF', '#6B46C1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.earningsGradient}
      >
        <View style={styles.earningsHeader}>
          <Text style={styles.earningsTitle}>Weekly Earnings</Text>
          <Ionicons name="trending-up" size={24} color="#fff" />
        </View>
        
        <Text style={styles.earningsAmount}>
          ${paymentData.earnings.weeklyTotal.toFixed(2)}
        </Text>
        
        <View style={styles.earningsBreakdown}>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Available</Text>
            <Text style={styles.earningsValue}>
              ${paymentData.earnings.availableBalance.toFixed(2)}
            </Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Pending</Text>
            <Text style={styles.earningsValue}>
              ${paymentData.earnings.pendingBalance.toFixed(2)}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderPaymentMethod = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payment Method</Text>
      
      <View style={styles.paymentMethodCard}>
        <View style={styles.paymentMethodLeft}>
          <View style={styles.bankIcon}>
            <Ionicons name="card-outline" size={24} color="#00D4AA" />
          </View>
          <View style={styles.paymentMethodInfo}>
            <Text style={styles.paymentMethodName}>
              {paymentData.bankAccount.bankName}
            </Text>
            <Text style={styles.paymentMethodDetails}>
              •••• {paymentData.bankAccount.last4}
            </Text>
          </View>
        </View>
        
        <View style={styles.paymentMethodRight}>
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={16} color="#A77BFF" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={handleAddBankAccount}>
        <Ionicons name="add" size={20} color="#A77BFF" />
        <Text style={styles.addButtonText}>Add Bank Account</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInstantPay = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Instant Pay</Text>
      
      <View style={styles.instantPayCard}>
        <View style={styles.instantPayHeader}>
          <View style={styles.instantPayLeft}>
            <View style={styles.instantPayIcon}>
              <Ionicons name="flash" size={20} color="#00D4AA" />
            </View>
            <View>
              <Text style={styles.instantPayTitle}>Cash Out Instantly</Text>
              <Text style={styles.instantPaySubtitle}>
                Available: ${paymentData.earnings.availableBalance.toFixed(2)}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.instantPayButton,
              !paymentData.instantPayEnabled && styles.instantPayButtonDisabled
            ]}
            onPress={handleInstantPayout}
            disabled={loading || !paymentData.instantPayEnabled}
          >
            <Text style={[
              styles.instantPayButtonText,
              !paymentData.instantPayEnabled && styles.instantPayButtonTextDisabled
            ]}>
              {loading ? 'Processing...' : 'Cash Out'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.instantPayFee}>
          Small fee applies ($0.50). Money arrives in minutes.
        </Text>
      </View>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Settings</Text>
      
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="flash-outline" size={20} color="#A77BFF" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Instant Pay</Text>
              <Text style={styles.settingSubtitle}>
                Get paid instantly after each delivery
              </Text>
            </View>
          </View>
          <Switch
            value={paymentData.instantPay}
            onValueChange={handleInstantPayToggle}
            thumbColor={paymentData.instantPay ? '#00D4AA' : '#666'}
            trackColor={{ false: '#2A2A3B', true: '#00D4AA40' }}
          />
        </View>

        <View style={styles.settingDivider} />

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications-outline" size={20} color="#A77BFF" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Payment Notifications</Text>
              <Text style={styles.settingSubtitle}>
                Get notified when you receive payments
              </Text>
            </View>
          </View>
          <Switch
            value={paymentData.notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            thumbColor={paymentData.notificationsEnabled ? '#00D4AA' : '#666'}
            trackColor={{ false: '#2A2A3B', true: '#00D4AA40' }}
          />
        </View>

        <View style={styles.settingDivider} />

        <TouchableOpacity style={styles.settingRow} onPress={handleViewTaxDocs}>
          <View style={styles.settingLeft}>
            <Ionicons name="document-text-outline" size={20} color="#A77BFF" />
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Tax Documents</Text>
              <Text style={styles.settingSubtitle}>
                View and download tax forms
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Settings</Text>
          <TouchableOpacity style={styles.helpButton} onPress={handleContactSupport}>
            <Ionicons name="help-circle-outline" size={24} color="#A77BFF" />
          </TouchableOpacity>
        </View>

        {/* Earnings Card */}
        {renderEarningsCard()}

        {/* Payment Method */}
        {renderPaymentMethod()}

        {/* Instant Pay */}
        {renderInstantPay()}

        {/* Settings */}
        {renderSettings()}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141426',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141426',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  earningsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  earningsGradient: {
    padding: 24,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  earningsBreakdown: {
    gap: 8,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  paymentMethodCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00D4AA20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  paymentMethodDetails: {
    fontSize: 14,
    color: '#999',
  },
  paymentMethodRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  defaultBadge: {
    backgroundColor: '#00D4AA20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D4AA',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A77BFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A77BFF',
    marginLeft: 8,
  },
  instantPayCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  instantPayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  instantPayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  instantPayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D4AA20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instantPayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  instantPaySubtitle: {
    fontSize: 14,
    color: '#999',
  },
  instantPayButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  instantPayButtonDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  instantPayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  instantPayButtonTextDisabled: {
    color: '#666',
  },
  instantPayFee: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  settingsCard: {
    backgroundColor: '#141426',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#2A2A3B',
    marginHorizontal: 20,
  },
  bottomSpacing: {
    height: 40,
  },
}); 