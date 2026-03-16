// services/MessagingService.js
// Facade with stable exports for conversation and message flows.

export {
  createConversation,
  getConversations,
  subscribeToConversations,
} from './messagingConversationService';

export {
  sendMessage,
  getMessages,
  getRecentMessages,
  loadOlderMessages,
  subscribeToMessages,
  markMessageAsRead,
} from './messagingMessageService';
