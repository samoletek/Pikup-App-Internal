import { seedInitialProfileStats } from './authProfileSeedUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  fetchProfileByTableAndUserId,
  insertProfileRow,
} from './repositories/authRepository';

const CUSTOMER_TABLE = 'customers';
const DRIVER_TABLE = 'drivers';

export const getProfileTableByRole = (role) =>
  role === 'driver' ? DRIVER_TABLE : CUSTOMER_TABLE;

export const buildSignupProfileData = ({ authUser, additionalData = {} }) => {
  return {
    id: authUser.id,
    email: authUser.email,
    first_name: additionalData.firstName || '',
    last_name: additionalData.lastName || '',
    phone_number: additionalData.phoneNumber || '',
    phone_verified: !!additionalData.phoneVerified,
    rating: 5.0,
    created_at: new Date().toISOString(),
  };
};

export const insertProfileForSignup = async ({
  tableName,
  authUser,
  userType,
  additionalData = {},
}) => {
  const profileData = buildSignupProfileData({ authUser, additionalData });
  const { error } = await insertProfileRow(tableName, profileData);

  if (error) {
    logger.warn('AuthProfile', `Error creating profile in ${tableName}`, error);
    return profileData;
  }

  logger.info('AuthProfile', `Profile created in ${tableName}`);
  try {
    await seedInitialProfileStats(tableName, authUser.id, userType);
  } catch (seedError) {
    const normalized = normalizeError(seedError, 'Could not seed initial profile stats');
    logger.warn('AuthProfile', 'Could not seed initial profile stats', normalized, seedError);
  }

  return profileData;
};

const fetchProfileByTable = async ({ tableName, userId }) => {
  const { data } = await fetchProfileByTableAndUserId(tableName, userId, {
    columns: '*',
    maybeSingle: false,
  });
  return data || null;
};

const fetchProfileByTableSoft = async ({ tableName, userId }) => {
  const { data } = await fetchProfileByTableAndUserId(tableName, userId, {
    columns: '*',
    maybeSingle: true,
  });
  return data || null;
};

export const resolveProfileForLogin = async ({ userId, expectedRole }) => {
  if (expectedRole) {
    const tableName = getProfileTableByRole(expectedRole);
    const profile = await fetchProfileByTable({ tableName, userId });
    return {
      profile,
      resolvedRole: expectedRole,
      tableName,
    };
  }

  const customerProfile = await fetchProfileByTableSoft({
    tableName: CUSTOMER_TABLE,
    userId,
  });
  if (customerProfile) {
    return {
      profile: customerProfile,
      resolvedRole: 'customer',
      tableName: CUSTOMER_TABLE,
    };
  }

  const driverProfile = await fetchProfileByTableSoft({
    tableName: DRIVER_TABLE,
    userId,
  });
  if (driverProfile) {
    return {
      profile: driverProfile,
      resolvedRole: 'driver',
      tableName: DRIVER_TABLE,
    };
  }

  return {
    profile: null,
    resolvedRole: null,
    tableName: null,
  };
};

export const ensureRoleMismatchError = async ({ userId, expectedRole }) => {
  if (!expectedRole) {
    return null;
  }

  const otherTable = expectedRole === 'driver' ? CUSTOMER_TABLE : DRIVER_TABLE;
  const { data } = await fetchProfileByTableAndUserId(otherTable, userId, {
    columns: 'id',
    maybeSingle: true,
  });

  if (!data) {
    return null;
  }

  const displayRole = otherTable === DRIVER_TABLE ? 'Driver' : 'Customer';
  return new Error(`Wrong portal. You are registered as a ${displayRole}. Please use the correct login button.`);
};

export const buildFullAuthUser = ({
  authUser,
  profile,
  userType,
  accessToken,
}) => {
  return {
    ...authUser,
    ...(profile || {}),
    uid: authUser.id,
    accessToken,
    user_type: userType,
  };
};
