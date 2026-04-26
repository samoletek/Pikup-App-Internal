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
  DriverPayoutAvailabilityRequest,
  DriverPayoutAvailabilityResponse,
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

type PaymentMethodsResponse = GetPaymentMethodsResponse & {
  paymentMethods?: PaymentMethod[];
  defaultPaymentMethod?: PaymentMethod | null;
};

const isInvalidJwtEdgeError = async (error: unknown) => {
  const maybeError = error as {
    context?: { status?: number; clone?: () => { json: () => Promise<unknown> } };
  } | null;
  const statusCode = Number(maybeError?.context?.status || 0);
  if (statusCode === 401) {
    return true;
  }

  try {
    const payload = await maybeError?.context?.clone?.().json?.();
    const message = String(
      (payload as { error?: unknown; message?: unknown } | null)?.error ||
        (payload as { message?: unknown } | null)?.message ||
        ''
    )
      .trim()
      .toLowerCase();
    const code = String(
      (payload as { code?: unknown; errorCode?: unknown } | null)?.code ||
        (payload as { errorCode?: unknown } | null)?.errorCode ||
        ''
    )
      .trim()
      .toLowerCase();
    return message.includes('invalid jwt') || code === '401' || code === 'invalid_jwt';
  } catch {
    return false;
  }
};

const invokeEdgeFunction = async <T>(functionName: string, payload?: Record<string, unknown>) => {
  return supabase.functions.invoke<T>(functionName, payload ? { body: payload } : undefined);
};

const invokeWithAuthRetry = async <T>(
  functionName: string,
  payload?: Record<string, unknown>,
  _accessTokenHint?: string | null
) => {
  let result = await invokeEdgeFunction<T>(functionName, payload);

  if (!result.error) {
    return result;
  }

  const shouldRetryForInvalidJwt = await isInvalidJwtEdgeError(result.error);
  if (!shouldRetryForInvalidJwt) {
    return result;
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return result;
  }

  result = await invokeEdgeFunction<T>(functionName, payload);
  return result;
};

export const ensurePaymentAuthSessionReady = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  if (sessionData?.session?.access_token) {
    return;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshedData?.session?.access_token) {
    throw new Error('Session expired. Please sign in again.');
  }
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
  return invokeWithAuthRetry<SetDefaultPaymentMethodResponse>(
    'set-default-payment-method',
    payload
  );
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

export const invokeTripPriceEstimate = async (
  rideDetails: TripPriceEstimateRequest['rideDetails']
) => {
  return supabase.functions.invoke<TripPriceEstimateResponse>('calculate-trip-price', {
    body: { rideDetails },
  });
};

export const invokeCreateDriverConnectAccount = async (
  payload: CreateDriverConnectAccountRequest,
  accessTokenHint?: string | null
) => {
  return invokeWithAuthRetry<CreateDriverConnectAccountResponse>(
    'create-driver-connect-account',
    payload,
    accessTokenHint
  );
};

export const invokeDriverOnboardingLink = async (
  payload: DriverOnboardingLinkRequest,
  accessTokenHint?: string | null
) => {
  return invokeWithAuthRetry<DriverOnboardingLinkResponse>(
    'get-driver-onboarding-link',
    payload,
    accessTokenHint
  );
};

export const invokeDriverOnboardingStatus = async (
  payload: DriverOnboardingStatusRequest,
  accessTokenHint?: string | null
) => {
  return invokeWithAuthRetry<DriverOnboardingStatusResponse>(
    'check-driver-onboarding-status',
    payload,
    accessTokenHint
  );
};

export const invokeProcessPayout = async (payload: ProcessPayoutRequest) => {
  return invokeWithAuthRetry<ProcessPayoutResponse>('process-payout', payload);
};

export const invokeDriverPayoutAvailability = async (payload: DriverPayoutAvailabilityRequest) => {
  return invokeWithAuthRetry<DriverPayoutAvailabilityResponse>(
    'get-driver-payout-availability',
    payload
  );
};

export const invokeCreateVerificationSession = async (
  payload: CreateVerificationSessionRequest,
  accessTokenHint?: string | null
) => {
  return invokeWithAuthRetry<CreateVerificationSessionResponse>(
    'create-verification-session',
    payload,
    accessTokenHint
  );
};

export const invokeGetVerificationData = async (
  payload: GetVerificationDataRequest,
  accessTokenHint?: string | null
) => {
  return invokeWithAuthRetry<GetVerificationDataResponse>(
    'get-verification-data',
    payload,
    accessTokenHint
  );
};

export const invokeVerifyVehicle = async (payload: VerifyVehicleRequest) => {
  return supabase.functions.invoke<VerifyVehicleResponse>('verify-vehicle', {
    body: payload,
  });
};

export const fetchDriverRowById = async (driverId: string, columns = '*', maybeSingle = true) => {
  if (maybeSingle) {
    return supabase.from('drivers').select(columns).eq('id', driverId).maybeSingle();
  }

  return supabase.from('drivers').select(columns).eq('id', driverId).single();
};

export const updateDriverRowById = async (
  driverId: string,
  updates: Record<string, unknown>,
  withSelect = false
) => {
  if (withSelect) {
    return supabase.from('drivers').update(updates).eq('id', driverId).select('*').maybeSingle();
  }

  return supabase.from('drivers').update(updates).eq('id', driverId);
};

export const upsertDriverRowWithSelect = async (payload: Record<string, unknown>) => {
  return supabase.from('drivers').upsert(payload).select('*').maybeSingle();
};

export const getAuthenticatedUser = async () => {
  return supabase.auth.getUser();
};

export const fetchCompletedDriverTrips = async (driverId: string, fromIso: string) => {
  return supabase
    .from('trips')
    .select(
      'id, price, created_at, completed_at, distance_miles, actual_duration_minutes, status, pickup_location, insurance_premium'
    )
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('completed_at', fromIso)
    .order('completed_at', { ascending: false });
};
