import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePayment } from "../contexts/PaymentContext";
import { useAuth } from "../contexts/AuthContext";

const transactionHistory = [
  {
    id: "1",
    type: "trip",
    title: "Trip to Downtown",
    date: "Today, 2:30 PM",
    amount: -24.50,
    status: "completed",
  },
  {
    id: "2",
    type: "topup",
    title: "Added funds",
    date: "Yesterday, 10:15 AM",
    amount: 50.00,
    status: "completed",
  },
  {
    id: "3",
    type: "promo",
    title: "Promo credit",
    date: "Jun 12, 9:22 AM",
    amount: 15.00,
    status: "completed",
  },
  {
    id: "4",
    type: "trip",
    title: "Trip to Airport",
    date: "Jun 10, 5:45 PM",
    amount: -35.75,
    status: "completed",
  },
  {
    id: "5",
    type: "refund",
    title: "Refund - Trip canceled",
    date: "Jun 8, 3:20 PM",
    amount: 18.25,
    status: "completed",
  },
];

export default function CustomerWalletScreen({ navigation }) {
  const { paymentMethods, defaultPaymentMethod } = usePayment();
  const { currentUser, getUserPickupRequests } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactionHistory();
  }, []);

  const loadTransactionHistory = async () => {
    try {
      const userRequests = await getUserPickupRequests();
      const completedTrips = userRequests
        .filter(request => request.status === 'completed')
        .map(request => ({
          id: request.id,
          type: 'trip_payment',
          title: `Trip - ${request.dropoffAddress?.split(',')[0] || 'Delivery'}`,
          date: formatDate(request.completedAt || request.createdAt),
          amount: -(request.pricing?.total || 0),
          status: 'completed',
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10); // Show last 10 transactions
      
      setTransactions(completedTrips);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
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
            tintColor="#A77BFF"
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
                  <Ionicons name="card-outline" size={24} color="#A77BFF" />
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
              <Ionicons name="add-circle-outline" size={24} color="#A77BFF" />
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
                      color="#A77BFF"
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{transaction.title}</Text>
                    <Text style={styles.transactionDate}>{transaction.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: transaction.amount >= 0 ? "#00D4AA" : "#FF6B6B" },
                    ]}
                  >
                    {transaction.amount >= 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#141426",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
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
    color: "#999",
    fontSize: 16,
    paddingVertical: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
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
    color: "#fff",
  },
  seeAllText: {
    fontSize: 14,
    color: "#A77BFF",
    fontWeight: "500",
  },
  paymentMethodsContainer: {
    backgroundColor: "#141426",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    overflow: "hidden",
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A1F3D",
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
    color: "#fff",
  },
  paymentSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: "#1A3A2E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00D4AA",
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
    color: "#A77BFF",
    marginLeft: 12,
  },
  pikupCashCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141426",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
  },
  pikupCashInfo: {
    flex: 1,
  },
  pikupCashTitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 4,
  },
  pikupCashAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#A77BFF",
  },
  pikupCashButton: {
    backgroundColor: "#2A1F3D",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pikupCashButtonText: {
    color: "#A77BFF",
    fontWeight: "600",
  },
  transactionsContainer: {
    backgroundColor: "#141426",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A3B",
    overflow: "hidden",
  },
  transaction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3B",
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A1F3D",
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
    color: "#fff",
  },
  transactionDate: {
    fontSize: 14,
    color: "#999",
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