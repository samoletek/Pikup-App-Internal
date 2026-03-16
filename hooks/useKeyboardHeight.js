import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export default function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleKeyboardChange = (event) => {
      const nextKeyboardHeight = Number(event?.endCoordinates?.height || 0);
      setKeyboardHeight(nextKeyboardHeight);
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillChangeFrame", handleKeyboardChange),
            Keyboard.addListener("keyboardWillHide", handleKeyboardHide),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", handleKeyboardChange),
            Keyboard.addListener("keyboardDidHide", handleKeyboardHide),
          ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  return keyboardHeight;
}
