import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useMessagingActions = () => {
  const auth = useAuth();

  return useMemo(
    () => ({
      createConversation: auth.createConversation,
      getConversations: auth.getConversations,
      getMessages: auth.getMessages,
      sendMessage: auth.sendMessage,
      subscribeToConversations: auth.subscribeToConversations,
      subscribeToMessages: auth.subscribeToMessages,
      markMessageAsRead: auth.markMessageAsRead,
      loadOlderMessages: auth.loadOlderMessages,
    }),
    [
      auth.createConversation,
      auth.getConversations,
      auth.getMessages,
      auth.sendMessage,
      auth.subscribeToConversations,
      auth.subscribeToMessages,
      auth.markMessageAsRead,
      auth.loadOlderMessages,
    ]
  );
};
