import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ComingSoonScreen from "../../components/ComingSoonScreen";

export default function CustomerSafetyScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ComingSoonScreen
      navigation={navigation}
      title="Safety"
      topInset={insets.top}
      iconName="shield-checkmark-outline"
    />
  );
}
