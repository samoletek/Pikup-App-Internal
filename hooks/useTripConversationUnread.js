import { useEffect, useState } from 'react';

export default function useTripConversationUnread({
  currentUserId,
  getConversations,
  subscribeToConversations,
  conversationUserType,
  activeRequestId,
  activeRequestCustomerId,
  activeRequestDriverId,
}) {
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  useEffect(() => {
    if (!currentUserId || typeof subscribeToConversations !== 'function') {
      setHasUnreadChat(false);
      return undefined;
    }

    let isDisposed = false;
    const requestIdString = activeRequestId ? String(activeRequestId) : '';
    const unreadKey = conversationUserType === 'customer' ? 'unreadByCustomer' : 'unreadByDriver';
    const peerId =
      conversationUserType === 'customer'
        ? activeRequestDriverId
        : activeRequestCustomerId;
    const peerIdString = peerId ? String(peerId) : '';
    const peerField = conversationUserType === 'customer' ? 'driverId' : 'customerId';

    const updateUnreadState = (userConversations = []) => {
      if (isDisposed) {
        return;
      }

      const unreadConversations = userConversations.filter(
        (conversation) => Number(conversation?.[unreadKey] || 0) > 0
      );
      const hasTripContext = Boolean(requestIdString || peerIdString);

      const hasTripMatchUnread = unreadConversations.some((conversation) => {
        if (requestIdString) {
          return (
            String(conversation?.requestId || conversation?.request_id || '') === requestIdString
          );
        }

        if (peerIdString) {
          return String(conversation?.[peerField] || '') === peerIdString;
        }

        return false;
      });

      setHasUnreadChat(hasTripContext ? hasTripMatchUnread : unreadConversations.length > 0);
    };

    const refreshUnread = async () => {
      if (isDisposed || typeof getConversations !== 'function') {
        return;
      }

      const conversations = await getConversations(currentUserId, conversationUserType);
      updateUnreadState(Array.isArray(conversations) ? conversations : []);
    };

    void refreshUnread();
    const pollInterval = setInterval(refreshUnread, 2500);

    const unsubscribe = subscribeToConversations(
      currentUserId,
      conversationUserType,
      updateUnreadState
    );

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      unsubscribe?.();
    };
  }, [
    activeRequestCustomerId,
    activeRequestDriverId,
    activeRequestId,
    conversationUserType,
    currentUserId,
    getConversations,
    subscribeToConversations,
  ]);

  return {
    hasUnreadChat,
    setHasUnreadChat,
  };
}
