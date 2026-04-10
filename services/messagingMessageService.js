import {
  getConversationPreviewText,
  mapMessageRow,
  PAGE_SIZE,
} from './messagingUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  createRealtimeChannel,
  fetchConversationById,
  fetchMessagesByConversation,
  insertMessageWithSelect,
  removeRealtimeChannel,
  updateConversationById,
} from './repositories/messagingRepository';

const MESSAGES_BACKGROUND_SYNC_INTERVAL_MS = 2000;
const REALTIME_DEGRADED_STATUSES = new Set(['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED']);

export const sendMessage = async (conversationId, senderId, senderType, content, messageType = 'text') => {
  try {
    const { data: message, error } = await insertMessageWithSelect({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      created_at: new Date().toISOString(),
      is_read: false,
    });

    if (error) throw error;

    const updates = {
      last_message: getConversationPreviewText(content, messageType),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: conv, error: convFetchError } = await fetchConversationById(conversationId);

    if (convFetchError) {
      logger.warn('MessagingMessageService', 'Could not fetch conversation before unread update', convFetchError);
    }

    if (conv) {
      if (senderId === conv.customer_id) {
        updates.unread_by_driver = (conv.unread_by_driver || 0) + 1;
      } else if (senderId === conv.driver_id) {
        updates.unread_by_customer = (conv.unread_by_customer || 0) + 1;
      } else if (senderType === 'customer') {
        updates.unread_by_driver = (conv.unread_by_driver || 0) + 1;
      } else {
        updates.unread_by_customer = (conv.unread_by_customer || 0) + 1;
      }
    }

    const { error: convUpdateError } = await updateConversationById(conversationId, updates);

    if (convUpdateError) {
      logger.warn(
        'MessagingMessageService',
        'Could not update conversation message preview/unread counters',
        convUpdateError
      );
    }

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      messageType: message.message_type,
      isRead: message.is_read,
      createdAt: message.created_at,
      timestamp: message.created_at,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to send message');
    logger.error('MessagingMessageService', 'Error sending message', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getMessages = async (conversationId) => {
  try {
    const { data, error } = await fetchMessagesByConversation({
      conversationId,
      ascending: true,
    });

    if (error) throw error;
    return data.map(mapMessageRow);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch messages');
    logger.error('MessagingMessageService', 'Error fetching messages', normalized, error);
    return [];
  }
};

export const getRecentMessages = async (conversationId, limit = PAGE_SIZE) => {
  try {
    const { data, error } = await fetchMessagesByConversation({
      conversationId,
      ascending: false,
      limit,
    });

    if (error) throw error;

    return (data || []).reverse().map(mapMessageRow);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch recent messages');
    logger.error('MessagingMessageService', 'Error fetching recent messages', normalized, error);
    return [];
  }
};

export const loadOlderMessages = async (conversationId, beforeTimestamp, limit = PAGE_SIZE) => {
  try {
    const { data, error } = await fetchMessagesByConversation({
      conversationId,
      beforeTimestamp,
      ascending: false,
      limit,
    });

    if (error) throw error;

    return (data || []).reverse().map(mapMessageRow);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load older messages');
    logger.error('MessagingMessageService', 'Error loading older messages', normalized, error);
    return [];
  }
};

export const subscribeToMessages = (conversationId, onInitialLoad, onNewMessage) => {
  const channelSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channelTopic = `public:messages:${conversationId}:${channelSuffix}`;

  let isDisposed = false;
  let syncInFlight = false;
  let backgroundSyncTimer = null;

  const clearBackgroundSync = () => {
    if (backgroundSyncTimer) {
      clearInterval(backgroundSyncTimer);
      backgroundSyncTimer = null;
    }
  };

  const startBackgroundSync = (syncFn) => {
    if (backgroundSyncTimer || isDisposed) {
      return;
    }

    backgroundSyncTimer = setInterval(() => {
      void syncFn();
    }, MESSAGES_BACKGROUND_SYNC_INTERVAL_MS);
  };

  const runRecentSync = async (onSyncMessage) => {
    if (isDisposed || syncInFlight) {
      return;
    }

    syncInFlight = true;
    try {
      const recentMessages = await getRecentMessages(conversationId);
      if (isDisposed) {
        return;
      }

      (Array.isArray(recentMessages) ? recentMessages : []).forEach((message) => {
        onSyncMessage(message);
      });
    } finally {
      syncInFlight = false;
    }
  };

  if (typeof onNewMessage !== 'function') {
    const legacyCallback = onInitialLoad;
    const runLegacyRefresh = async () => {
      const recentMessages = await getRecentMessages(conversationId);
      if (isDisposed) {
        return;
      }
      legacyCallback(recentMessages);
    };

    void runLegacyRefresh();
    startBackgroundSync(runLegacyRefresh);

    const channel = createRealtimeChannel(channelTopic)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        void runLegacyRefresh();
      })
      .subscribe((status) => {
        logger.info('MessagingMessageService', 'Messages realtime status changed (legacy)', {
          conversationId,
          status,
        });

        if (REALTIME_DEGRADED_STATUSES.has(status)) {
          void runLegacyRefresh();
        }
      });

    return () => {
      isDisposed = true;
      clearBackgroundSync();
      removeRealtimeChannel(channel);
    };
  }

  getRecentMessages(conversationId).then(onInitialLoad);
  startBackgroundSync(() => runRecentSync(onNewMessage));

  const channel = createRealtimeChannel(channelTopic)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, () => {
      void runRecentSync(onNewMessage);
    })
    .subscribe((status) => {
      logger.info('MessagingMessageService', 'Messages realtime status changed', {
        conversationId,
        status,
      });

      if (REALTIME_DEGRADED_STATUSES.has(status)) {
        void runRecentSync(onNewMessage);
      }
    });

  return () => {
    isDisposed = true;
    clearBackgroundSync();
    removeRealtimeChannel(channel);
  };
};

export const markMessageAsRead = async (conversationId, userType) => {
  try {
    const updates = {
      updated_at: new Date().toISOString(),
    };
    if (userType === 'customer') {
      updates.unread_by_customer = 0;
    } else {
      updates.unread_by_driver = 0;
    }
    await updateConversationById(conversationId, updates);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to mark messages as read');
    logger.error('MessagingMessageService', 'Error marking messages as read', normalized, error);
  }
};
