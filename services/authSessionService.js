import {
  fetchProfileByTableAndUserId,
  subscribeAuthStateChanges,
} from './repositories/authRepository';

const getProfileTableByRole = (userType) => (userType === 'driver' ? 'drivers' : 'customers');

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

export const detectUserTypeForSession = async ({ userId, metadataUserType }) => {
  if (metadataUserType) {
    return metadataUserType;
  }

  const [{ data: driverProfile }, { data: customerProfile }] = await Promise.all([
    fetchProfileByTableAndUserId('drivers', userId, { columns: 'id', maybeSingle: true }),
    fetchProfileByTableAndUserId('customers', userId, { columns: 'id', maybeSingle: true }),
  ]);

  return driverProfile ? 'driver' : customerProfile ? 'customer' : 'customer';
};

export const fetchUserProfileByRole = async ({ userId, userType }) => {
  const table = getProfileTableByRole(userType);
  const { data, error } = await fetchProfileByTableAndUserId(table, userId, {
    columns: '*',
    maybeSingle: false,
  });

  if (error) {
    throw error;
  }

  return data;
};
