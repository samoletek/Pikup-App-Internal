import {
  getAuthenticatedSession,
  invokeUserDataExport,
} from './repositories/authRepository';
import { normalizeError } from './errorService';

export const requestUserDataExport = async ({ role }) => {
  const { data: sessionData, error: sessionError } = await getAuthenticatedSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }

  const { error } = await invokeUserDataExport({
    accessToken: sessionData.session.access_token,
    role,
  });

  if (!error) {
    return;
  }

  let errorMessage = 'Failed to send data export.';
  if (error?.context) {
    try {
      const errorBody = await error.context.clone().json();
      errorMessage = errorBody?.error || errorBody?.message || errorMessage;
    } catch (_contextError) {
      const normalized = normalizeError(_contextError, errorMessage);
      errorMessage = normalized.message || errorMessage;
      // Keep default message when response cannot be parsed.
    }
  }

  throw new Error(errorMessage);
};
