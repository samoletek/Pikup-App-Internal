import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import AddPaymentMethodModal from "../../components/AddPaymentMethodModal";
import { usePayment } from "../../contexts/PaymentContext";
import {
  borderRadius,
  colors,
  layout,
  spacing,
  typography,
} from "../../styles/theme";

export default function PaymentMethodsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const {
    paymentMethods,
    defaultPaymentMethod,
    setDefault,
    removePaymentMethod,
    loading,
  } = usePayment();

  const methods = paymentMethods || [];

  const handleSetDefault = async (method) => {
    if (defaultPaymentMethod?.id === method.id) return;

    const result = await setDefault(method);
    if (!result.success) {
      Alert.alert("Unable to update", result.error || "Failed to set default payment method.");
    }
  };

  const handleRemoveMethod = (method) => {
    Alert.alert(
      "Remove card?",
      `Remove ${(method.brand || method.cardBrand || "Card").toUpperCase()} •••• ${method.last4}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const result = await removePaymentMethod(method.id);
            if (!result.success) {
              Alert.alert("Unable to remove", result.error || "Failed to remove payment method.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Payment Methods"
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
      >
        <View style={[styles.contentColumn, { maxWidth: contentMaxWidth }]}>
          <View style={styles.card}>
            {methods.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={28} color={colors.text.muted} />
                <Text style={styles.emptyTitle}>No payment methods yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add a card here to use it on the final booking step.
                </Text>
              </View>
            ) : (
              methods.map((method, index) => {
                const brand = method.brand || method.cardBrand || "Card";
                const isDefault = defaultPaymentMethod?.id === method.id;

                return (
                  <View
                    key={method.id}
                    style={[styles.methodRow, index === methods.length - 1 && styles.rowLast]}
                  >
                    <View style={styles.methodInfo}>
                      <View style={styles.iconCircle}>
                        <Ionicons
                          name="card-outline"
                          size={18}
                          color={isDefault ? colors.success : colors.primary}
                        />
                      </View>
                      <View style={styles.methodCopy}>
                        <Text style={styles.methodTitle}>
                          {brand.toUpperCase()} •••• {method.last4}
                        </Text>
                        <Text style={styles.methodSubtitle}>
                          Expires {method.expMonth}/{method.expYear}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.methodActions}>
                      {isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.linkButton}
                          onPress={() => handleSetDefault(method)}
                        >
                          <Text style={styles.linkButtonText}>Set default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleRemoveMethod(method)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <TouchableOpacity
            style={[styles.addButton, loading && styles.addButtonDisabled]}
            onPress={() => setAddModalVisible(true)}
            disabled={loading}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>
              {loading ? "Loading..." : "Add Payment Method"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.helperText}>
            Only saved cards from this screen are available in the final booking step.
          </Text>
        </View>
      </ScrollView>

      <AddPaymentMethodModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={() => {
          setAddModalVisible(false);
        }}
      />
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
  contentColumn: {
    width: "100%",
    alignSelf: "center",
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: "hidden",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  methodInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.tertiary,
    marginRight: spacing.sm,
  },
  methodCopy: {
    flex: 1,
  },
  methodTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  methodSubtitle: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  methodActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    color: colors.success,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  linkButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.errorLight,
  },
  addButton: {
    marginTop: spacing.base,
    height: 54,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  helperText: {
    marginTop: spacing.sm,
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    color: colors.text.muted,
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },
});
