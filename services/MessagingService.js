// services/MessagingService.js
// Extracted from AuthContext.js - Chat and messaging functionality

import { supabase } from '../config/supabase';

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

        const effectiveCustomerId = customerId || authUid;
        const effectiveDriverId = driverId || authUid;
        if (authUid !== effectiveCustomerId && authUid !== effectiveDriverId) {
            throw new Error('Cannot create conversation: authenticated user is not a participant.');
        }

        // Build query to check if conversation exists
        let query = supabase
            .from('conversations')
            .select('id')
            .eq('customer_id', effectiveCustomerId)
            .eq('driver_id', effectiveDriverId);

        if (requestId) {
            query = query.eq('request_id', requestId);
        } else {
            query = query.is('request_id', null);
        }

        const { data: existing, error: fetchError } = await query.maybeSingle();

        if (fetchError) console.error("Error fetching existing conversation:", fetchError);

        if (existing) return existing.id;

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

        if (error) throw error;
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

        if (error) throw error;

        return data.map(conv => ({
            id: conv.id,
            requestId: conv.request_id,
            customerId: conv.customer_id,
            driverId: conv.driver_id,
            lastMessage: conv.last_message,
            lastMessageAt: conv.last_message_at,
            unreadByCustomer: conv.unread_by_customer,
            unreadByDriver: conv.unread_by_driver,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at
        }));
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return [];
    }
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
            last_message: content,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Increment unread count based on who sent the message (support chat compatibility)
        const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
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
            await supabase.from('conversations').update(updates).eq('id', conversationId);
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
