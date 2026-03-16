import { useCallback, useEffect, useState } from "react";
import { logger } from "../services/logger";

const MESSAGE_PAGE_SIZE = 20;

export default function useConversationMessages({
  conversationId,
  currentUserId,
  userType,
  subscribeToMessages,
  markMessageAsRead,
  loadOlderMessages,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setHasMore(true);

    const unsubscribe = subscribeToMessages(
      conversationId,
      (initialMessages) => {
        setMessages((prevMessages) => {
          const pendingMessages = prevMessages.filter(
            (msg) => msg.id?.startsWith("temp-") && msg.status !== "sent"
          );

          return [...initialMessages, ...pendingMessages];
        });

        if (initialMessages.length < MESSAGE_PAGE_SIZE) {
          setHasMore(false);
        }

        setLoading(false);
      },
      (newMessage) => {
        setMessages((prevMessages) => {
          if (prevMessages.some((msg) => msg.id === newMessage.id)) {
            return prevMessages;
          }

          return [...prevMessages, newMessage];
        });
      }
    );

    markMessageAsRead(conversationId, userType);
    return unsubscribe;
  }, [
    conversationId,
    currentUserId,
    markMessageAsRead,
    subscribeToMessages,
    userType,
  ]);

  const handleLoadOlder = useCallback(async () => {
    if (!conversationId || loadingOlder || !hasMore || messages.length === 0) {
      return;
    }

    const oldestMessage = messages[0];
    if (!oldestMessage?.timestamp) {
      return;
    }

    setLoadingOlder(true);
    try {
      const olderMessages = await loadOlderMessages(
        conversationId,
        oldestMessage.timestamp
      );

      if (
        olderMessages.length === 0 ||
        olderMessages.length < MESSAGE_PAGE_SIZE
      ) {
        setHasMore(false);
      }

      if (olderMessages.length > 0) {
        setMessages((prevMessages) => [...olderMessages, ...prevMessages]);
      }
    } catch (error) {
      logger.error("ConversationMessages", "Error loading older messages", error);
    } finally {
      setLoadingOlder(false);
    }
  }, [
    conversationId,
    hasMore,
    loadOlderMessages,
    loadingOlder,
    messages,
  ]);

  return {
    messages,
    setMessages,
    loading,
    loadingOlder,
    hasMore,
    handleLoadOlder,
  };
}
