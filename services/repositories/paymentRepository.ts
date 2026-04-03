import { supabase } from '../../config/supabase';
import type { PaymentMethod } from '../contracts/domain';
import type {
  CreateDriverConnectAccountResponse,
  CreateDriverConnectAccountRequest,
  CreateVerificationSessionRequest,
  CreateVerificationSessionResponse,
  CreateTipPaymentRequest,
  CreateTipPaymentResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  AuthorizeTripPaymentRequest,
  AuthorizeTripPaymentResponse,
  CaptureTripPaymentRequest,
  CaptureTripPaymentResponse,
  DriverOnboardingLinkRequest,
  DriverOnboardingLinkResponse,
  DriverOnboardingStatusRequest,
  DriverOnboardingStatusResponse,
  AttachPaymentMethodRequest,
  AttachPaymentMethodResponse,
  DetachPaymentMethodRequest,
  DetachPaymentMethodResponse,
  GetPaymentMethodsResponse,
  SetDefaultPaymentMethodRequest,
  SetDefaultPaymentMethodResponse,
  GetVerificationDataRequest,
  GetVerificationDataResponse,
  ProcessPayoutResponse,
  ProcessPayoutRequest,
  ReleaseTripPaymentRequest,
  ReleaseTripPaymentResponse,
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

const isInvalidJwtEdgeError = async (error: unknown) => {
  const maybeError = error as { context?: { status?: number; clone?: () => { json: () => Promise<unknown> } } } | null;
  const statusCode = Number(maybeError?.context?.status || 0);
  if (statusCode === 401) {
    return true;
  }

  try {
    const payload = await maybeError?.context?.clone?.().json?.();
    const message = String((payload as { error?: unknown; message?: unknown } | null)?.error || (payload as { message?: unknown } | null)?.message || '')
      .trim()
      .toLowerCase();
    const code = String((payload as { code?: unknown; errorCode?: unknown } | null)?.code || (payload as { errorCode?: unknown } | null)?.errorCode || '')
      .trim()
      .toLowerCase();
    return message.includes('invalid jwt') || code === '401' || code === 'invalid_jwt';
  } catch {
    return false;
  }
};

const invokeWithAuthRetry = async <T>(
  functionName: string,
  payload?: Record<string, unknown>,
) => {
  const invoke = async (accessToken: string) =>
    supabase.functions.invoke<T>(functionName, {
      ...(payload ? { body: payload } : {}),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

  const accessToken = await resolveEdgeAccessToken();
  let result = await invoke(accessToken);

  if (!result.error) {
    return result;
  }

  const shouldRetryForInvalidJwt = await isInvalidJwtEdgeError(result.error);
  if (!shouldRetryForInvalidJwt) {
    return result;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  const refreshedToken = String(refreshedData?.session?.access_token || '').trim();
  if (refreshError || !refreshedToken) {
    return result;
  }

  result = await invoke(refreshedToken);
  return result;
};

export const ensurePaymentAuthSessionReady = async () => {
  await resolveEdgeAccessToken();
};

/**
 * Payment repository centralizes payment-related Supabase queries and edge-function calls.
 */
export const invokeGetPaymentMethods = async () => {
  return invokeWithAuthRetry<PaymentMethodsResponse>('get-payment-methods');
};

export const invokeAttachPaymentMethod = async (payload: AttachPaymentMethodRequest) => {
  return invokeWithAuthRetry<AttachPaymentMethodResponse>('attach-payment-method', payload);
};

export const invokeDetachPaymentMethod = async (payload: DetachPaymentMethodRequest) => {
  return invokeWithAuthRetry<DetachPaymentMethodResponse>('detach-payment-method', payload);
};

export const invokeSetDefaultPaymentMethod = async (payload: SetDefaultPaymentMethodRequest) => {
  return invokeWithAuthRetry<SetDefaultPaymentMethodResponse>('set-default-payment-method', payload);
};

export const invokeCreatePaymentIntent = async (payload: CreatePaymentIntentRequest) => {
  return supabase.functions.invoke<CreatePaymentIntentResponse>('create-payment-intent', {
    body: payload,
  });
};

export const invokeAuthorizeTripPayment = async (payload: AuthorizeTripPaymentRequest) => {
  return supabase.functions.invoke<AuthorizeTripPaymentResponse>('authorize-trip-payment', {
    body: payload,
  });
};

export const invokeCaptureTripPayment = async (payload: CaptureTripPaymentRequest) => {
  return supabase.functions.invoke<CaptureTripPaymentResponse>('capture-trip-payment', {
    body: payload,
  });
};

export const invokeReleaseTripPayment = async (payload: ReleaseTripPaymentRequest) => {
  return supabase.functions.invoke<ReleaseTripPaymentResponse>('release-trip-payment', {
    body: payload,
  });
};

export const invokeCreateTipPayment = async (payload: CreateTipPaymentRequest) => {
  return supabase.functions.invoke<CreateTipPaymentResponse>('create-tip-payment', {
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
  return invokeWithAuthRetry<CreateVerificationSessionResponse>('create-verification-session', payload);
};

export const invokeGetVerificationData = async (payload: GetVerificationDataRequest) => {
  return invokeWithAuthRetry<GetVerificationDataResponse>('get-verification-data', payload);
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
    .select('id, price, created_at, completed_at, distance_miles, actual_duration_minutes, status, pickup_location, insurance_premium')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .order('completed_at', { ascending: false });
};
