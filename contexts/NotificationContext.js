import React, { createContext, useContext, useState, useEffect } from 'react';
import ToastNotification from '../components/ToastNotification';
import NotificationService from '../services/NotificationService';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  useEffect(() => {
    // Initialize notification service
    NotificationService.initialize();

    // Register toast callback
    const showToast = ({ message, type, duration }) => {
      setToast({
        visible: true,
        message,
        type,
        duration,
      });
    };

    NotificationService.registerToastCallback(showToast);

    return () => {
      NotificationService.unregisterToastCallback(showToast);
    };
  }, []);

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({
      visible: true,
      message,
      type,
      duration,
    });
  };

  const notificationMethods = {
    showToast,
    notifyDriverAccepted: NotificationService.notifyDriverAccepted.bind(NotificationService),
    notifyDriverArrived: NotificationService.notifyDriverArrived.bind(NotificationService),
    notifyItemsPickedUp: NotificationService.notifyItemsPickedUp.bind(NotificationService),
    notifyDeliveryCompleted: NotificationService.notifyDeliveryCompleted.bind(NotificationService),
    notifyEtaUpdate: NotificationService.notifyEtaUpdate.bind(NotificationService),
    notifyPhotosUploaded: NotificationService.notifyPhotosUploaded.bind(NotificationService),
    notifyDriverMessage: NotificationService.notifyDriverMessage.bind(NotificationService),
    notifyDeliveryIssue: NotificationService.notifyDeliveryIssue.bind(NotificationService),
    getPushToken: NotificationService.getPushToken.bind(NotificationService),
    getNotificationStatus: NotificationService.getNotificationStatus.bind(NotificationService),
    clearAllNotifications: NotificationService.clearAllNotifications.bind(NotificationService),
  };

  return (
    <NotificationContext.Provider value={notificationMethods}>
      {children}
      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onHide={hideToast}
      />
    </NotificationContext.Provider>
  );
}