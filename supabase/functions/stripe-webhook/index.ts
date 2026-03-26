import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  HttpError,
  buildStripeClient,
  corsHeaders,
  creditDriverTipIfPending,
  getRequiredEnv,
  jsonResponse,
  mapUnexpectedError,
  normalizeStripeStatus,
} from "../_shared/paymentHelpers.ts"

const isDuplicateEventError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || "").trim()
  if (code === "23505") {
    return true
  }

  const details = `${(error as { message?: string })?.message || ""} ${(error as { details?: string })?.details || ""}`
    .toLowerCase()
  return details.includes("duplicate key")
}

const toTipChargeId = (paymentIntent: Stripe.PaymentIntent) => {
  return typeof paymentIntent.latest_charge === "string"
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id || null
}

const updateTripByIntent = async (
  adminClient: ReturnType<typeof createClient>,
  paymentIntentId: string,
  updates: Record<string, unknown>,
) => {
  const nowIso = new Date().toISOString()
  const { error } = await adminClient
    .from("trips")
    .update({
      ...updates,
      updated_at: nowIso,
    })
    .eq("booking_payment_intent_id", paymentIntentId)

  if (error) {
    throw error
  }
}

const markTipByIntent = async (
  adminClient: ReturnType<typeof createClient>,
  paymentIntent: Stripe.PaymentIntent,
  status: string,
) => {
  const chargeId = toTipChargeId(paymentIntent)
  const nowIso = new Date().toISOString()

  const { data: tips, error: tipError } = await adminClient
    .from("trip_tips")
    .update({
      status,
      charge_id: chargeId,
      updated_at: nowIso,
    })
    .eq("payment_intent_id", paymentIntent.id)
    .select("id,driver_id,amount")

  if (tipError) {
    throw tipError
  }

  if (!Array.isArray(tips) || tips.length === 0) {
    return
  }

  if (status !== "succeeded") {
    return
  }

  for (const tip of tips) {
    await creditDriverTipIfPending({
      adminClient,
      tripTipId: String(tip.id || ""),
      driverId: String(tip.driver_id || ""),
      amount: Number(tip.amount || 0),
      creditedAt: nowIso,
    })
  }
}

const markDriverPayoutByTransferId = async (
  adminClient: ReturnType<typeof createClient>,
  transfer: Stripe.Transfer,
  status: string,
) => {
  const transferId = String(transfer.id || "").trim()
  if (!transferId) {
    return
  }

  const { data: payoutRow, error: payoutFetchError } = await adminClient
    .from("driver_payouts")
    .select("id,metadata")
    .eq("transfer_id", transferId)
    .maybeSingle()

  if (payoutFetchError) {
    throw payoutFetchError
  }

  if (!payoutRow?.id) {
    return
  }

  const existingMetadata =
    payoutRow.metadata &&
    typeof payoutRow.metadata === "object" &&
    !Array.isArray(payoutRow.metadata)
      ? payoutRow.metadata as Record<string, unknown>
      : {}

  const nextMetadata = {
    ...existingMetadata,
    stripe_transfer_reversed: transfer.reversed || false,
    stripe_transfer_reversed_amount: Number(transfer.amount_reversed || 0) / 100,
    webhook_event_timestamp: new Date().toISOString(),
  }

  const { error } = await adminClient
    .from("driver_payouts")
    .update({
      status,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutRow.id)

  if (error) {
    throw error
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const stripe = buildStripeClient()
    const supabaseUrl = getRequiredEnv("SUPABASE_URL")
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
    const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET")

    const signature = String(req.headers.get("stripe-signature") || "").trim()
    if (!signature) {
      throw new HttpError("Missing stripe-signature header", 400)
    }

    const rawBody = await req.text()
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { error: eventLogError } = await adminClient
      .from("stripe_event_log")
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event,
      })

    if (eventLogError) {
      if (isDuplicateEventError(eventLogError)) {
        return jsonResponse({ received: true, duplicate: true })
      }
      throw eventLogError
    }

    if (event.type === "payment_intent.amount_capturable_updated") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const flow = String(paymentIntent.metadata?.payment_flow || "").trim()

      if (flow === "trip_booking_hold") {
        await updateTripByIntent(adminClient, paymentIntent.id, {
          booking_payment_status: "authorized",
          booking_authorized_at: new Date().toISOString(),
          booking_released_at: null,
        })
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const flow = String(paymentIntent.metadata?.payment_flow || "").trim()

      if (flow === "trip_booking_hold") {
        await updateTripByIntent(adminClient, paymentIntent.id, {
          booking_payment_status: "captured",
          booking_captured_at: new Date().toISOString(),
          booking_released_at: null,
        })
      }

      if (flow === "trip_tip") {
        await markTipByIntent(adminClient, paymentIntent, "succeeded")
      }
    }

    if (event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const flow = String(paymentIntent.metadata?.payment_flow || "").trim()

      if (flow === "trip_booking_hold") {
        await updateTripByIntent(adminClient, paymentIntent.id, {
          booking_payment_status: "released",
          booking_released_at: new Date().toISOString(),
        })
      }

      if (flow === "trip_tip") {
        await markTipByIntent(adminClient, paymentIntent, "canceled")
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const flow = String(paymentIntent.metadata?.payment_flow || "").trim()
      const status = normalizeStripeStatus(paymentIntent.status) || "failed"

      if (flow === "trip_booking_hold") {
        await updateTripByIntent(adminClient, paymentIntent.id, {
          booking_payment_status: status,
        })
      }

      if (flow === "trip_tip") {
        await markTipByIntent(adminClient, paymentIntent, status)
      }
    }

    if (event.type === "transfer.created") {
      const transfer = event.data.object as Stripe.Transfer
      await markDriverPayoutByTransferId(adminClient, transfer, "processed")
    }

    if (event.type === "transfer.reversed") {
      const transfer = event.data.object as Stripe.Transfer
      await markDriverPayoutByTransferId(adminClient, transfer, "reversed")
    }

    return jsonResponse({ received: true })
  } catch (error) {
    const normalized = mapUnexpectedError(error)
    return jsonResponse(
      {
        error: normalized.message,
      },
      normalized.status,
    )
  }
})
