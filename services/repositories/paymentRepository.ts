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

type PaymentMethodsResponse = GetPaymentMethodsResponse & {
  paymentMethods?: PaymentMethod[];
  defaultPaymentMethod?: PaymentMethod | null;
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

export const invokeCreateDriverConnectAccount = async (payload: CreateDriverConnectAccountRequest) => {
  return supabase.functions.invoke<CreateDriverConnectAccountResponse>('create-driver-connect-account', {
    body: payload,
  });
};

export const invokeDriverOnboardingLink = async (payload: DriverOnboardingLinkRequest) => {
  return supabase.functions.invoke<DriverOnboardingLinkResponse>('get-driver-onboarding-link', {
    body: payload,
  });
};

export const invokeDriverOnboardingStatus = async (payload: DriverOnboardingStatusRequest) => {
  return supabase.functions.invoke<DriverOnboardingStatusResponse>('check-driver-onboarding-status', {
    body: payload,
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
