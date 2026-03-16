import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import AddPaymentMethodModal from "../../components/AddPaymentMethodModal";
import AppButton from "../../components/ui/AppButton";
import { usePayment } from "../../contexts/PaymentContext";
import {
  layout,
  spacing,
  colors,
} from "../../styles/theme";
import styles from "./PaymentMethodsScreen.styles";
import usePaymentMethodsActions from "./usePaymentMethodsActions";

export default function PaymentMethodsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(layout.contentMaxWidth, width - spacing.xl);

  const {
    paymentMethods,
    defaultPaymentMethod,
    setDefault,
    removePaymentMethod,
    loading,
  } = usePayment();
  const methods = paymentMethods || [];

  const {
    addModalVisible,
    handleRemoveMethod,
    handleSetDefault,
    setAddModalVisible,
  } = usePaymentMethodsActions({
    defaultPaymentMethod,
    removePaymentMethod,
    setDefault,
  });

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

          <AppButton
            title={loading ? "Loading..." : "Add Payment Method"}
            style={[styles.addButton, loading && styles.addButtonDisabled]}
            onPress={() => setAddModalVisible(true)}
            disabled={loading}
            leftIcon={<Ionicons name="add-circle-outline" size={20} color={colors.white} />}
          />

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
