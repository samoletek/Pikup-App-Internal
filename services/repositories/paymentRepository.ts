import { supabase } from '../../config/supabase';
import type { PaymentMethod } from '../contracts/domain';
import type {
  CreateDriverConnectAccountResponse,
  CreateDriverConnectAccountRequest,
  CreateVerificationSessionRequest,
  CreateVerificationSessionResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  DriverOnboardingLinkRequest,
  DriverOnboardingLinkResponse,
  DriverOnboardingStatusRequest,
  DriverOnboardingStatusResponse,
  GetPaymentMethodsResponse,
  GetVerificationDataRequest,
  GetVerificationDataResponse,
  ProcessPayoutResponse,
  ProcessPayoutRequest,
  TripPriceEstimateRequest,
  TripPriceEstimateResponse,
  VerifyVehicleRequest,
  VerifyVehicleResponse,
} from '../../supabase/functions/_shared/contracts';

const EDGE_TOKEN_EXPIRY_SKEW_SECONDS = 60;

type PaymentMethodsResponse = GetPaymentMethodsResponse & {
  paymentMethods?: PaymentMethod[];
  defaultPaymentMethod?: PaymentMethod | null;
};

const isSessionFresh = (session?: { access_token?: string; expires_at?: number | null } | null) => {
  if (!session?.access_token) {
    return false;
  }

  const expiresAt = Number(session.expires_at || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt > nowSeconds + EDGE_TOKEN_EXPIRY_SKEW_SECONDS;
};

const looksLikeJwt = (token: string) => token.split('.').length === 3;

const isUsableAccessToken = async (token: string) => {
  const candidate = String(token || '').trim();
  if (!looksLikeJwt(candidate)) {
    return false;
  }

  const { data, error } = await supabase.auth.getUser(candidate);
  return !error && Boolean(data?.user);
};

const resolveEdgeAccessToken = async (accessTokenHint?: string | null) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const currentSession = sessionData?.session;

  if (!sessionError && isSessionFresh(currentSession) && await isUsableAccessToken(currentSession.access_token)) {
    return currentSession.access_token;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedSession = refreshedData?.session;

  if (!refreshError && refreshedSession?.access_token && await isUsableAccessToken(refreshedSession.access_token)) {
    return refreshedSession.access_token;
  }

  const currentSessionToken = String(currentSession?.access_token || '').trim();
  if (await isUsableAccessToken(currentSessionToken)) {
    return currentSessionToken;
  }

  const hintedAccessTokenValue = String(accessTokenHint || '').trim();
  if (await isUsableAccessToken(hintedAccessTokenValue)) {
    return hintedAccessTokenValue;
  }

  throw new Error('Session expired. Please sign in again.');
};

/**
 * Payment repository centralizes payment-related Supabase queries and edge-function calls.
 */
export const invokeGetPaymentMethods = async () => {
  return supabase.functions.invoke<PaymentMethodsResponse>('get-payment-methods');
};

export const invokeCreatePaymentIntent = async (payload: CreatePaymentIntentRequest) => {
  return supabase.functions.invoke<CreatePaymentIntentResponse>('create-payment-intent', {
    body: payload,
  });
};

export const invokeTripPriceEstimate = async (rideDetails: TripPriceEstimateRequest["rideDetails"]) => {
  return supabase.functions.invoke<TripPriceEstimateResponse>('calculate-trip-price', {
    body: { rideDetails },
  });
};

export const invokeCreateDriverConnectAccount = async (
  payload: CreateDriverConnectAccountRequest,
  accessTokenHint?: string | null,
) => {
  const accessToken = await resolveEdgeAccessToken(accessTokenHint);
  return supabase.functions.invoke<CreateDriverConnectAccountResponse>('create-driver-connect-account', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const invokeDriverOnboardingLink = async (
  payload: DriverOnboardingLinkRequest,
  accessTokenHint?: string | null,
) => {
  const accessToken = await resolveEdgeAccessToken(accessTokenHint);
  return supabase.functions.invoke<DriverOnboardingLinkResponse>('get-driver-onboarding-link', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const invokeDriverOnboardingStatus = async (
  payload: DriverOnboardingStatusRequest,
  accessTokenHint?: string | null,
) => {
  const accessToken = await resolveEdgeAccessToken(accessTokenHint);
  return supabase.functions.invoke<DriverOnboardingStatusResponse>('check-driver-onboarding-status', {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export const invokeProcessPayout = async (payload: ProcessPayoutRequest) => {
  return supabase.functions.invoke<ProcessPayoutResponse>('process-payout', {
    body: payload,
  });
};

export const invokeCreateVerificationSession = async (payload: CreateVerificationSessionRequest) => {
  return supabase.functions.invoke<CreateVerificationSessionResponse>('create-verification-session', {
    body: payload,
  });
};

export const invokeGetVerificationData = async (payload: GetVerificationDataRequest) => {
  return supabase.functions.invoke<GetVerificationDataResponse>('get-verification-data', {
    body: payload,
  });
};

export const invokeVerifyVehicle = async (payload: VerifyVehicleRequest) => {
  return supabase.functions.invoke<VerifyVehicleResponse>('verify-vehicle', {
    body: payload,
  });
};

export const fetchDriverRowById = async (
  driverId: string,
  columns = '*',
  maybeSingle = true,
) => {
  if (maybeSingle) {
    return supabase
      .from('drivers')
      .select(columns)
      .eq('id', driverId)
      .maybeSingle();
  }

  return supabase
    .from('drivers')
    .select(columns)
    .eq('id', driverId)
    .single();
};

export const updateDriverRowById = async (
  driverId: string,
  updates: Record<string, unknown>,
  withSelect = false,
) => {
  if (withSelect) {
    return supabase
      .from('drivers')
      .update(updates)
      .eq('id', driverId)
      .select('*')
      .maybeSingle();
  }

  return supabase
    .from('drivers')
    .update(updates)
    .eq('id', driverId);
};

export const upsertDriverRowWithSelect = async (payload: Record<string, unknown>) => {
  return supabase
    .from('drivers')
    .upsert(payload)
    .select('*')
    .maybeSingle();
};

export const getAuthenticatedUser = async () => {
  return supabase.auth.getUser();
};

export const fetchCompletedDriverTrips = async (driverId: string, fromIso: string) => {
  return supabase
    .from('trips')
    .select('id, price, created_at, completed_at, distance_miles, status')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('created_at', fromIso)
    .order('created_at', { ascending: false });
};
