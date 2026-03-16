export const PASSWORD_FIELD_CONFIG = [
  {
    key: 'currentPassword',
    label: 'Current Password',
    placeholder: 'Enter current password',
    textContentType: 'password',
    returnKeyType: 'next',
  },
  {
    key: 'newPassword',
    label: 'New Password',
    placeholder: 'Enter new password',
    textContentType: 'newPassword',
    returnKeyType: 'next',
  },
  {
    key: 'confirmPassword',
    label: 'Repeat New Password',
    placeholder: 'Repeat new password',
    textContentType: 'newPassword',
    returnKeyType: 'done',
  },
];

export const PRIVACY_SETTINGS_FIELDS = [
  {
    key: 'shareLocation',
    title: 'Share Location',
    description: 'Allow app to access your location while using the service',
  },
  {
    key: 'shareRideInfo',
    title: 'Share Ride Information',
    description: 'Allow sharing your trip status with friends and family',
  },
  {
    key: 'marketingEmails',
    title: 'Marketing Emails',
    description: 'Receive promotional emails and offers',
  },
  {
    key: 'dataCollection',
    title: 'Data Collection',
    description: 'Allow collection of usage data to improve service quality',
  },
];
