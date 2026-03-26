import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  HttpError,
  buildStripeClient,
  buildSupabaseClients,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  normalizeStripeStatus,
  requireAuthHeader,
  resolveIdempotencyKey,
} from "../_shared/paymentHelpers.ts"

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

    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select("id,customer_id,driver_id,booking_payment_intent_id,booking_payment_status")
      .eq("id", tripId)
      .maybeSingle()

    if (tripError) {
      throw tripError
    }
    if (!trip) {
      throw new HttpError("Trip not found", 404)
    }

    const actorId = user.id
    const isTripParticipant = (
      resolveString(trip.customer_id) === actorId ||
      resolveString(trip.driver_id) === actorId
    )

    if (!isTripParticipant) {
      throw new HttpError("Forbidden", 403)
    }

    const paymentIntentId = resolveString(trip.booking_payment_intent_id)
    if (!paymentIntentId) {
      return jsonResponse({
        success: true,
        paymentIntentId: null,
        status: "not_applicable",
      })
    }

    const currentStatus = resolveString(trip.booking_payment_status)
    if (currentStatus === "captured") {
      throw new HttpError("Captured payment cannot be released", 409, "already_captured")
    }

    if (currentStatus === "released") {
      return jsonResponse({
        success: true,
        paymentIntentId,
        status: "released",
      })
    }

    const idempotencyKey = resolveIdempotencyKey(
      payload?.idempotencyKey,
      `trip_release:${tripId}:${actorId}:${paymentIntentId}`,
    )

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const stripeStatus = normalizeStripeStatus(paymentIntent.status)

    let releasedStatus = stripeStatus
    if (stripeStatus !== "canceled") {
      if (stripeStatus === "succeeded") {
        throw new HttpError("Captured payment cannot be released", 409, "already_captured")
      }

      const canceledIntent = await stripe.paymentIntents.cancel(
        paymentIntentId,
        {
          cancellation_reason: "requested_by_customer",
        },
        {
          idempotencyKey,
        },
      )
      releasedStatus = normalizeStripeStatus(canceledIntent.status)
    }

    const nowIso = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from("trips")
      .update({
        booking_payment_status: "released",
        booking_released_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", tripId)

    if (updateError) {
      throw updateError
    }

    return jsonResponse({
      success: true,
      paymentIntentId,
      status: releasedStatus || "released",
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
