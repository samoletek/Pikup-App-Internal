import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ComingSoonScreen from "../../components/ComingSoonScreen";

export default function PaymentMethodsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ComingSoonScreen
      navigation={navigation}
      title="Payment Methods"
      topInset={insets.top}
      iconName="card-outline"
    />
  );
}
