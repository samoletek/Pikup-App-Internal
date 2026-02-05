// services/MessagingService.js
// Extracted from AuthContext.js - Chat and messaging functionality

import { supabase } from '../config/supabase';

/**
 * Create a new conversation or return existing one
 * @param {string} requestId - Trip/request ID
 * @param {string} customerId - Customer user ID
 * @param {string} driverId - Driver user ID
 * @param {string} customerName - Customer display name (unused, for future)
 * @param {string} driverName - Driver display name (unused, for future)
 * @returns {Promise<string>} Conversation ID
 */
export const createConversation = async (requestId, customerId, driverId, customerName, driverName) => {
    try {
        // Check if conversation already exists
        const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .match({ request_id: requestId, customer_id: customerId, driver_id: driverId })
            .maybeSingle();

        if (existing) return existing.id;

        const { data, error } = await supabase
            .from('conversations')
            .insert({
                request_id: requestId,
                customer_id: customerId,
                driver_id: driverId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error('Error creating conversation:', error);
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
        const column = userType === 'customer' ? 'customer_id' : 'driver_id';

        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq(column, userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data;
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

        // Increment unread count
        const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
        if (conv) {
            if (senderType === 'customer') {
                updates.unread_by_driver = (conv.unread_by_driver || 0) + 1;
            } else {
                updates.unread_by_customer = (conv.unread_by_customer || 0) + 1;
            }
            await supabase.from('conversations').update(updates).eq('id', conversationId);
        }

        return message;
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
        return data;
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
