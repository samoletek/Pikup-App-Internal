# PAYMENT FLOW FIX CHECKLIST (EXECUTION-READY)

Status: phase 1 implementation in progress (core backend/app wiring completed; QA/deploy pending).
Updated: 2026-03-26
Audience: engineer or LLM without prior project context.

## 0) Purpose

This document defines the end-to-end payment refactor for customer booking, trip settlement, tips, and driver payouts.
It must be enough to implement tasks without chat history.

## 1) Current Known Gaps (Baseline)

- Booking currently confirms payment too early in customer flow (`services/CustomerOrderSubmissionService.js`). (Goal: baseline problem statement)
- Manual hold/capture lifecycle is not implemented end-to-end. (Goal: identify missing canonical flow)
- Tip charge is separate (correct), but currently tied to default card selection rather than trip payment source. (Goal: identify card-source mismatch)
- Tip amount is still coupled to feedback domain (`feedbacks.tip_amount` legacy coupling). (Goal: decouple finance from reviews)
- Driver wallet values are partially metadata-ledger driven and not fully webhook-reconciled. (Goal: identify accounting consistency risk)

## 2) Product Rules (Source of Truth)

- Hold starts only after driver confirms trip relevance.
  - On-demand: after driver accepts request.
  - Scheduled: after driver confirms scheduled check-in.
  (Goal: avoid stale authorizations for never-accepted trips)
- Insurance is included in main hold/capture amount. (Goal: one primary payment for trip)
- Temporary cancellation policy:
  - Customer can cancel until loading starts at pickup.
  - Driver can cancel at pickup if address details are wrong or required customer loading help is unavailable.
  (Goal: align cancellation behavior with current operations)
- Tip presets are `10%`, `15%`, `20%` from `total excluding insurance`. (Goal: agreed tip base)
- Custom tip is USD amount only, max `200%` of tip base. (Goal: prevent accidental over-tip)
- Tip is separate transaction, charged from the same payment method used for trip hold. (Goal: deterministic funding source)
- Instant payout supports full and partial amount. (Goal: flexible driver cashout)
- Instant payout fee is pass-through actual Stripe fee only. (Goal: transparent fee model)
- Auto payout schedule: monthly, `25th`, `11:00`, `America/New_York`. (Goal: deterministic recurring settlement)
- Re-authorization for expired hold is deferred to Phase 2. (Goal: keep phase 1 shippable)

## 3) Mandatory Preconditions

- Access and secrets:
  - Supabase project with deploy rights for migrations and functions.
  - Stripe account keys configured for current environment.
  - Webhook secret available for Stripe webhook endpoint.
- Environment variables (functions):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET` (for webhook function)
- Deployment mode must be explicit (`test` or `live`) and consistent between app and functions. (Goal: avoid cross-mode card/payment failures)

## 4) High-Level Architecture Target

- Customer creates trip request -> no charge, no hold.
- Driver confirms trip -> server creates hold (`capture_method=manual`) and persists trip payment state.
- Trip completion -> server captures authorized PaymentIntent.
- Trip cancellation before completion -> server cancels/voids uncaptured authorization.
- Tips -> separate charge, same `payment_method_id` as trip hold, persisted in dedicated ledger table.
- Payouts -> explicit payout operations with fee transparency and webhook reconciliation.

## 5) Execution Order (Do In This Exact Sequence)

1. DB migrations for new payment/tip state.
2. New edge functions (`authorize`, `capture`, `release`, `tip`, `webhook`).
3. Wire accept/check-in paths to authorization.
4. Wire completion/cancel paths to capture/release.
5. Refactor tip domain and UI.
6. Refactor payout UI + fee pass-through + monthly payout worker.
7. Cleanup legacy code.
8. End-to-end QA matrix.

Do not start UI-only changes before server contracts are finalized. (Goal: avoid broken intermediate app states)

## 6) Phase 1 - Database Changes

- [x] Create migration `supabase/migrations/*_trip_payment_state.sql`:
  - Add columns on `public.trips`:
    - `booking_payment_intent_id text`
    - `booking_payment_method_id text`
    - `booking_auth_amount numeric`
    - `booking_currency text default 'usd'`
    - `booking_payment_status text`
    - `booking_authorized_at timestamptz`
    - `booking_captured_at timestamptz`
    - `booking_released_at timestamptz`
  - Add index on `booking_payment_intent_id`.
  (Goal: persist full trip payment lifecycle)

- [x] Create migration `supabase/migrations/*_trip_tips_ledger.sql`:
  - Create table `public.trip_tips` with columns:
    - `id uuid primary key default gen_random_uuid()`
    - `trip_id uuid not null references public.trips(id)`
    - `customer_id uuid not null`
    - `driver_id uuid not null`
    - `payment_intent_id text not null`
    - `charge_id text`
    - `payment_method_id text not null`
    - `amount numeric not null`
    - `currency text not null default 'usd'`
    - `status text not null`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
  - Unique index on `payment_intent_id`.
  - Useful query indexes: `(trip_id)`, `(driver_id, created_at desc)`.
  (Goal: dedicated financial ledger for tips)

- [x] Create migration `supabase/migrations/*_stripe_event_log.sql`:
  - Create table `public.stripe_event_log`:
    - `event_id text primary key`
    - `event_type text not null`
    - `processed_at timestamptz not null default now()`
    - `payload jsonb not null`
  (Goal: webhook idempotency and audit trail)

- [x] Remove finance dependency on `feedbacks.tip_amount`:
  - Keep column only for backward display if needed, but mark deprecated in docs/comments.
  - New writes must not treat it as source of truth.
  (Goal: strict domain separation)

## 7) Phase 1 - Edge Functions and Contracts

- [x] Add `supabase/functions/authorize-trip-payment/index.ts`:
  - Input:
    - `tripId: string`
    - `customerId: string`
    - `paymentMethodId: string`
    - `amountCents: number`
    - `currency: 'usd'`
    - `idempotencyKey: string`
  - Behavior:
    - Validate requester and trip ownership/link.
    - Create PI with `capture_method='manual'`.
    - Confirm PI with provided PM.
    - Persist PI/PM/amount/status/timestamps in `trips`.
  - Output:
    - `success`, `paymentIntentId`, `status`.
  (Goal: canonical post-confirmation hold creation)

- [x] Add `supabase/functions/capture-trip-payment/index.ts`:
  - Input: `tripId`, `idempotencyKey`.
  - Behavior: capture stored PI if capturable; update trip payment status/timestamp.
  - Output: `success`, `paymentIntentId`, `chargeId`, `status`.
  (Goal: completion-driven settlement)

- [x] Add `supabase/functions/release-trip-payment/index.ts`:
  - Input: `tripId`, `idempotencyKey`, optional `reason`.
  - Behavior: cancel PI if uncaptured; update release status/timestamp.
  - Output: `success`, `paymentIntentId`, `status`.
  (Goal: full release on free cancellation)

- [x] Add `supabase/functions/create-tip-payment/index.ts`:
  - Input: `tripId`, `tipAmountCents`, `idempotencyKey`.
  - Behavior:
    - Read trip payment state (`booking_payment_method_id`).
    - Validate cap (`tip <= 200% * (trip_total_excluding_insurance)`).
    - Create and confirm separate PI with same payment method.
    - Insert row into `trip_tips`.
  - Output: `success`, `tipPaymentIntentId`, `amount`, `status`.
  (Goal: server-authoritative tip charging from trip card)

- [x] Add `supabase/functions/stripe-webhook/index.ts`:
  - Verify signature with `STRIPE_WEBHOOK_SECRET`.
  - Deduplicate by `event.id` via `stripe_event_log`.
  - Handle events:
    - `payment_intent.amount_capturable_updated`
    - `payment_intent.succeeded`
    - `payment_intent.canceled`
    - payout/transfer result events used in app
  - Reconcile `trips`, `trip_tips`, payout ledger fields.
  (Goal: Stripe as settlement source of truth)

- [x] Register all new functions in `supabase/config.toml`.
  (Goal: deploy consistency)

## 8) Phase 1 - App Wiring (Core Flow)

- [x] On-demand accept hook:
  - File: `services/tripDriverAcceptanceService.js`.
  - After acceptance lock succeeds, call `authorize-trip-payment`.
  - If hold fails, revert acceptance and surface actionable error.
  (Goal: no accepted trip without successful hold)

- [x] Scheduled confirm hook:
  - File: `services/tripScheduledCheckinService.ts` in `confirmScheduledTripCheckin`.
  - Call `authorize-trip-payment` on confirm success path.
  (Goal: same payment gate for scheduled flow)

- [x] Remove pre-charge in booking:
  - File: `services/CustomerOrderSubmissionService.js`.
  - Do not run immediate confirm charge during customer order submit.
  (Goal: shift payment trigger from booking to driver confirmation)

- [x] Capture on delivery completion:
  - File: `services/tripLifecycleUtils.js` in `finishDelivery`.
  - After trip completion state update, invoke `capture-trip-payment`.
  (Goal: capture only when service is completed)

- [x] Release on cancellation:
  - Files: `services/tripOrderCancellationService.*` and/or `services/tripCancellationUtils.js`.
  - Invoke `release-trip-payment` for uncaptured trips.
  (Goal: guaranteed hold release)

## 9) Phase 1 - Tip Flow (App + Domain)

- [x] Refactor tip submit in `hooks/useCustomerTripRating.js`:
  - Replace direct generic PI flow with call to `create-tip-payment`.
  - Remove dependency on current default card for tip charge.
  (Goal: same-card-as-trip enforcement)

- [x] UI input for custom tip:
  - File: `components/trip/TripDriverRatingSection.js`.
  - Dollar-only field with visible `$` prefix.
  - Mask numeric format and validate max `200%`.
  (Goal: remove ambiguity between percent and dollars)

- [x] Keep preset base in `screens/customer/CustomerTripDetailsScreen.utils.js` and rating hook:
  - Base amount is `total - insurance`.
  (Goal: preserve agreed business math)

- [x] Feedback decoupling:
  - Files:
    - `services/profileFeedbackService.js`
    - `services/profileFeedbackPersistence.js`
    - `supabase/functions/submit-feedback/index.ts`
  - Feedback should only store rating/badges/comment.
  - Tip financial state must come from `trip_tips`.
  (Goal: eliminate finance-in-feedback coupling)

- [x] Data migration task:
  - One-time SQL/script to copy historic non-zero `feedbacks.tip_amount` into `trip_tips` when possible.
  - Mark migrated records.
  (Goal: preserve historical financial visibility)

## 10) Phase 1 - Driver Wallet and Payouts

- [x] Add partial/full payout options:
  - Files:
    - `services/payment/payouts.js`
    - `screens/driver/useDriverEarningsPayoutActions.js`
    - `screens/driver/payment/useDriverPaymentSettingsData.js`
  - Allow input amount and "withdraw all" action.
  (Goal: flexible cashout UX)

- [x] Fee pass-through:
  - Compute/display Stripe instant payout fee from actual Stripe data when available.
  - Fallback to explicit estimate if settlement details lag.
  (Goal: charge only real Stripe fee, no platform margin)

- [x] Confirmation UI breakdown:
  - Show `gross`, `fee`, `net`.
  (Goal: user clarity before payout confirmation)

- [x] Monthly auto payout worker:
  - Add worker function and scheduling notes for `25th 11:00 America/New_York`.
  - Process eligible balances safely with idempotency.
  (Goal: deterministic automated payout cycle)

- [x] Destination enforcement:
  - Ensure payout goes to connected account payout source from onboarding.
  (Goal: payout only to verified configured destination)

## 11) Phase 1 - Cleanup and Legacy Removal

- [x] Remove/quarantine unused path `completeTripWithPayment` if not active in runtime navigation:
  - `contexts/auth/actions/paymentActions.js`.
  (Goal: one canonical completion+payment path)

- [x] Remove debug placeholder behavior if unused:
  - `supabase/functions/accept-trip/index.ts`.
  (Goal: prevent accidental debug behavior in production)

- [x] Remove legacy tip write/read coupling from feedback-related code and tests.
  (Goal: reduce hidden regressions and code noise)

## 12) QA Matrix (Definition of Done)

All cases below must pass in staging before merge:

- [ ] Customer creates trip -> no charge, no hold.
- [ ] Driver accepts/check-in confirms -> hold is created once.
- [ ] Driver accepts same request retry -> no duplicate hold (idempotent).
- [ ] Customer cancels before completion -> hold released once.
- [ ] Driver completes trip -> hold captured once.
- [ ] Completion retry/network retry -> no double capture.
- [ ] Tip preset -> separate successful charge from trip card.
- [ ] Tip custom amount -> `$` entry, cap enforced, separate charge.
- [ ] Feedback submit works with no dependency on tip financial writes.
- [ ] Partial payout succeeds and reflects fee/net values.
- [ ] Full payout succeeds and reflects fee/net values.
- [ ] Monthly payout job executes at expected schedule and is idempotent.
- [ ] Webhook re-delivery does not duplicate state updates.

## 13) Rollout and Safety

- [ ] Use feature flags for new payment lifecycle where possible.
- [ ] Deploy order:
  1. migrations
  2. new edge functions
  3. app wiring
  4. webhook endpoint
  5. cleanup removal
- [ ] Keep rollback notes per change:
  - app-level rollback via reverting app commit
  - function rollback via previous deploy
  - migration rollback scripts where safe
  (Goal: controlled release with recovery path)

## 14) Phase 2 - Deferred

- [ ] Re-authorization flow when hold expires before trip start.
  (Goal: robust long-delay scheduled payment handling)
- [ ] Optional no-show policy and fee logic.
  (Goal: monetization/policy expansion without destabilizing core flow)
