import { supabase } from '../../config/supabase';

type ConversationUserType = 'driver' | 'customer' | string;
type RowPayload = Record<string, unknown>;

/**
 * Messaging repository centralizes all conversation/message storage and realtime access.
 */
export const fetchTripParticipantsById = async (requestId: string) => {
  return supabase
    .from('trips')
    .select('customer_id, driver_id')
    .eq('id', requestId)
    .maybeSingle();
};

export const fetchExistingConversations = async ({
  customerId,
  driverId,
  requestId,
  limit = 50,
}: {
  customerId: string;
  driverId: string;
  requestId?: string | null;
  limit?: number;
}) => {
  let query = supabase
    .from('conversations')
    .select('id, created_at, updated_at')
    .eq('customer_id', customerId)
    .eq('driver_id', driverId);

  if (requestId) {
    query = query.eq('request_id', requestId);
  } else {
    query = query.is('request_id', null);
  }

  return query
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
};

export const insertConversationWithSelect = async (payload: RowPayload) => {
  return supabase
    .from('conversations')
    .insert(payload)
    .select()
    .single();
};

export const fetchRequestScopedConversations = async (requestId: string, limit = 50) => {
  return supabase
    .from('conversations')
    .select('id, customer_id, driver_id, created_at, updated_at')
    .eq('request_id', requestId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
};

export const fetchConversationsForUser = async ({
  userId,
  userType,
}: {
  userId: string;
  userType: ConversationUserType;
}) => {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (userType === 'driver') {
    query = query.or(
      `driver_id.eq.${userId},and(customer_id.eq.${userId},driver_id.eq.ffffffff-ffff-ffff-ffff-ffffffffffff)`,
    );
  } else {
    query = query.eq('customer_id', userId);
  }

  return query;
};

export const insertMessageWithSelect = async (payload: RowPayload) => {
  return supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();
};

export const fetchConversationById = async (conversationId: string) => {
  return supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
};

export const updateConversationById = async (conversationId: string, updates: RowPayload) => {
  return supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);
};

type FetchMessagesParams = {
  conversationId: string;
  ascending?: boolean;
  limit?: number;
  beforeTimestamp?: string | null;
};

export const fetchMessagesByConversation = async ({
  conversationId,
  ascending = true,
  limit,
  beforeTimestamp = null,
}: FetchMessagesParams) => {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  query = query.order('created_at', { ascending });

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  return query;
};

export const fetchTripStatusRowsByIds = async (requestIds: string[]) => {
  return supabase
    .from('trips')
    .select('id, status, completed_at, cancelled_at')
    .in('id', requestIds);
};

export const createRealtimeChannel = (channelName: string) => {
  return supabase.channel(channelName);
};

export const removeRealtimeChannel = (channel: unknown) => {
  return supabase.removeChannel(channel as Parameters<typeof supabase.removeChannel>[0]);
};
