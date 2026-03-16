import { useCallback, useState } from "react";
import { Alert } from "react-native";

export default function usePaymentMethodsActions({
  defaultPaymentMethod,
  removePaymentMethod,
  setDefault,
}) {
  const [addModalVisible, setAddModalVisible] = useState(false);

  const handleSetDefault = useCallback(async (method) => {
    if (defaultPaymentMethod?.id === method.id) {
      return;
    }

    const result = await setDefault(method);
    if (!result.success) {
      Alert.alert("Unable to update", result.error || "Failed to set default payment method.");
    }
  }, [defaultPaymentMethod?.id, setDefault]);

  const handleRemoveMethod = useCallback((method) => {
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
  }, [removePaymentMethod]);

  return {
    addModalVisible,
    handleRemoveMethod,
    handleSetDefault,
    setAddModalVisible,
  };
}
