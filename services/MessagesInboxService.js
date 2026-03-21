import {
  getAvatarUrlFromProfile as resolveAvatarUrlFromProfile,
  getDisplayNameFromProfile as resolveDisplayNameFromProfile,
  getInitialsFromName,
} from '../utils/profileDisplay';

export const SUPPORT_USER_IDS = new Set([
  'support',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
]);

export const ARCHIVE_STATUSES = new Set([
  'completed',
  'cancelled',
  'delivered',
  'archived',
]);

export const isSupportUserId = (userId) =>
  SUPPORT_USER_IDS.has(String(userId || '').trim().toLowerCase());

export const filterCustomerInboxConversations = (conversations = []) => {
  return (Array.isArray(conversations) ? conversations : []).filter((conversation) => {
    const customerId = conversation?.customerId;
    const driverId = conversation?.driverId;
    if (!customerId || !driverId) {
      return false;
    }

    const hasRequestOrSupport = Boolean(conversation?.requestId) || isSupportUserId(driverId);
    return hasRequestOrSupport && driverId !== customerId;
  });
};

export const filterDriverInboxConversations = (conversations = []) => {
  return (Array.isArray(conversations) ? conversations : []).filter((conversation) => {
    const customerId = conversation?.customerId;
    const driverId = conversation?.driverId;
    if (!customerId || !driverId || !conversation?.requestId) {
      return false;
    }

    return !isSupportUserId(customerId) && driverId !== customerId;
  });
};

export const formatConversationTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'Just now';
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`;
  }
  if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)} hr ago`;
  }
  if (diffInMinutes < 10080) {
    const days = Math.floor(diffInMinutes / 1440);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  const weeks = Math.floor(diffInMinutes / 10080);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

export const getDisplayNameFromProfile = (profile, fallbackName) => {
  return resolveDisplayNameFromProfile(profile, fallbackName);
};

export const getAvatarUrlFromProfile = (profile) =>
  resolveAvatarUrlFromProfile(profile);

export const getAvatarInitial = (displayName) =>
  getInitialsFromName(displayName, '?');

export const getConversationStatus = (conversation) =>
  String(
    conversation?.requestStatus ||
      conversation?.tripStatus ||
      conversation?.status ||
      ''
  ).toLowerCase();

export const isArchivedConversation = (conversation) => {
  const status = getConversationStatus(conversation);
  return (
    ARCHIVE_STATUSES.has(status) ||
    Boolean(conversation?.archivedAt) ||
    Boolean(conversation?.completedAt)
  );
};

export const isActiveConversation = (conversation) =>
  Boolean(conversation?.requestId) && !isArchivedConversation(conversation);
