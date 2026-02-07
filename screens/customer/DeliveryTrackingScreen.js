import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ComingSoonScreen from "../../components/ComingSoonScreen";

export default function DeliveryTrackingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ComingSoonScreen
      navigation={navigation}
      title="Delivery Tracking"
      topInset={insets.top}
      iconName="navigate-outline"
    />
  );
}
