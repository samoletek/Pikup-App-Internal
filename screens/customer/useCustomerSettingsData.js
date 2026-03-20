import { useCallback, useMemo, useState } from 'react';
import Constants from 'expo-constants';

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

  const exportDataRow = useMemo(() => ({
    icon: 'lock-closed-outline',
    label: 'Export My Data',
    subtitle: "Temporarily unavailable. We're working on it.",
    disabled: true,
    lock: true,
  }), []);

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
          ...exportDataRow,
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
        ...exportDataRow,
      },
    ];
  }, [exportDataRow, isDriver, navigation, notificationsOnly]);

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
    handleBackPress,
    notificationsOnly,
    settings,
    toggleSetting,
  };
}
