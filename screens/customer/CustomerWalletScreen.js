import React, { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePayment } from "../../contexts/PaymentContext";
import { useAuth } from "../../contexts/AuthContext";
import { TRIP_STATUS, normalizeTripStatus } from "../../constants/tripStatus";
import ScreenHeader from "../../components/ScreenHeader";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

const fallbackTransactions = [
  {
    id: "1",
    type: "trip",
    title: "Trip to Downtown",
    date: "Today, 2:30 PM",
    amount: -24.5,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "2",
    type: "topup",
    title: "Added funds",
    date: "Yesterday, 10:15 AM",
    amount: 50.0,
    status: TRIP_STATUS.COMPLETED,
  },
  {
    id: "3",
    type: "promo",
    title: "Promo credit",
    date: "Jun 12, 9:22 AM",
    amount: 15.0,
    status: TRIP_STATUS.COMPLETED,
  },
];

export default function CustomerWalletScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { paymentMethods, defaultPaymentMethod } = usePayment();
  const { getUserPickupRequests } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

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
            type: "trip_payment",
            title: `Trip - ${request.dropoffAddress?.split(",")[0] || "Delivery"}`,
            timestamp,
            date: formatDate(timestamp),
            amount: -(request.pricing?.total || 0),
            status: TRIP_STATUS.COMPLETED,
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

      setTransactions(completedTrips.map(({ timestamp, ...transaction }) => transaction));
    } catch (error) {
      console.error("Error loading transaction history:", error);
      setTransactions(fallbackTransactions);
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
      return `Today, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }

    if (date >= yesterday) {
      return `Yesterday, ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const methods = paymentMethods || [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Payment and Activity"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadTransactionHistory}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>PAYMENT METHODS</Text>
            </View>

            <View style={styles.card}>
              {methods.length === 0 ? (
                <View style={[styles.paymentRow, styles.rowLast]}>
                  <Text style={styles.emptyText}>No payment methods yet</Text>
                </View>
              ) : (
                methods.map((method, index) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.paymentRow,
                      index === methods.length - 1 && styles.rowLast,
                    ]}
                    onPress={() => navigation.navigate("PaymentMethodsScreen")}
                  >
                    <View style={styles.rowLeft}>
                      <View style={styles.iconCircle}>
                        <Ionicons name="card-outline" size={18} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.rowTitle}>•••• {method.last4}</Text>
                        <Text style={styles.rowSubtitle}>
                          Expires {method.expMonth}/{method.expYear}
                        </Text>
                      </View>
                    </View>

                    {defaultPaymentMethod?.id === method.id ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.text.tertiary}
                      />
                    )}
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity
                style={[styles.paymentRow, styles.addPaymentRow, styles.rowLast]}
                onPress={() => navigation.navigate("PaymentMethodsScreen")}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.addPaymentText}>Add Payment Method</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            </View>

            <View style={styles.card}>
              {loading ? (
                <View style={styles.messageRow}>
                  <Text style={styles.emptyText}>Loading transactions...</Text>
                </View>
              ) : transactions.length === 0 ? (
                <View style={styles.messageRow}>
                  <Text style={styles.emptyText}>No transactions yet</Text>
                </View>
              ) : (
                transactions.map((transaction, index) => (
                  <TouchableOpacity
                    key={transaction.id}
                    style={[
                      styles.transactionRow,
                      index === transactions.length - 1 && styles.rowLast,
                    ]}
                  >
                    <View style={styles.rowLeft}>
                      <View style={styles.iconCircle}>
                        <Ionicons
                          name={
                            transaction.type === "trip_payment"
                              ? "car-outline"
                              : transaction.type === "refund"
                                ? "refresh-outline"
                                : "gift-outline"
                          }
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.rowTitle}>{transaction.title}</Text>
                        <Text style={styles.rowSubtitle}>{transaction.date}</Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.amountText,
                        {
                          color: transaction.amount >= 0 ? colors.success : colors.error,
                        },
                      ]}
                    >
                      {transaction.amount >= 0 ? "+" : ""}$
                      {Math.abs(transaction.amount).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  sectionBlock: {
    marginBottom: spacing.base,
  },
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.background.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  paymentRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  addPaymentRow: {
    minHeight: 52,
  },
  addPaymentText: {
    color: colors.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
  transactionRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  rowTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  rowSubtitle: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    marginTop: 2,
  },
  transactionInfo: {
    flex: 1,
  },
  amountText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.background.successSubtle,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.success,
  },
  defaultBadgeText: {
    color: colors.success,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  messageRow: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.base,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.base,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});
