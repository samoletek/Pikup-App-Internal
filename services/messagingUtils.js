import {
    getAuthenticatedSession,
    getAuthenticatedUser,
    refreshAuthenticatedSession,
} from './repositories/authRepository';
import { fetchTripStatusRowsByIds } from './repositories/messagingRepository';

const NETWORK_ERROR_PATTERNS = Object.freeze([
    'network request failed',
    'failed to fetch',
    'network error',
    'load failed'
]);
const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)(\?|#|$)/i;
const VIDEO_URL_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;
const TRIP_STATUS_FETCH_CHUNK_SIZE = 100;

export const CONVERSATIONS_FETCH_MAX_RETRIES = 3;
export const PAGE_SIZE = 20;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isNetworkRequestFailure = (error) => {
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

export const getConversationPreviewText = (content, messageType = 'text') => {
    const normalizedType = String(messageType || '').toLowerCase();

    if (normalizedType === 'video' || isLikelyVideoAttachmentUrl(content)) {
        return 'Video';
    }

    if (normalizedType === 'image' || isLikelyImageAttachmentUrl(content)) {
        return 'Photo';
    }

    return content;
};

export const ensureAuthenticatedUserId = async () => {
    const { data: userData, error: userError } = await getAuthenticatedUser();
    if (!userError && userData?.user?.id) {
        return userData.user.id;
    }

    // Try to refresh silently if local session exists but user fetch failed.
    const { data: sessionData } = await getAuthenticatedSession();
    if (sessionData?.session) {
        const { data: refreshedData } = await refreshAuthenticatedSession();
        if (refreshedData?.user?.id) {
            return refreshedData.user.id;
        }
    }

    return null;
};

export const selectCanonicalConversationId = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const sorted = [...rows].sort((a, b) => {
        const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
        const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

    return sorted[0]?.id || null;
};

export const dedupeConversationsByRequest = (rows = []) => {
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

const chunkArray = (values = [], chunkSize = TRIP_STATUS_FETCH_CHUNK_SIZE) => {
    if (!Array.isArray(values) || values.length === 0) return [];

    const normalizedChunkSize = Math.max(1, Number(chunkSize) || TRIP_STATUS_FETCH_CHUNK_SIZE);
    const chunks = [];

    for (let index = 0; index < values.length; index += normalizedChunkSize) {
        chunks.push(values.slice(index, index + normalizedChunkSize));
    }

    return chunks;
};

export const getTripStatusMapByRequestIds = async (requestIds = []) => {
    const uniqueRequestIds = Array.from(
        new Set(
            (Array.isArray(requestIds) ? requestIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        )
    );

    if (uniqueRequestIds.length === 0) return {};

    const statusByTripId = {};
    const requestIdChunks = chunkArray(uniqueRequestIds, TRIP_STATUS_FETCH_CHUNK_SIZE);

    for (const requestIdChunk of requestIdChunks) {
        const { data, error } = await fetchTripStatusRowsByIds(requestIdChunk);

        if (error) {
            throw error;
        }

        (data || []).forEach((trip) => {
            const tripId = String(trip?.id || '').trim();
            if (!tripId) return;
            statusByTripId[tripId] = trip;
        });
    }

    return statusByTripId;
};

export const mapConversationRow = (conv, tripStatusMap = {}) => {
    const tripStatus = conv?.request_id ? (tripStatusMap[String(conv.request_id)] || {}) : {};

    return {
        ...(tripStatus || {}),
        id: conv.id,
        requestId: conv.request_id,
        customerId: conv.customer_id,
        driverId: conv.driver_id,
        requestStatus:
            tripStatus?.status ||
            conv.request_status ||
            conv.requestStatus ||
            null,
        tripStatus:
            tripStatus?.status ||
            conv.trip_status ||
            conv.tripStatus ||
            null,
        completedAt:
            tripStatus?.completed_at ||
            conv.completed_at ||
            conv.completedAt ||
            null,
        cancelledAt:
            tripStatus?.cancelled_at ||
            conv.cancelled_at ||
            conv.cancelledAt ||
            null,
        archivedAt:
            tripStatus?.completed_at ||
            tripStatus?.cancelled_at ||
            conv.archived_at ||
            conv.archivedAt ||
            null,
        lastMessage: getConversationPreviewText(conv.last_message, conv.last_message_type),
        lastMessageAt: conv.last_message_at,
        unreadByCustomer: conv.unread_by_customer,
        unreadByDriver: conv.unread_by_driver,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at
    };
};

export const mapMessageRow = (msg) => ({
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    content: msg.content,
    messageType: msg.message_type,
    isRead: msg.is_read,
    createdAt: msg.created_at,
    timestamp: msg.created_at // Compatibility with MessageScreen
});
