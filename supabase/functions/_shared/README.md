# Edge Function Contracts

Shared DTOs live in [`contracts.ts`](./contracts.ts) and are intended to be the single source of truth for frontend payload mapping.

## Covered contracts

- `accept-trip`
  - Request: `AcceptTripRequest`
  - Response: `AcceptTripResponse`
- `get-driver-request-pool`
  - Request: `DriverRequestPoolRequest`
  - Response: `DriverRequestPoolResponse`
- `redkik-quote`
  - Request: `RedkikQuoteRequest`
  - Response: `RedkikQuoteResponse`
- `check-user-exists`
  - Request: `CheckUserExistsRequest`
  - Response: `CheckUserExistsResponse`
- `delete-user`
  - Request: `DeleteUserRequest`
  - Response: `DeleteUserResponse`
- `download-user-data`
  - Request: `DownloadUserDataRequest`
  - Response: `DownloadUserDataResponse`
- `send-phone-otp`
  - Request: `SendPhoneOtpRequest`
  - Response: `SendPhoneOtpResponse`
- `verify-phone-otp`
  - Request: `VerifyPhoneOtpRequest`
  - Response: `VerifyPhoneOtpResponse`
- `verify-vehicle`
  - Request: `VerifyVehicleRequest`
  - Response: `VerifyVehicleResponse`
- `get-payment-methods`
  - Response: `GetPaymentMethodsResponse`
- `create-payment-intent`
  - Request: `CreatePaymentIntentRequest`
  - Response: `CreatePaymentIntentResponse`
- `calculate-trip-price`
  - Request: `TripPriceEstimateRequest`
  - Response: `TripPriceEstimateResponse`
- `create-driver-connect-account`
  - Request: `CreateDriverConnectAccountRequest`
  - Response: `CreateDriverConnectAccountResponse`
- `get-driver-onboarding-link`
  - Request: `DriverOnboardingLinkRequest`
  - Response: `DriverOnboardingLinkResponse`
- `check-driver-onboarding-status`
  - Request: `DriverOnboardingStatusRequest`
  - Response: `DriverOnboardingStatusResponse`
- `submit-claim`
  - Request: `SubmitClaimRequest`
  - Response: `SubmitClaimResponse`
- `submit-feedback`
  - Request: `SubmitFeedbackRequest`
  - Response: `SubmitFeedbackResponse`
- `process-payout`
  - Request: `ProcessPayoutRequest`
  - Response: `ProcessPayoutResponse`

## Usage guidance

- Keep edge handlers and frontend repositories aligned to these DTOs.
- Extend `contracts.ts` before changing payload shape in edge functions.
- Avoid ad-hoc `any` parsing in handlers and frontend service mappers.
