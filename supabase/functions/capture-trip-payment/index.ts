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
      .select("id,status,driver_id,booking_payment_intent_id,booking_payment_status")
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
    if (tripStatus !== "completed" && resolveString(trip.booking_payment_status) !== "captured") {
      throw new HttpError("Trip must be completed before capture", 409, "trip_not_completed")
    }

    const paymentIntentId = resolveString(trip.booking_payment_intent_id)
    if (!paymentIntentId) {
      throw new HttpError("No trip hold found to capture", 409, "missing_authorization")
    }

    if (resolveString(trip.booking_payment_status) === "captured") {
      return jsonResponse({
        success: true,
        paymentIntentId,
        chargeId: null,
        status: "captured",
      })
    }

    const idempotencyKey = resolveIdempotencyKey(
      payload?.idempotencyKey,
      `trip_capture:${tripId}:${user.id}:${paymentIntentId}`,
    )

    const existingIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    const existingStatus = normalizeStripeStatus(existingIntent.status)

    let settledIntent = existingIntent
    if (existingStatus === "requires_capture") {
      settledIntent = await stripe.paymentIntents.capture(paymentIntentId, {}, { idempotencyKey })
    } else if (existingStatus !== "succeeded") {
      throw new HttpError(
        `Trip payment is not capturable (status: ${existingStatus || "unknown"}).`,
        409,
        "capture_not_allowed",
      )
    }

    const latestCharge =
      typeof settledIntent.latest_charge === "string"
        ? settledIntent.latest_charge
        : settledIntent.latest_charge?.id || null

    const nowIso = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from("trips")
      .update({
        booking_payment_status: "captured",
        booking_captured_at: nowIso,
        booking_released_at: null,
        updated_at: nowIso,
      })
      .eq("id", tripId)

    if (updateError) {
      throw updateError
    }

    return jsonResponse({
      success: true,
      paymentIntentId,
      chargeId: latestCharge,
      status: "captured",
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
