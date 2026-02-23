// services/MessagingService.js
// Extracted from AuthContext.js - Chat and messaging functionality

import { supabase } from '../config/supabase';

const NETWORK_ERROR_PATTERNS = Object.freeze([
    'network request failed',
    'failed to fetch',
    'network error',
    'load failed'
]);
const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)(\?|#|$)/i;
const VIDEO_URL_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;
const CONVERSATIONS_FETCH_MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isNetworkRequestFailure = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern) || details.includes(pattern));
};

const isLikelyImageAttachmentUrl = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    return trimmed.includes('/chat-attachments/') || IMAGE_URL_PATTERN.test(trimmed);
};

const isLikelyVideoAttachmentUrl = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    return VIDEO_URL_PATTERN.test(trimmed);
};

const getConversationPreviewText = (content, messageType = 'text') => {
    const normalizedType = String(messageType || '').toLowerCase();

    if (normalizedType === 'video' || isLikelyVideoAttachmentUrl(content)) {
        return 'Video';
    }

    if (normalizedType === 'image' || isLikelyImageAttachmentUrl(content)) {
        return 'Photo';
    }

    return content;
};

const ensureAuthenticatedUserId = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user?.id) {
        return userData.user.id;
    }

    // Try to refresh silently if local session exists but user fetch failed.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
        const { data: refreshedData } = await supabase.auth.refreshSession();
        if (refreshedData?.user?.id) {
            return refreshedData.user.id;
        }
    }

    return null;
};

const selectCanonicalConversationId = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const sorted = [...rows].sort((a, b) => {
        const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

    return sorted[0]?.id || null;
};

const dedupeConversationsByRequest = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const seenRequestIds = new Set();
    const deduped = [];

    for (const row of rows) {
        if (!row?.request_id) {
            deduped.push(row);
            continue;
        }

        if (seenRequestIds.has(row.request_id)) {
            continue;
        }

        seenRequestIds.add(row.request_id);
        deduped.push(row);
    }

    return deduped;
};

/**
 * Create a new conversation or return existing one
 * @param {string} requestId - Trip/request ID
 * @param {string} customerId - Customer user ID
 * @param {string} driverId - Driver user ID
 * @param {string} customerName - Customer display name (unused, for future)
 * @param {string} driverName - Driver display name (unused, for future)
 * @returns {Promise<string>} Conversation ID
 */
export const createConversation = async (
    requestId,
    customerId,
    driverId,
    customerName,
    driverName,
    options = {}
) => {
    try {
        const authUid = await ensureAuthenticatedUserId();
        if (!authUid) {
            throw new Error('Session expired. Please sign in again.');
        }

        let effectiveCustomerId = customerId || null;
        let effectiveDriverId = driverId || null;

        // For trip-linked chats, resolve missing participants from the trip itself.
        // This avoids accidentally creating self-conversations when request payload is partial.
        if (requestId && (!effectiveCustomerId || !effectiveDriverId)) {
            const { data: tripParticipants, error: tripLookupError } = await supabase
                .from('trips')
                .select('customer_id, driver_id')
                .eq('id', requestId)
                .maybeSingle();

            if (tripLookupError) {
                console.warn('Could not resolve trip participants for conversation creation:', tripLookupError);
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
            let existingQuery = supabase
                .from('conversations')
                .select('id, created_at, updated_at')
                .eq('customer_id', effectiveCustomerId)
                .eq('driver_id', effectiveDriverId);

            if (requestId) {
                existingQuery = existingQuery.eq('request_id', requestId);
            } else {
                existingQuery = existingQuery.is('request_id', null);
            }

            return existingQuery
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);
        };

        const { data: existingRows, error: fetchError } = await fetchExistingConversations();

        if (fetchError) {
            throw fetchError;
        }

        const existingConversationId = selectCanonicalConversationId(existingRows);
        if (existingConversationId) {
            return existingConversationId;
        }

        const { data, error } = await supabase
            .from('conversations')
            .insert({
                request_id: requestId,
                customer_id: effectiveCustomerId,
                driver_id: effectiveDriverId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            // Another client may have created the same request chat concurrently.
            if (requestId && error?.code === '23505') {
                const { data: raceRows, error: raceFetchError } = await fetchExistingConversations();

                if (!raceFetchError) {
                    const raceConversationId = selectCanonicalConversationId(raceRows);
                    if (raceConversationId) {
                        return raceConversationId;
                    }
                }

                // Fallback: if legacy data has wrong participants but same request_id,
                // return canonical request conversation so user still enters chat.
                const { data: requestScopedRows, error: requestScopedError } = await supabase
                    .from('conversations')
                    .select('id, customer_id, driver_id, created_at, updated_at')
                    .eq('request_id', requestId)
                    .order('updated_at', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(50);

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
            console.error('Error creating conversation:', error);
        }
        throw error;
    }
};

/**
 * Get all conversations for a user
 * @param {string} userId - User ID
 * @param {string} userType - 'customer' or 'driver'
 * @returns {Promise<Array>} Array of conversation objects
 */
export const getConversations = async (userId, userType) => {
    try {
        let lastError = null;

        for (let attempt = 1; attempt <= CONVERSATIONS_FETCH_MAX_RETRIES; attempt++) {
            let query = supabase
                .from('conversations')
                .select('*')
                .order('updated_at', { ascending: false });

            if (userType === 'driver') {
                // Drivers need to see:
                // 1. Trips where they are the driver (driver_id = userId)
                // 2. Support chats where they are the customer (customer_id = userId AND driver_id = SUPPORT)
                // We use an OR condition
                query = query.or(`driver_id.eq.${userId},and(customer_id.eq.${userId},driver_id.eq.ffffffff-ffff-ffff-ffff-ffffffffffff)`);
            } else {
                // Customers just see their own chats
                query = query.eq('customer_id', userId);
            }

            const { data, error } = await query;
            if (!error) {
                const dedupedConversations = dedupeConversationsByRequest(data || []);
                return dedupedConversations.map(conv => ({
                    id: conv.id,
                    requestId: conv.request_id,
                    customerId: conv.customer_id,
                    driverId: conv.driver_id,
                    lastMessage: getConversationPreviewText(conv.last_message, conv.last_message_type),
                    lastMessageAt: conv.last_message_at,
                    unreadByCustomer: conv.unread_by_customer,
                    unreadByDriver: conv.unread_by_driver,
                    createdAt: conv.created_at,
                    updatedAt: conv.updated_at
                }));
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
            console.warn('Transient network failure while fetching conversations:', error?.message || error);
        } else {
            console.error('Error fetching conversations:', error);
        }
        return [];
    }
};

/**
 * Subscribe to conversation list changes for a user.
 * Triggers callback with freshly fetched conversations whenever relevant rows change.
 *
 * @param {string} userId - User ID
 * @param {string} userType - 'customer' or 'driver'
 * @param {Function} callback - Callback receiving mapped conversations array
 * @returns {Function} Cleanup function
 */
export const subscribeToConversations = (userId, userType, callback) => {
    if (!userId || typeof callback !== 'function') {
        return () => {};
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

        // Debounce bursty realtime events (insert + update sequences).
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refreshConversations();
        }, delayMs);
    };

    const scheduleMessageRefresh = () => {
        if (isDisposed) return;

        // Primary refresh shortly after insert.
        scheduleRefresh(220);

        // Secondary refresh to catch delayed unread counter updates.
        if (followUpRefreshTimer) {
            clearTimeout(followUpRefreshTimer);
        }

        followUpRefreshTimer = setTimeout(() => {
            followUpRefreshTimer = null;
            refreshConversations();
        }, 900);
    };

    // Initial load
    refreshConversations();

    const channelSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const conversationsChannel = supabase.channel(
        `public:conversations:${userType}:${userId}:${channelSuffix}`
    );
    const messagesChannel = supabase.channel(
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
                    filter: `driver_id=eq.${userId}`
                },
                () => scheduleRefresh(80)
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations',
                    filter: `customer_id=eq.${userId}`
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
                filter: `customer_id=eq.${userId}`
            },
            () => scheduleRefresh(80)
        );
    }

    // Fallback realtime source: conversation row may not always emit on message changes
    // in some environments; message insert events keep unread indicators in sync.
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
        supabase.removeChannel(conversationsChannel);
        supabase.removeChannel(messagesChannel);
    };
};

/**
 * Send a message in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} senderId - Sender user ID
 * @param {string} senderType - 'customer' or 'driver'
 * @param {string} content - Message content
 * @param {string} messageType - Message type (default: 'text')
 * @returns {Promise<Object>} Created message object
 */
export const sendMessage = async (conversationId, senderId, senderType, content, messageType = 'text') => {
    try {
        // Insert message
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: senderId,
                content: content,
                message_type: messageType,
                created_at: new Date().toISOString(),
                is_read: false
            })
            .select()
            .single();

        if (error) throw error;

        // Update conversation last_message
        const updates = {
            last_message: getConversationPreviewText(content, messageType),
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Increment unread count based on who sent the message (support chat compatibility)
        const { data: conv, error: convFetchError } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .maybeSingle();

        if (convFetchError) {
            console.warn('Could not fetch conversation before unread update:', convFetchError);
        }

        if (conv) {
            if (senderId === conv.customer_id) {
                // Sender is the customer (or driver acting as customer in support chat)
                updates.unread_by_driver = (conv.unread_by_driver || 0) + 1;
            } else if (senderId === conv.driver_id) {
                // Sender is the driver (or support)
                updates.unread_by_customer = (conv.unread_by_customer || 0) + 1;
            } else {
                // Determine by role if ID check fails (fallback)
                if (senderType === 'customer') {
                    updates.unread_by_driver = (conv.unread_by_driver || 0) + 1;
                } else {
                    updates.unread_by_customer = (conv.unread_by_customer || 0) + 1;
                }
            }
        }

        const { error: convUpdateError } = await supabase
            .from('conversations')
            .update(updates)
            .eq('id', conversationId);

        if (convUpdateError) {
            console.warn('Could not update conversation message preview/unread counters:', convUpdateError);
        }

        return {
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            content: message.content,
            messageType: message.message_type,
            isRead: message.is_read,
            createdAt: message.created_at,
            timestamp: message.created_at // Compatibility
        };
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Get all messages in a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessages = async (conversationId) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data.map(msg => ({
            id: msg.id,
            conversationId: msg.conversation_id,
            senderId: msg.sender_id,
            content: msg.content,
            messageType: msg.message_type,
            isRead: msg.is_read,
            createdAt: msg.created_at,
            timestamp: msg.created_at // Compatibility with MessageScreen
        }));
    } catch (error) {
        console.error('Error fetching messages:', error);
        return [];
    }
};

/**
 * Subscribe to real-time message updates
 * @param {string} conversationId - Conversation ID
 * @param {Function} callback - Callback function receiving messages array
 * @returns {Function} Cleanup function to unsubscribe
 */
export const subscribeToMessages = (conversationId, callback) => {
    // Initial fetch
    getMessages(conversationId).then(callback);

    const channel = supabase.channel(`public:messages:${conversationId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
        }, () => {
            // Fetch all messages again to ensure order and consistency
            getMessages(conversationId).then(callback);
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Mark messages as read for a user
 * @param {string} conversationId - Conversation ID
 * @param {string} userType - 'customer' or 'driver'
 */
export const markMessageAsRead = async (conversationId, userType) => {
    try {
        const updates = {};
        if (userType === 'customer') {
            updates.unread_by_customer = 0;
        } else {
            updates.unread_by_driver = 0;
        }
        await supabase.from('conversations').update(updates).eq('id', conversationId);
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
};
