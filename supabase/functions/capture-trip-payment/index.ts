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
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const round2 = (value: number) => Math.round(value * 100) / 100

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

const toPercent = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback
  }

  return parsed
}

const resolveTripPricing = (trip: Record<string, unknown>) => {
  const pickupLocation = toRecord(trip.pickup_location)
  return toRecord(pickupLocation.pricing)
}

const resolveSplitBaseAmount = (pricing: Record<string, unknown>, totalAmount: number) => {
  const directAmount = toNumber(
    pricing.splitBaseAmount ?? pricing.fareAfterSurge ?? pricing.customerSubtotal,
    0,
  )
  if (directAmount > 0) {
    return round2(directAmount)
  }

  const grossFare = toNumber(pricing.grossFare, 0)
  const surgeFee = toNumber(pricing.surgeFee, 0)
  if (grossFare > 0 || surgeFee > 0) {
    return round2(grossFare + surgeFee)
  }

  const insuranceAmount = toNumber(pricing.mandatoryInsurance, 0)
  const platformShare = toNumber(pricing.platformShare ?? pricing.serviceFee, 0)
  const serviceFeeIncludedInTotal = pricing.serviceFeeIncludedInTotal !== false

  return round2(
    Math.max(
      0,
      totalAmount - insuranceAmount - (serviceFeeIncludedInTotal ? platformShare : 0),
    ),
  )
}

const buildCapturedTripPricing = (trip: Record<string, unknown>) => {
  const pricing = resolveTripPricing(trip)
  const {
    tax: _legacyTax,
    taxRate: _legacyTaxRate,
    taxableLaborAmount: _legacyTaxableLaborAmount,
    ...pricingWithoutTax
  } = pricing
  const totalAmount = toNumber(trip.price ?? pricing.total, 0)
  const insuranceAmount = round2(
    toNumber(trip.insurance_premium ?? pricing.mandatoryInsurance, 0),
  )
  const splitBaseAmount = resolveSplitBaseAmount(
    {
      ...pricing,
      mandatoryInsurance: insuranceAmount,
    },
    totalAmount,
  )
  const platformSharePercent = toPercent(
    pricing.platformSharePercent ?? pricing.serviceFeePercent,
    0.25,
  )
  const driverPayoutPercent = toPercent(pricing.driverPayoutPercent, 1 - platformSharePercent)
  const platformShare = round2(splitBaseAmount * platformSharePercent)
  const driverPayout = round2(splitBaseAmount * driverPayoutPercent)
  const normalizedTotal = round2(splitBaseAmount + insuranceAmount)

  return {
    ...pricingWithoutTax,
    splitBaseAmount,
    fareAfterSurge: splitBaseAmount,
    total: normalizedTotal,
    customerTotal: normalizedTotal,
    mandatoryInsurance: insuranceAmount,
    serviceFeeIncludedInTotal: false,
    serviceFee: platformShare,
    platformShare,
    platformSharePercent,
    driverPayout,
    driverPayoutPercent,
    platformRetainedTotal: round2(platformShare + insuranceAmount),
    paymentCapturedAt: new Date().toISOString(),
  }
}

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
      .select("id,status,driver_id,price,pickup_location,insurance_premium,booking_payment_intent_id,booking_payment_status")
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

    const capturedPricing = buildCapturedTripPricing(trip)
    const capturedPickupLocation = {
      ...toRecord(trip.pickup_location),
      pricing: capturedPricing,
    }

    if (resolveString(trip.booking_payment_status) === "captured") {
      const { error: existingUpdateError } = await adminClient
        .from("trips")
        .update({
          pickup_location: capturedPickupLocation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tripId)

      if (existingUpdateError) {
        throw existingUpdateError
      }

      return jsonResponse({
        success: true,
        paymentIntentId,
        chargeId: null,
        status: "captured",
        total: capturedPricing.total,
        driverPayout: capturedPricing.driverPayout,
        platformShare: capturedPricing.platformShare,
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
        pickup_location: {
          ...capturedPickupLocation,
          pricing: {
            ...capturedPricing,
            paymentCapturedAt: nowIso,
          },
        },
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
      total: capturedPricing.total,
      driverPayout: capturedPricing.driverPayout,
      platformShare: capturedPricing.platformShare,
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
