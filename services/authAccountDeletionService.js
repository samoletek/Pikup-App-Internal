import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  getAuthenticatedSession,
  invokeDeleteUserAccount,
} from './repositories/authRepository';

const getFunctionErrorMessage = async (error) => {
  if (!error?.context) {
    return '';
  }

  try {
    const errorBody = await error.context.clone().json();
    return errorBody?.error || errorBody?.message || '';
  } catch (_parseError) {
    const normalized = normalizeError(_parseError, '');
    try {
      return await error.context.clone().text();
    } catch (_textParseError) {
      const normalizedText = normalizeError(_textParseError, '');
      return normalized.message || normalizedText.message || '';
    }
  }
};

const resolveSessionAccessToken = async () => {
  const { data: sessionData, error: sessionError } = await getAuthenticatedSession();
  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again and retry account deletion.');
  }

  return accessToken;
};

export const invokeDeleteAccountEdgeFunction = async ({ userId }) => {
  logger.info('AuthDelete', 'Starting account deletion process');
  const accessToken = await resolveSessionAccessToken();

  const { data, error } = await invokeDeleteUserAccount({
    accessToken,
    userId,
  });

  if (error) {
    const functionMessage = await getFunctionErrorMessage(error);
    throw new Error(functionMessage || error?.message || 'Failed to delete account');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to delete account');
  }

  logger.info('AuthDelete', 'Account fully deleted via Edge Function');
  return true;
};
