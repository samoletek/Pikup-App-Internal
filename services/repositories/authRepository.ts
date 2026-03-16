import { supabase } from '../../config/supabase';
import type { AuthSessionUser } from '../contracts/domain';
import type {
  CheckUserExistsRequest,
  CheckUserExistsResponse,
  DeleteUserRequest,
  DeleteUserResponse,
  DownloadUserDataRequest,
  DownloadUserDataResponse,
  SendPhoneOtpRequest,
  SendPhoneOtpResponse,
  VerifyPhoneOtpRequest,
  VerifyPhoneOtpResponse,
} from '../../supabase/functions/_shared/contracts';

type RowPayload = Record<string, unknown>;
type UserMetadata = AuthSessionUser["user_metadata"];
type AuthStateChangeHandler = Parameters<typeof supabase.auth.onAuthStateChange>[0];

type FetchProfileOptions = {
  columns?: string;
  maybeSingle?: boolean;
};

/**
 * Auth repository centralizes Supabase auth/profile persistence calls.
 */
export const subscribeAuthStateChanges = (handler: AuthStateChangeHandler) => {
  return supabase.auth.onAuthStateChange(handler);
};

export const fetchProfileByTableAndUserId = async (
  tableName: string,
  userId: string,
  options: FetchProfileOptions = {},
) => {
  const { columns = '*', maybeSingle = false } = options;
  if (maybeSingle) {
    return supabase
      .from(tableName)
      .select(columns)
      .eq('id', userId)
      .maybeSingle();
  }

  return supabase
    .from(tableName)
    .select(columns)
    .eq('id', userId)
    .single();
};

export const insertProfileRow = async (tableName: string, payload: RowPayload) => {
  return supabase
    .from(tableName)
    .insert(payload);
};

export const updateProfileByTableAndUserId = async (
  tableName: string,
  userId: string,
  updates: RowPayload,
) => {
  return supabase
    .from(tableName)
    .update(updates)
    .eq('id', userId);
};

export const updateProfileByTableAndUserIdWithSelect = async (
  tableName: string,
  userId: string,
  updates: RowPayload,
) => {
  return supabase
    .from(tableName)
    .update(updates)
    .eq('id', userId)
    .select('*')
    .maybeSingle();
};

export const upsertProfileRowWithSelect = async (tableName: string, payload: RowPayload) => {
  return supabase
    .from(tableName)
    .upsert(payload)
    .select('*')
    .maybeSingle();
};

export const getAuthenticatedUser = async () => {
  return supabase.auth.getUser();
};

export const getAuthenticatedSession = async () => {
  return supabase.auth.getSession();
};

export const refreshAuthenticatedSession = async () => {
  return supabase.auth.refreshSession();
};

export const invokeUserDataExport = async ({
  accessToken,
  role,
}: {
  accessToken: string;
  role: DownloadUserDataRequest["role"];
}) => {
  return supabase.functions.invoke<DownloadUserDataResponse>('download-user-data', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: { role } satisfies DownloadUserDataRequest,
  });
};

export const invokeDeleteUserAccount = async ({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId?: DeleteUserRequest["userId"];
}) => {
  return supabase.functions.invoke<DeleteUserResponse>('delete-user', {
    body: { userId } satisfies DeleteUserRequest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const invokeSendPhoneOtp = async ({
  phone,
  userId,
  userTable,
}: {
  phone: SendPhoneOtpRequest["phone"];
  userId?: SendPhoneOtpRequest["userId"];
  userTable?: SendPhoneOtpRequest["userTable"];
}) => {
  const payload: SendPhoneOtpRequest = {
    phone,
    userId: userId || null,
    userTable: userTable || null,
  };

  return supabase.functions.invoke<SendPhoneOtpResponse>('send-phone-otp', {
    body: payload,
  });
};

export const invokeVerifyPhoneOtp = async ({
  phone,
  code,
}: {
  phone: VerifyPhoneOtpRequest["phone"];
  code: VerifyPhoneOtpRequest["code"];
}) => {
  return supabase.functions.invoke<VerifyPhoneOtpResponse>('verify-phone-otp', {
    body: { phone, code } satisfies VerifyPhoneOtpRequest,
  });
};

export const signUpWithPassword = async ({
  email,
  password,
  metadata = {},
}: {
  email: string;
  password: string;
  metadata?: UserMetadata;
}) => {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
};

export const signInWithPassword = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signInWithIdToken = async ({
  provider,
  token,
  nonce,
}: {
  provider: 'apple' | 'google' | string;
  token: string;
  nonce?: string;
}) => {
  return supabase.auth.signInWithIdToken({
    provider,
    token,
    nonce,
  });
};

export const signInWithOAuth = async ({
  provider,
  options = {},
}: {
  provider: Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'];
  options?: Record<string, unknown>;
}) => {
  return supabase.auth.signInWithOAuth({
    provider,
    options,
  });
};

export const setAuthenticatedSession = async ({
  accessToken,
  refreshToken,
}: {
  accessToken: string;
  refreshToken: string;
}) => {
  return supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

export const updateAuthenticatedUser = async (updates: Record<string, unknown>) => {
  return supabase.auth.updateUser(updates);
};

export const resetPasswordForEmail = async (email: string) => {
  return supabase.auth.resetPasswordForEmail(email);
};

export const invokeCheckUserExists = async (email: CheckUserExistsRequest["email"]) => {
  return supabase.functions.invoke<CheckUserExistsResponse>('check-user-exists', {
    body: { email } satisfies CheckUserExistsRequest,
  });
};

export const upsertProfileRow = async (tableName: string, payload: RowPayload) => {
  return supabase
    .from(tableName)
    .upsert(payload);
};
