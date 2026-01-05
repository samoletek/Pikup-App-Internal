import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
import { Platform } from 'react-native';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.expoPushToken = null;
    this.toastCallbacks = [];
    
    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  // Initialize push notifications
  async initialize() {
    try {
      // Commented out Device check since expo-device is not installed
      // if (!Device.isDevice) {
      //   console.log('Push notifications only work on physical devices');
      //   return;
      // }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      // Get push token
      this.expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo push token:', this.expoPushToken);

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('delivery-updates', {
          name: 'Delivery Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#A77BFF',
          sound: 'default',
        });
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  // Send local notification for delivery updates
  async sendDeliveryUpdate(title, body, data = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Register callback for toast notifications
  registerToastCallback(callback) {
    this.toastCallbacks.push(callback);
  }

  // Unregister toast callback
  unregisterToastCallback(callback) {
    this.toastCallbacks = this.toastCallbacks.filter(cb => cb !== callback);
  }

  // Show in-app toast notification
  showToast(message, type = 'info', duration = 3000) {
    this.toastCallbacks.forEach(callback => {
      callback({ message, type, duration });
    });
  }

  // Delivery status specific notifications
  async notifyDriverAccepted(driverName) {
    await this.sendDeliveryUpdate(
      'Driver Found!',
      `${driverName} has accepted your delivery request`,
      { type: 'driver_accepted' }
    );
    
    this.showToast(`${driverName} is on the way!`, 'success');
  }

  async notifyDriverArrived(location = 'pickup') {
    const title = location === 'pickup' ? 'Driver Arrived' : 'Driver at Delivery';
    const body = location === 'pickup' 
      ? 'Your driver has arrived at the pickup location'
      : 'Your driver has arrived at the delivery location';

    await this.sendDeliveryUpdate(title, body, { type: 'driver_arrived', location });
    this.showToast(body, 'info');
  }

  async notifyItemsPickedUp() {
    await this.sendDeliveryUpdate(
      'Items Picked Up',
      'Your items have been secured and are on the way to delivery',
      { type: 'items_picked_up' }
    );
    
    this.showToast('Items secured! On the way to delivery', 'success');
  }

  async notifyDeliveryCompleted() {
    await this.sendDeliveryUpdate(
      'Delivery Completed! ✨',
      'Your items have been delivered successfully',
      { type: 'delivery_completed' }
    );
    
    this.showToast('Delivery completed successfully!', 'success');
  }

  async notifyEtaUpdate(newEta) {
    this.showToast(`Updated arrival time: ${newEta}`, 'info', 2000);
  }

  async notifyPhotosUploaded(type = 'pickup') {
    const message = type === 'pickup' 
      ? 'Pickup photos are now available'
      : 'Delivery photos are now available';
    
    this.showToast(message, 'info', 2000);
  }

  async notifyDriverMessage() {
    this.showToast('New message from your driver', 'info');
  }

  async notifyDeliveryIssue(issue) {
    await this.sendDeliveryUpdate(
      'Delivery Update',
      issue,
      { type: 'delivery_issue' }
    );
    
    this.showToast(issue, 'warning');
  }

  // Get the push token for server-side notifications
  getPushToken() {
    return this.expoPushToken;
  }

  // Check if notifications are enabled
  async getNotificationStatus() {
    const { status } = await Notifications.getPermissionsAsync();
    return {
      enabled: status === 'granted',
      status,
    };
  }

  // Clear all notifications
  async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }
}

// Export singleton instance
export default new NotificationService();