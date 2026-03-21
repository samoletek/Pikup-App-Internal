import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { openDriverCustomerChat } from "../screens/driver/navigationChat.utils";
import { logger } from "../services/logger";

export default function useDriverTripChat({
  requestData,
  routeRequest,
  getRequestById,
  getUserProfile,
  currentUserId,
  customerIdHint = null,
  driverIdHint = null,
  customerNameHint = null,
  driverNameHint = null,
  createConversation,
  navigation,
  clearUnread,
  errorMessage = "Could not open chat. Please try again.",
}) {
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const openChat = useCallback(async () => {
    if (isCreatingChat) {
      return false;
    }

    setIsCreatingChat(true);
    try {
      if (typeof clearUnread === "function") {
        clearUnread();
      }

      const didOpen = await openDriverCustomerChat({
        requestData,
        routeRequest,
        getRequestById,
        getUserProfile,
        currentUserId,
        customerIdHint,
        driverIdHint,
        customerNameHint,
        driverNameHint,
        createConversation,
        navigation,
      });

      if (!didOpen) {
        Alert.alert("Error", errorMessage);
      }

      return didOpen;
    } catch (error) {
      logger.error("DriverTripChat", "openChat error", error);
      Alert.alert("Error", errorMessage);
      return false;
    } finally {
      setIsCreatingChat(false);
    }
  }, [
    clearUnread,
    createConversation,
    currentUserId,
    customerIdHint,
    customerNameHint,
    driverIdHint,
    driverNameHint,
    errorMessage,
    getRequestById,
    getUserProfile,
    isCreatingChat,
    navigation,
    requestData,
    routeRequest,
  ]);

  return {
    isCreatingChat,
    openChat,
  };
}
