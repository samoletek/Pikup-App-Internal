import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { logger } from '../../services/logger';
import { requestUserDataExport } from '../../services/userDataExportService';

export default function useCustomerSettingsData({
  navigation,
  route,
  userType,
}) {
  const notificationsOnly = route?.params?.notificationsOnly === true;
  const [settings, setSettings] = useState({
    notifications: {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      promotions: false,
      tripUpdates: true,
      accountActivity: true,
    },
  });
  const [downloadingData, setDownloadingData] = useState(false);
  const isDriver = userType === 'driver';
  const rootTabsRoute = isDriver ? 'DriverTabs' : 'CustomerTabs';
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.nativeAppVersion ||
    '0.0.0';

  const toggleSetting = useCallback((settingKey) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [settingKey]: !prev.notifications[settingKey],
      },
    }));
  }, []);

  const handleDownloadMyData = useCallback(async () => {
    if (downloadingData) return;

    Alert.alert(
      'Download My Data',
      "We'll send a copy of all your personal data to your email address. Continue?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setDownloadingData(true);
            try {
              await requestUserDataExport({ role: isDriver ? 'driver' : 'customer' });

              Alert.alert(
                'Check Your Email',
                'Your data export has been sent to your email address. It may take a few minutes to arrive.'
              );
            } catch (error) {
              logger.error('CustomerSettingsData', 'Error requesting data export', error);
              Alert.alert(
                'Error',
                error?.message || 'Failed to send your data. Please try again.'
              );
            } finally {
              setDownloadingData(false);
            }
          },
        },
      ]
    );
  }, [downloadingData, isDriver]);

  const accountRows = useMemo(() => {
    if (notificationsOnly) return [];

    if (isDriver) {
      return [
        {
          key: 'driver-profile',
          icon: 'person-outline',
          label: 'Profile',
          onPress: () => navigation.navigate('PersonalInfoScreen'),
        },
        {
          key: 'driver-preferences',
          icon: 'options-outline',
          label: 'Preferences',
          onPress: () => navigation.navigate('DriverPreferencesScreen'),
        },
        {
          key: 'driver-payment',
          icon: 'card-outline',
          label: 'Payment',
          onPress: () => navigation.navigate('DriverPaymentSettingsScreen'),
        },
        {
          key: 'driver-notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          onPress: () =>
            navigation.push('CustomerSettingsScreen', { notificationsOnly: true }),
        },
        {
          key: 'driver-export-data',
          icon: 'mail-outline',
          label: 'Export My Data',
          onPress: handleDownloadMyData,
          loading: downloadingData,
        },
      ];
    }

    return [
      {
        key: 'customer-profile',
        icon: 'person-outline',
        label: 'Profile',
        onPress: () => navigation.navigate('PersonalInfoScreen'),
      },
      {
        key: 'customer-addresses',
        icon: 'location-outline',
        label: 'My Addresses',
        onPress: () => navigation.navigate('CustomerSavedAddressesScreen'),
      },
      {
        key: 'customer-payment',
        icon: 'card-outline',
        label: 'Payment',
        onPress: () => navigation.navigate('PaymentMethodsScreen'),
      },
      {
        key: 'customer-notifications',
        icon: 'notifications-outline',
        label: 'Notifications',
        onPress: () =>
          navigation.push('CustomerSettingsScreen', { notificationsOnly: true }),
      },
      {
        key: 'customer-export-data',
        icon: 'mail-outline',
        label: 'Export My Data',
        onPress: handleDownloadMyData,
        loading: downloadingData,
      },
    ];
  }, [downloadingData, handleDownloadMyData, isDriver, navigation, notificationsOnly]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate(rootTabsRoute, { screen: 'Account' });
  }, [navigation, rootTabsRoute]);

  return {
    accountRows,
    appVersion,
    downloadingData,
    handleBackPress,
    notificationsOnly,
    settings,
    toggleSetting,
  };
}
