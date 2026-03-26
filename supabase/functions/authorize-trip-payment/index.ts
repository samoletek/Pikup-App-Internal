import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  HttpError,
  buildStripeClient,
  buildSupabaseClients,
  centsToAmount,
  corsHeaders,
  ensurePaymentMethodBelongsToCustomer,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  normalizeCurrency,
  normalizeStripeStatus,
  requireAuthHeader,
  resolveIdempotencyKey,
  resolveStripeCustomerIdForCustomer,
  toCents,
  toPositiveInteger,
} from "../_shared/paymentHelpers.ts"

const AUTHORIZED_STRIPE_STATUS = "requires_capture"
const CAPTURED_STRIPE_STATUS = "succeeded"
const SUCCESS_STATUSES = new Set([AUTHORIZED_STRIPE_STATUS, CAPTURED_STRIPE_STATUS])

const resolveString = (value: unknown) => String(value || "").trim()

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = requireAuthHeader(req)
    const { authClient, adminClient } = buildSupabaseClients(authHeader)
    const user = await getAuthenticatedUser(authClient)
    const stripe = buildStripeClient()

    const payload = await req.json()

    const tripId = resolveString(payload?.tripId)
    if (!tripId) {
      throw new HttpError("tripId is required", 400)
    }

    const requestedPaymentMethodId = resolveString(payload?.paymentMethodId)
    const requestedAmountCents = toPositiveInteger(payload?.amountCents, "amountCents")
    const customerIdFromPayload = resolveString(payload?.customerId)
    const currency = normalizeCurrency(payload?.currency, "usd")

    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select(
        "id,customer_id,driver_id,status,price,booking_payment_intent_id,booking_payment_method_id,booking_payment_status,booking_currency",
      )
      .eq("id", tripId)
      .maybeSingle()

    if (tripError) {
      throw tripError
    }
    if (!trip) {
      throw new HttpError("Trip not found", 404)
    }

    if (resolveString(trip.driver_id) !== user.id) {
      throw new HttpError("Forbidden", 403)
    }

    const tripStatus = resolveString(trip.status).toLowerCase()
    if (tripStatus !== "accepted" && tripStatus !== "in_progress") {
      throw new HttpError("Trip is not eligible for payment authorization", 409, "trip_not_authorizable")
    }

    const customerId = resolveString(trip.customer_id)
    if (!customerId) {
      throw new HttpError("Trip has no customer assigned", 409)
    }

    if (customerIdFromPayload && customerIdFromPayload !== customerId) {
      throw new HttpError("Provided customer does not match trip customer", 403)
    }

    const paymentMethodId = requestedPaymentMethodId || resolveString(trip.booking_payment_method_id)
    if (!paymentMethodId) {
      throw new HttpError("paymentMethodId is required", 400)
    }

    const amountFromTripCents = toCents(trip.price)
    const amountCents = amountFromTripCents > 0 ? amountFromTripCents : requestedAmountCents

    if (trip.booking_payment_intent_id) {
      const existingIntent = await stripe.paymentIntents.retrieve(String(trip.booking_payment_intent_id))
      const existingStatus = normalizeStripeStatus(existingIntent.status)

      if (SUCCESS_STATUSES.has(existingStatus)) {
        const nowIso = new Date().toISOString()
        const mappedStatus = existingStatus === AUTHORIZED_STRIPE_STATUS ? "authorized" : "captured"

        const { error: existingUpdateError } = await adminClient
          .from("trips")
          .update({
            booking_payment_intent_id: existingIntent.id,
            booking_payment_method_id: paymentMethodId,
            booking_auth_amount: centsToAmount(amountCents),
            booking_currency: normalizeCurrency(existingIntent.currency, currency),
            booking_payment_status: mappedStatus,
            booking_authorized_at: mappedStatus === "authorized" ? nowIso : null,
            booking_captured_at: mappedStatus === "captured" ? nowIso : null,
            booking_released_at: null,
            updated_at: nowIso,
          })
          .eq("id", tripId)

        if (existingUpdateError) {
          throw existingUpdateError
        }

        return jsonResponse({
          success: true,
          paymentIntentId: existingIntent.id,
          status: mappedStatus,
        })
      }
    }

    const idempotencyKey = resolveIdempotencyKey(
      payload?.idempotencyKey,
      `trip_hold:${tripId}:${user.id}:${amountCents}:${paymentMethodId}`,
    )

    const stripeCustomerId = await resolveStripeCustomerIdForCustomer({
      adminClient,
      stripe,
      customerId,
      fallbackEmail: user.email || null,
    })

    await ensurePaymentMethodBelongsToCustomer({
      stripe,
      paymentMethodId,
      stripeCustomerId,
    })

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        capture_method: "manual",
        confirm: true,
        off_session: true,
        metadata: {
          trip_id: tripId,
          customer_id: customerId,
          driver_id: user.id,
          payment_flow: "trip_booking_hold",
        },
      },
      {
        idempotencyKey,
      },
    )

    const stripeStatus = normalizeStripeStatus(paymentIntent.status)
    const nowIso = new Date().toISOString()
    const mappedStatus =
      stripeStatus === AUTHORIZED_STRIPE_STATUS
        ? "authorized"
        : stripeStatus === CAPTURED_STRIPE_STATUS
          ? "captured"
          : stripeStatus

    const { error: updateError } = await adminClient
      .from("trips")
      .update({
        booking_payment_intent_id: paymentIntent.id,
        booking_payment_method_id: paymentMethodId,
        booking_auth_amount: centsToAmount(amountCents),
        booking_currency: normalizeCurrency(paymentIntent.currency, currency),
        booking_payment_status: mappedStatus,
        booking_authorized_at: mappedStatus === "authorized" ? nowIso : null,
        booking_captured_at: mappedStatus === "captured" ? nowIso : null,
        booking_released_at: null,
        updated_at: nowIso,
      })
      .eq("id", tripId)

    if (updateError) {
      throw updateError
    }

    if (!SUCCESS_STATUSES.has(stripeStatus)) {
      throw new HttpError(
        `Payment authorization requires customer action (status: ${stripeStatus || "unknown"}).`,
        402,
        "authorization_incomplete",
      )
    }

    return jsonResponse({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: mappedStatus,
    })
  } catch (error) {
    const normalized = mapUnexpectedError(error)
    return jsonResponse(
      {
        error: normalized.message,
        code: normalized.code,
      },
      normalized.status,
    )
  }
})
