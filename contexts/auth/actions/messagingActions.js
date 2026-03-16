import * as MessagingService from '../../../services/MessagingService';

export const createMessagingDomainActions = () => {
  return {
    createConversation: MessagingService.createConversation,
    getConversations: MessagingService.getConversations,
    sendMessage: MessagingService.sendMessage,
    getMessages: MessagingService.getMessages,
    subscribeToMessages: MessagingService.subscribeToMessages,
    subscribeToConversations: MessagingService.subscribeToConversations,
    markMessageAsRead: MessagingService.markMessageAsRead,
    loadOlderMessages: MessagingService.loadOlderMessages,
  };
};
