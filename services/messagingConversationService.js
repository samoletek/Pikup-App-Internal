import {
  CONVERSATIONS_FETCH_MAX_RETRIES,
  dedupeConversationsByRequest,
  ensureAuthenticatedUserId,
  getTripStatusMapByRequestIds,
  isNetworkRequestFailure,
  mapConversationRow,
  selectCanonicalConversationId,
  sleep,
} from './messagingUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  createRealtimeChannel,
  fetchConversationsForUser,
  fetchExistingConversations as fetchExistingConversationsByParticipants,
  fetchRequestScopedConversations,
  fetchTripParticipantsById,
  insertConversationWithSelect,
  removeRealtimeChannel,
} from './repositories/messagingRepository';

export const createConversation = async (
  requestId,
  customerId,
  driverId,
  customerName,
  driverName,
  options = {}
) => {
  void customerName;
  void driverName;

  try {
    const authUid = await ensureAuthenticatedUserId();
    if (!authUid) {
      throw new Error('Session expired. Please sign in again.');
    }

    let effectiveCustomerId = customerId || null;
    let effectiveDriverId = driverId || null;

    if (requestId && (!effectiveCustomerId || !effectiveDriverId)) {
      const { data: tripParticipants, error: tripLookupError } = await fetchTripParticipantsById(requestId);

      if (tripLookupError) {
        logger.warn(
          'MessagingConversationService',
          'Could not resolve trip participants for conversation creation',
          tripLookupError
        );
      }

      if (tripParticipants) {
        effectiveCustomerId = effectiveCustomerId || tripParticipants.customer_id || null;
        effectiveDriverId = effectiveDriverId || tripParticipants.driver_id || null;
      }
    }

    if (requestId && (!effectiveCustomerId || !effectiveDriverId)) {
      throw new Error('Cannot create conversation: request participants are missing.');
    }

    effectiveCustomerId = effectiveCustomerId || authUid;
    effectiveDriverId = effectiveDriverId || authUid;

    if (authUid !== effectiveCustomerId && authUid !== effectiveDriverId) {
      throw new Error('Cannot create conversation: authenticated user is not a participant.');
    }

    const fetchExistingConversations = async () => {
      return fetchExistingConversationsByParticipants({
        customerId: effectiveCustomerId,
        driverId: effectiveDriverId,
        requestId,
        limit: 50,
      });
    };

    const { data: existingRows, error: fetchError } = await fetchExistingConversations();

    if (fetchError) {
      throw fetchError;
    }

    const existingConversationId = selectCanonicalConversationId(existingRows);
    if (existingConversationId) {
      return existingConversationId;
    }

    const { data, error } = await insertConversationWithSelect({
      request_id: requestId,
      customer_id: effectiveCustomerId,
      driver_id: effectiveDriverId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      if (requestId && error?.code === '23505') {
        const { data: raceRows, error: raceFetchError } = await fetchExistingConversations();

        if (!raceFetchError) {
          const raceConversationId = selectCanonicalConversationId(raceRows);
          if (raceConversationId) {
            return raceConversationId;
          }
        }

        const { data: requestScopedRows, error: requestScopedError } = await fetchRequestScopedConversations(
          requestId,
          50
        );

        if (!requestScopedError) {
          const participantRows = (requestScopedRows || []).filter((row) =>
            row?.customer_id === authUid || row?.driver_id === authUid
          );
          const requestScopedId = selectCanonicalConversationId(
            participantRows.length > 0 ? participantRows : requestScopedRows
          );
          if (requestScopedId) {
            return requestScopedId;
          }
        }
      }

      throw error;
    }

    return data.id;
  } catch (error) {
    if (!options?.suppressLog) {
      const normalized = normalizeError(error, 'Failed to create conversation');
      logger.error('MessagingConversationService', 'Error creating conversation', normalized, error);
    }
    throw error;
  }
};

export const getConversations = async (userId, userType) => {
  try {
    let lastError = null;

    for (let attempt = 1; attempt <= CONVERSATIONS_FETCH_MAX_RETRIES; attempt++) {
      const { data, error } = await fetchConversationsForUser({ userId, userType });
      if (!error) {
        const dedupedConversations = dedupeConversationsByRequest(data || []);
        const requestIds = dedupedConversations
          .map((conversation) => conversation?.request_id)
          .filter(Boolean);

        let tripStatusMap = {};
        if (requestIds.length > 0) {
          try {
            tripStatusMap = await getTripStatusMapByRequestIds(requestIds);
          } catch (tripStatusError) {
            const normalized = normalizeError(tripStatusError, 'Could not load trip statuses');
            logger.warn(
              'MessagingConversationService',
              'Could not load trip statuses for conversations',
              normalized,
              tripStatusError
            );
          }
        }

        return dedupedConversations.map((conversation) =>
          mapConversationRow(conversation, tripStatusMap)
        );
      }

      lastError = error;
      if (attempt < CONVERSATIONS_FETCH_MAX_RETRIES && isNetworkRequestFailure(error)) {
        await sleep(250 * attempt);
        continue;
      }

      throw error;
    }

    throw lastError || new Error('Failed to fetch conversations');
  } catch (error) {
    if (isNetworkRequestFailure(error)) {
      const normalized = normalizeError(error, 'Transient network failure while fetching conversations');
      logger.warn(
        'MessagingConversationService',
        'Transient network failure while fetching conversations',
        normalized,
        error
      );
    } else {
      const normalized = normalizeError(error, 'Failed to fetch conversations');
      logger.error('MessagingConversationService', 'Error fetching conversations', normalized, error);
    }
    return [];
  }
};

export const subscribeToConversations = (userId, userType, callback) => {
  if (!userId || typeof callback !== 'function') {
    return () => { };
  }

  let isDisposed = false;
  let refreshTimer = null;
  let followUpRefreshTimer = null;

  const refreshConversations = async () => {
    if (isDisposed) return;
    const conversations = await getConversations(userId, userType);
    if (isDisposed) return;
    callback(conversations);
  };

  const scheduleRefresh = (delayMs = 120) => {
    if (isDisposed) return;

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshConversations();
    }, delayMs);
  };

  const scheduleMessageRefresh = () => {
    if (isDisposed) return;

    scheduleRefresh(220);

    if (followUpRefreshTimer) {
      clearTimeout(followUpRefreshTimer);
    }

    followUpRefreshTimer = setTimeout(() => {
      followUpRefreshTimer = null;
      refreshConversations();
    }, 900);
  };

  refreshConversations();

  const channelSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const conversationsChannel = createRealtimeChannel(
    `public:conversations:${userType}:${userId}:${channelSuffix}`
  );
  const messagesChannel = createRealtimeChannel(
    `public:messages:${userType}:${userId}:${channelSuffix}`
  );

  if (userType === 'driver') {
    conversationsChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `driver_id=eq.${userId}`,
        },
        () => scheduleRefresh(80)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `customer_id=eq.${userId}`,
        },
        () => scheduleRefresh(80)
      );
  } else {
    conversationsChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `customer_id=eq.${userId}`,
      },
      () => scheduleRefresh(80)
    );
  }

  messagesChannel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
    },
    scheduleMessageRefresh
  );

  conversationsChannel.subscribe();
  messagesChannel.subscribe();

  return () => {
    isDisposed = true;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (followUpRefreshTimer) {
      clearTimeout(followUpRefreshTimer);
      followUpRefreshTimer = null;
    }
    removeRealtimeChannel(conversationsChannel);
    removeRealtimeChannel(messagesChannel);
  };
};
