import {
  fetchProfileByTableAndUserId,
  subscribeAuthStateChanges,
} from './repositories/authRepository';

const getProfileTableByRole = (userType) => (userType === 'driver' ? 'drivers' : 'customers');
const isNoRowsError = (error) => error?.code === 'PGRST116';
const normalizeUserType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'driver' || normalized === 'customer') {
    return normalized;
  }

  return null;
};

export const subscribeToAuthStateChanges = (handler) => {
  const {
    data: { subscription },
  } = subscribeAuthStateChanges((event, session) => {
    void handler?.(event, session);
  });

  return () => {
    subscription?.unsubscribe();
  };
};

export const detectUserTypeForSession = async ({
  userId,
  metadataUserType,
  preferredUserType = null,
}) => {
  const normalizedMetadataUserType = normalizeUserType(metadataUserType);
  const normalizedPreferredUserType = normalizeUserType(preferredUserType);
  if (!userId) {
    return normalizedPreferredUserType || normalizedMetadataUserType || 'customer';
  }

  const [{ data: driverProfile }, { data: customerProfile }] = await Promise.all([
    fetchProfileByTableAndUserId('drivers', userId, { columns: 'id', maybeSingle: true }),
    fetchProfileByTableAndUserId('customers', userId, { columns: 'id', maybeSingle: true }),
  ]);

  const hasDriverProfile = Boolean(driverProfile);
  const hasCustomerProfile = Boolean(customerProfile);

  if (normalizedPreferredUserType === 'driver' && hasDriverProfile) {
    return 'driver';
  }

  if (normalizedPreferredUserType === 'customer' && hasCustomerProfile) {
    return 'customer';
  }

  if (normalizedMetadataUserType === 'driver' && hasDriverProfile) {
    return 'driver';
  }

  if (normalizedMetadataUserType === 'customer' && hasCustomerProfile) {
    return 'customer';
  }

  if (hasDriverProfile && !hasCustomerProfile) {
    return 'driver';
  }

  if (hasCustomerProfile && !hasDriverProfile) {
    return 'customer';
  }

  return normalizedPreferredUserType || normalizedMetadataUserType || 'customer';
};

export const fetchUserProfileByRole = async ({ userId, userType }) => {
  const table = getProfileTableByRole(userType);
  const { data, error } = await fetchProfileByTableAndUserId(table, userId, {
    columns: '*',
    maybeSingle: true,
  });

  if (error) {
    if (isNoRowsError(error)) {
      return null;
    }
    throw error;
  }

  return data;
};
