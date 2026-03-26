import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  HttpError,
  buildStripeClient,
  buildSupabaseClients,
  centsToAmount,
  corsHeaders,
  creditDriverTipIfPending,
  ensurePaymentMethodBelongsToCustomer,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  normalizeCurrency,
  normalizeStripeStatus,
  requireAuthHeader,
  resolveIdempotencyKey,
  resolveStripeCustomerIdForCustomer,
  toPositiveInteger,
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

    const tipAmountCents = toPositiveInteger(payload?.tipAmountCents, "tipAmountCents")

    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select(
        "id,status,customer_id,driver_id,price,insurance_premium,booking_payment_method_id,booking_currency",
      )
      .eq("id", tripId)
      .maybeSingle()

    if (tripError) {
      throw tripError
    }
    if (!trip) {
      throw new HttpError("Trip not found", 404)
    }

    if (resolveString(trip.customer_id) !== user.id) {
      throw new HttpError("Forbidden", 403)
    }

    if (resolveString(trip.status) !== "completed") {
      throw new HttpError("Tip can be sent only after trip completion", 409, "trip_not_completed")
    }

    const driverId = resolveString(trip.driver_id)
    if (!driverId) {
      throw new HttpError("Trip has no assigned driver", 409)
    }

    const { data: existingTip } = await adminClient
      .from("trip_tips")
      .select("id,payment_intent_id,status,amount")
      .eq("trip_id", tripId)
      .eq("customer_id", user.id)
      .maybeSingle()

    if (existingTip?.payment_intent_id) {
      const existingStatus = resolveString(existingTip.status).toLowerCase()
      if (existingStatus !== 'failed' && existingStatus !== 'canceled') {
        return jsonResponse({
          success: true,
          tipPaymentIntentId: String(existingTip.payment_intent_id),
          amount: Number(existingTip.amount || 0),
          status: resolveString(existingTip.status) || "succeeded",
        })
      }
    }

    const tripTotalAmount = Number(trip.price || 0)
    const insuranceAmount = Number(trip.insurance_premium || 0)
    const tipBaseAmount = Math.max(0, Number((tripTotalAmount - insuranceAmount).toFixed(2)))
    const maxTipAmountCents = Math.round(tipBaseAmount * 100 * 2)

    if (maxTipAmountCents <= 0) {
      throw new HttpError("Tip is unavailable for this trip amount", 409, "tip_base_zero")
    }

    if (tipAmountCents > maxTipAmountCents) {
      throw new HttpError(
        `Tip exceeds the allowed limit of $${(maxTipAmountCents / 100).toFixed(2)}.`,
        400,
        "tip_limit_exceeded",
      )
    }

    const paymentMethodId = resolveString(trip.booking_payment_method_id)
    if (!paymentMethodId) {
      throw new HttpError("Original trip payment method is missing", 409, "missing_trip_payment_method")
    }

    const currency = normalizeCurrency(trip.booking_currency, "usd")

    const stripeCustomerId = await resolveStripeCustomerIdForCustomer({
      adminClient,
      stripe,
      customerId: user.id,
      fallbackEmail: user.email || null,
    })

    await ensurePaymentMethodBelongsToCustomer({
      stripe,
      paymentMethodId,
      stripeCustomerId,
    })

    const idempotencyKey = resolveIdempotencyKey(
      payload?.idempotencyKey,
      `trip_tip:${tripId}:${user.id}:${tipAmountCents}`,
    )

    const tipPaymentIntent = await stripe.paymentIntents.create(
      {
        amount: tipAmountCents,
        currency,
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          trip_id: tripId,
          customer_id: user.id,
          driver_id: driverId,
          payment_flow: "trip_tip",
        },
      },
      {
        idempotencyKey,
      },
    )

    const tipStatus = normalizeStripeStatus(tipPaymentIntent.status)
    if (tipStatus !== "succeeded" && tipStatus !== "processing") {
      throw new HttpError(
        `Tip payment requires customer action (status: ${tipStatus || "unknown"}).`,
        402,
        "tip_payment_incomplete",
      )
    }

    const chargeId =
      typeof tipPaymentIntent.latest_charge === "string"
        ? tipPaymentIntent.latest_charge
        : tipPaymentIntent.latest_charge?.id || null

    const nowIso = new Date().toISOString()
    const tipAmount = centsToAmount(tipAmountCents)

    const { data: insertedTipRow, error: insertTipError } = await adminClient
      .from("trip_tips")
      .upsert({
        trip_id: tripId,
        customer_id: user.id,
        driver_id: driverId,
        payment_intent_id: tipPaymentIntent.id,
        charge_id: chargeId,
        payment_method_id: paymentMethodId,
        amount: tipAmount,
        currency,
        status: tipStatus,
        credited_to_driver_at: null,
        updated_at: nowIso,
      }, {
        onConflict: "trip_id,customer_id",
      })
      .select("id,payment_intent_id,status,amount")
      .single()

    if (insertTipError) {
      throw insertTipError
    }

    const insertedTip = insertedTipRow as {
      id: string;
      payment_intent_id: string;
      status: string;
      amount: number;
    } | null

    if (!insertedTip?.id || !insertedTip.payment_intent_id) {
      throw new HttpError("Unable to persist trip tip", 500)
    }

    if (tipStatus === "succeeded") {
      await creditDriverTipIfPending({
        adminClient,
        tripTipId: insertedTip.id,
        driverId,
        amount: tipAmount,
        creditedAt: nowIso,
      })
    }

    return jsonResponse({
      success: true,
      tipPaymentIntentId: insertedTip.payment_intent_id,
      amount: Number(insertedTip.amount || tipAmount),
      status: resolveString(insertedTip.status) || tipStatus,
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
