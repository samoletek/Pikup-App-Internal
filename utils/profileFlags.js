/**
 * Checks whether a profile flag value is truthy.
 * Handles booleans, stringified booleans, and numeric 1/"1" from Supabase.
 */
export const isTruthyProfileFlag = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

/**
 * Resolves phone_verified status from a user profile object.
 * Checks both snake_case and camelCase keys with truthy parsing.
 */
export const isPhoneVerified = (user) =>
  isTruthyProfileFlag(user?.phone_verified ?? user?.phoneVerified);
