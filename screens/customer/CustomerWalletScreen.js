import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { usePayment } from "../../contexts/PaymentContext";
import { useAuth } from "../../contexts/AuthContext";
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import { colors } from '../../styles/theme';

const transactionHistory = [
  {
    id: "1",
    type: "trip",
    title: "Trip to Downtown",
    date: "Today, 2:30 PM",
    amount: -24.50,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "2",
    type: "topup",
    title: "Added funds",
    date: "Yesterday, 10:15 AM",
    amount: 50.00,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "3",
    type: "promo",
    title: "Promo credit",
    date: "Jun 12, 9:22 AM",
    amount: 15.00,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "4",
    type: "trip",
    title: "Trip to Airport",
    date: "Jun 10, 5:45 PM",
    amount: -35.75,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "5",
    type: "refund",
    title: "Refund - Trip canceled",
    date: "Jun 8, 3:20 PM",
    amount: 18.25,
    status: TRIP_STATUS.COMPLETED,
  },
];

export default function CustomerWalletScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { paymentMethods, defaultPaymentMethod } = usePayment();
  const { getUserPickupRequests } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactionHistory();
  }, []);

  const loadTransactionHistory = async () => {
    try {
      const userRequests = await getUserPickupRequests();
      const completedTrips = userRequests
        .filter((request) => normalizeTripStatus(request.status) === TRIP_STATUS.COMPLETED)
        .map((request) => {
          const timestamp = request.completedAt || request.createdAt;
          return {
            id: request.id,
            type: 'trip_payment',
            title: `Trip - ${request.dropoffAddress?.split(',')[0] || 'Delivery'}`,
            timestamp,
            date: formatDate(timestamp),
            amount: -(request.pricing?.total || 0),
            status: TRIP_STATUS.COMPLETED,
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10); // Show last 10 transactions
      
      setTransactions(completedTrips.map(({ timestamp, ...transaction }) => transaction));
    } catch (error) {
      console.error('Error loading transaction history:', error);
      // Fallback to mock data if error
      setTransactions(transactionHistory);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (date >= today) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date >= yesterday) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment & Activity</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadTransactionHistory}
            tintColor={colors.primary}
          />
        }
      >

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate("PaymentMethodsScreen")}
            >
              <Text style={styles.seeAllText}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.paymentMethodsContainer}>
            {paymentMethods.map((method) => (
              <TouchableOpacity key={method.id} style={styles.paymentMethod}>
                <View style={styles.paymentIcon}>
                  <Ionicons name="card-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>•••• {method.last4}</Text>
                  <Text style={styles.paymentSubtitle}>Expires {method.expMonth}/{method.expYear}</Text>
                </View>
                {defaultPaymentMethod?.id === method.id && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              style={styles.addPaymentButton}
              onPress={() => navigation.navigate("PaymentMethodsScreen")}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addPaymentText}>Add Payment Method</Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate("CustomerActivityScreen")}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsContainer}>
            {loading ? (
              <Text style={styles.loadingText}>Loading transactions...</Text>
            ) : transactions.length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet</Text>
            ) : (
              transactions.map((transaction) => (
                <TouchableOpacity key={transaction.id} style={styles.transaction}>
                  <View style={styles.transactionIconContainer}>
                    <Ionicons
                      name={
                        transaction.type === "trip_payment"
                          ? "car-outline"
                          : transaction.type === "refund"
                          ? "refresh-outline"
                          : "gift-outline"
                      }
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{transaction.title}</Text>
                    <Text style={styles.transactionDate}>{transaction.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: transaction.amount >= 0 ? colors.success : colors.error },
                    ]}
                  >
                    {transaction.amount >= 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        <View style={[styles.bottomSpacing, { paddingBottom: insets.bottom }]} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    textAlign: "center",
    color: colors.text.tertiary,
    fontSize: 16,
    paddingVertical: 20,
  },
  emptyText: {
    textAlign: "center",
    color: colors.text.tertiary,
    fontSize: 16,
    paddingVertical: 20,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.white,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  paymentMethodsContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.brandTint,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.white,
  },
  paymentSubtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: colors.background.successSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  addPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  addPaymentText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.primary,
    marginLeft: 12,
  },
  pikupCashCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  pikupCashInfo: {
    flex: 1,
  },
  pikupCashTitle: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  pikupCashAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  pikupCashButton: {
    backgroundColor: colors.background.brandTint,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pikupCashButtonText: {
    color: colors.primary,
    fontWeight: "600",
  },
  transactionsContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  transaction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.strong,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.brandTint,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.white,
  },
  transactionDate: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSpacing: {
    height: 40,
  },
}); 
