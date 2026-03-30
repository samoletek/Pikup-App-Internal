/**
 * Shared Edge Function DTO contracts.
 * Keep payload and response shapes synchronized between frontend services and Supabase functions.
 */

export type EdgeErrorPayload = {
  error: string
  code?: string | null
}

export type EdgeSuccessPayload<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  success?: true
}

export type EdgePayload<T extends Record<string, unknown>> = EdgeSuccessPayload<T> | EdgeErrorPayload

export type DriverRequestPool = "all" | "asap" | "scheduled"
export type DriverRequestPoolAction = "list" | "decline"

export type AcceptTripRequest = {
  tripId: string
  driverId: string
}

export type AcceptTripResponse = EdgePayload<{
  success: true
  message?: string
  trip?: {
    id?: string
    status?: string
  }
}>

export type DriverRequestPoolRequest = {
  action?: DriverRequestPoolAction
  tripId?: string
  requestPool?: DriverRequestPool
  driverLocation?: {
    latitude: number
    longitude: number
  } | null
}

export type DriverRequestPoolResponse = EdgePayload<{
  success: true
  trips?: Array<Record<string, unknown>>
  declinedTripId?: string
}>

export type RedkikQuoteAction = "setup" | "get-quote" | "purchase" | "complete" | "cancel"

export type RedkikQuoteRequest = {
  action: RedkikQuoteAction
} & Record<string, unknown>

export type RedkikQuoteResponse = EdgePayload<{
  action?: RedkikQuoteAction
  offerId?: string
  premium?: number
  redkikPremium?: number
  serviceFee?: number
  canPurchase?: boolean
  amendments?: unknown[]
  details?: Record<string, unknown>
  validationErrors?: string[]
  bookingId?: string
}>

export type CheckUserExistsRequest = {
  email: string
}

export type CheckUserExistsResponse = EdgePayload<{
  exists: boolean
  userType: "driver" | "customer" | null
}>

export type DeleteUserRequest = {
  userId?: string | null
}

export type DeleteUserResponse = EdgePayload<{
  success: boolean
  message?: string
}>

export type DownloadUserDataRequest = {
  role: "customer" | "driver"
}

export type DownloadUserDataResponse = EdgePayload<{
  success: boolean
  message?: string
}>

export type SendPhoneOtpRequest = {
  phone: string
  userId?: string | null
  userTable?: "drivers" | "customers" | null
}

export type SendPhoneOtpResponse = EdgePayload<{
  success: true
  status?: string
}>

export type VerifyPhoneOtpRequest = {
  phone: string
  code: string
}

export type VerifyPhoneOtpResponse = EdgePayload<{
  success: boolean
  verified: boolean
}>

export type CreatePaymentIntentRequest = {
  amount: number
  currency?: string
  userEmail?: string | null
  userId?: string | null
  paymentMethodId?: string | null
  rideDetails?: Record<string, unknown>
  destinationAccountId?: string | null
  applicationFeeAmount?: number | null
}

export type CreatePaymentIntentResponse = EdgePayload<{
  clientSecret: string
  paymentIntentId?: string | null
}>

export type AuthorizeTripPaymentRequest = {
  tripId: string
  customerId?: string | null
  paymentMethodId: string
  amountCents: number
  currency?: "usd"
  idempotencyKey?: string | null
}

export type AuthorizeTripPaymentResponse = EdgePayload<{
  success: true
  paymentIntentId: string
  status: string
}>

export type CaptureTripPaymentRequest = {
  tripId: string
  idempotencyKey?: string | null
}

export type CaptureTripPaymentResponse = EdgePayload<{
  success: true
  paymentIntentId: string
  chargeId?: string | null
  status: string
}>

export type ReleaseTripPaymentRequest = {
  tripId: string
  reason?: string | null
  idempotencyKey?: string | null
}

export type ReleaseTripPaymentResponse = EdgePayload<{
  success: true
  paymentIntentId?: string | null
  status: string
}>

export type CreateTipPaymentRequest = {
  tripId: string
  tipAmountCents: number
  idempotencyKey?: string | null
}

export type CreateTipPaymentResponse = EdgePayload<{
  success: true
  tipPaymentIntentId: string
  amount: number
  status: string
}>

export type GetPaymentMethodsResponse = EdgePayload<{
  paymentMethods: Array<Record<string, unknown>>
}>

export type AttachPaymentMethodRequest = {
  paymentMethodId: string
  setAsDefault?: boolean
}

export type AttachPaymentMethodResponse = EdgePayload<{
  success: true
  paymentMethodId: string
  defaultPaymentMethodId?: string | null
}>

export type DetachPaymentMethodRequest = {
  paymentMethodId: string
}

export type DetachPaymentMethodResponse = EdgePayload<{
  success: true
  detachedPaymentMethodId: string
  defaultPaymentMethodId?: string | null
}>

export type SetDefaultPaymentMethodRequest = {
  paymentMethodId: string
}

export type SetDefaultPaymentMethodResponse = EdgePayload<{
  success: true
  defaultPaymentMethodId: string
}>

export type TripPriceEstimateRequest = {
  rideDetails?: Record<string, unknown>
}

export type TripPriceEstimateResponse = EdgePayload<{
  estimate?: Record<string, unknown>
}>

export type CreateDriverConnectAccountRequest = {
  driverId: string
  email?: string | null
  refreshUrl?: string
  returnUrl?: string
}

export type CreateDriverConnectAccountResponse = EdgePayload<{
  success: true
  accountId: string
  onboardingUrl?: string | null
}>

export type DriverOnboardingLinkRequest = {
  driverId: string
  connectAccountId?: string | null
  refreshUrl?: string
  returnUrl?: string
}

export type DriverOnboardingLinkResponse = EdgePayload<{
  success: true
  onboardingUrl: string
  accountId?: string | null
}>

export type DriverOnboardingStatusRequest = {
  driverId: string
  connectAccountId?: string | null
}

export type DriverOnboardingStatusResponse = EdgePayload<{
  success: true
  accountId?: string | null
  onboardingComplete?: boolean
  canReceivePayments?: boolean
  requirements?: unknown[]
  status?: string
}>

export type CreateVerificationSessionRequest = {
  userId?: string
  email?: string | null
}

export type CreateVerificationSessionResponse = EdgePayload<{
  url?: string
  client_secret?: string
  id?: string
  ephemeral_key_secret?: string
}>

export type GetVerificationDataRequest = {
  sessionId: string
}

export type GetVerificationDataResponse = EdgePayload<{
  status?: string
  message?: string
  firstName?: string | null
  lastName?: string | null
  dob?: {
    day: number
    month: number
    year: number
  } | null
  address?: {
    line1: string
    city: string
    state: string
    postalCode: string
  } | null
}>

export type VerifyVehicleRequest = {
  vinPhotoUrl: string
  carPhotoUrls: string[]
}

export type VerifyVehicleResponse = EdgePayload<{
  status: "approved" | "rejected"
  reason?: string
  extractedVin?: string | null
  detectedColor?: string | null
  detectedLicensePlate?: string | null
  confidence?: number
  vinData?: {
    vin?: string
    make?: string
    model?: string
    year?: string
    bodyClass?: string
    vehicleType?: string
  } | null
  photoAnalysis?: {
    labels?: string[]
    logos?: string[]
    photoCount?: number
  } | null
}>

export type SubmitClaimRequest = {
  bookingId: string
  lossType: string
  lossDate: string
  lossDescription: string
  lossEstimatedClaimValue?: number | null
  claimantName?: string | null
  claimantEmail?: string | null
  documentTypes?: string[]
}

export type SubmitClaimResponse = EdgePayload<{
  claimId?: string
  bookingId?: string
}>

export type SubmitFeedbackRequest = {
  requestId: string
  rating: number
  tip?: number
  driverId?: string | null
  toUserId?: string | null
  toUserType?: "driver" | "customer"
  sourceRole?: "driver" | "customer"
  badges?: string[]
  feedback?: string | null
  comment?: string | null
}

export type SubmitFeedbackResponse = EdgePayload<{
  success: true
  alreadySubmitted?: boolean
  feedbackId?: string | null
  rating?: number
  ratingCount?: number
  badgeStats?: Record<string, number>
}>

export type ProcessPayoutRequest = {
  amount: number
  currency: string
  connectAccountId?: string | null
  transferGroup: string
  driverId: string
  idempotencyKey?: string | null
  mode?: "instant" | "scheduled"
}

export type ProcessPayoutResponse = EdgePayload<{
  success: true
  transferId: string
  payoutId?: string | null
  feeAmount?: number | null
  netAmount?: number | null
  grossAmount?: number | null
  destinationAccountId?: string | null
  deduplicated?: boolean
}>

export type PublicTripParticipantProfile = {
  id: string
  role: "customer" | "driver"
  first_name: string
  last_name: string
  email: string | null
  profile_image_url: string | null
  avatar_url: string | null
  rating: number | null
}

export type GetTripParticipantsPublicRequest = {
  requestId: string
  targetUserId?: string | null
}

export type GetTripParticipantsPublicResponse = EdgePayload<{
  success: true
  requestId: string
  customer: PublicTripParticipantProfile | null
  driver: PublicTripParticipantProfile | null
  profile: PublicTripParticipantProfile | null
}>
