// Domain models: canonical shared shapes used by service/repository contracts.
export type JsonRecord = Record<string, unknown>;

export type TripRequest = {
  id?: string;
  customer_id?: string | null;
  driver_id?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  price?: number | null;
  [key: string]: unknown;
};

export type PaymentMethod = {
  id?: string;
  stripePaymentMethodId?: string | null;
  brand?: string | null;
  cardBrand?: string | null;
  last4?: string | null;
  expMonth?: number | string | null;
  expYear?: number | string | null;
  isDefault?: boolean;
  [key: string]: unknown;
};

export type AuthSessionUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata?: JsonRecord;
  app_metadata?: JsonRecord;
  [key: string]: unknown;
};

export type ClaimRequest = {
  bookingId: string;
  lossType: string;
  lossDate: string;
  lossDescription: string;
  lossEstimatedClaimValue?: number | null;
  claimantName?: string | null;
  claimantEmail?: string | null;
  documentTypes?: string[];
};
