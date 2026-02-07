import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ComingSoonScreen from "../../components/ComingSoonScreen";

export default function CustomerHelpScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <ComingSoonScreen
      navigation={navigation}
      title="Help"
      topInset={insets.top}
      iconName="help-buoy-outline"
    />
  );
}
