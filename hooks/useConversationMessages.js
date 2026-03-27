import { useCallback, useEffect, useState } from "react";
import { logger } from "../services/logger";

const MESSAGE_PAGE_SIZE = 20;
const TEMP_MESSAGE_ID_PREFIX = "temp-";
const SERVER_MATCH_WINDOW_MS = 30 * 1000;

const dedupeMessagesById = (list = []) => {
  const seen = new Set();
  const deduped = [];

  (Array.isArray(list) ? list : []).forEach((message) => {
    const messageId = String(message?.id || "").trim();
    if (!messageId) {
      deduped.push(message);
      return;
    }

    if (seen.has(messageId)) {
      return;
    }

    seen.add(messageId);
    deduped.push(message);
  });

  return deduped;
};

const toTimestampMs = (value) => {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const normalizeType = (value) => String(value || "text").trim().toLowerCase();
const normalizeText = (value) => String(value || "").trim();

const isPendingTempMessage = (message) => {
  const messageId = String(message?.id || "");
  return messageId.startsWith(TEMP_MESSAGE_ID_PREFIX) && message?.status !== "sent";
};

const isServerMatchForPending = (pendingMessage, serverMessage) => {
  if (!isPendingTempMessage(pendingMessage) || !serverMessage?.id) {
    return false;
  }

  if (String(pendingMessage?.senderId || "") !== String(serverMessage?.senderId || "")) {
    return false;
  }

  const pendingType = normalizeType(pendingMessage?.messageType);
  const serverType = normalizeType(serverMessage?.messageType);
  if (pendingType !== serverType) {
    return false;
  }

  const pendingCreatedAtMs = toTimestampMs(
    pendingMessage?.timestamp || pendingMessage?.createdAt
  );
  const serverCreatedAtMs = toTimestampMs(
    serverMessage?.timestamp || serverMessage?.createdAt
  );

  if (!Number.isFinite(pendingCreatedAtMs) || !Number.isFinite(serverCreatedAtMs)) {
    return false;
  }
  if (Math.abs(serverCreatedAtMs - pendingCreatedAtMs) > SERVER_MATCH_WINDOW_MS) {
    return false;
  }

  if (pendingType === "text") {
    return normalizeText(pendingMessage?.content) === normalizeText(serverMessage?.content);
  }

  // For image/video we cannot compare content (temp local URI vs uploaded URL),
  // so sender + type + close timestamps are enough for optimistic reconciliation.
  return pendingType === "image" || pendingType === "video";
};

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
            (msg) => isPendingTempMessage(msg)
          );
          const unresolvedPending = pendingMessages.filter(
            (pendingMessage) =>
              !initialMessages.some((serverMessage) =>
                isServerMatchForPending(pendingMessage, serverMessage)
              )
          );

          return dedupeMessagesById([...initialMessages, ...unresolvedPending]);
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

          const pendingMatchIndex = prevMessages.findIndex((pendingMessage) =>
            isServerMatchForPending(pendingMessage, newMessage)
          );
          if (pendingMatchIndex >= 0) {
            const updated = [...prevMessages];
            updated[pendingMatchIndex] = { ...newMessage, status: "sent" };
            return dedupeMessagesById(updated);
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
        setMessages((prevMessages) =>
          dedupeMessagesById([...olderMessages, ...prevMessages])
        );
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
