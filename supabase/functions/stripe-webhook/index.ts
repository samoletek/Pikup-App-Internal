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

const uniqueStringList = (values: unknown[] = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  )

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

const hasIdentityPrefill = (formData: Record<string, unknown> | null | undefined) => {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    return false
  }

  const firstName = String(formData.firstName || "").trim()
  const lastName = String(formData.lastName || "").trim()
  return Boolean(firstName && lastName)
}

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value || "").trim()
    if (normalized) {
      return normalized
    }
  }
  return null
}

const resolveIdentityPrefillPayload = (verificationSession: Stripe.Identity.VerificationSession) => {
  const verifiedOutputs = asRecord(
    (verificationSession as Stripe.Identity.VerificationSession & { verified_outputs?: unknown }).verified_outputs,
  )
  const report = asRecord(
    (verificationSession as Stripe.Identity.VerificationSession & { last_verification_report?: unknown }).last_verification_report,
  )
  const reportDocument = asRecord(report.document)
  const verifiedAddress = asRecord(verifiedOutputs.address)
  const reportAddress = asRecord(reportDocument.address)

  const firstName = pickString(verifiedOutputs.first_name, reportDocument.first_name)
  const lastName = pickString(verifiedOutputs.last_name, reportDocument.last_name)

  const line1 = pickString(verifiedAddress.line1, reportAddress.line1)
  const city = pickString(verifiedAddress.city, reportAddress.city)
  const state = pickString(verifiedAddress.state, reportAddress.state)
  const postalCode = pickString(verifiedAddress.postal_code, reportAddress.postal_code)

  const hasAddress = Boolean(line1 || city || state || postalCode)

  return {
    firstName,
    lastName,
    address: hasAddress
      ? {
        line1: line1 || "",
        city: city || "",
        state: state || "",
        postalCode: postalCode || "",
      }
      : null,
  }
}

const resolveIdentityStatus = (verificationSession: Stripe.Identity.VerificationSession) => {
  const normalized = String(verificationSession?.status || "").trim().toLowerCase()
  if (normalized === "verified") {
    return "completed"
  }
  if (normalized === "processing") {
    return "processing"
  }
  if (normalized === "requires_input") {
    const hasAttemptedVerification = Boolean(
      verificationSession?.last_error ||
      verificationSession?.last_verification_report,
    )
    return hasAttemptedVerification ? "failed" : "pending"
  }
  if (normalized === "canceled") {
    return "canceled"
  }
  return normalized || "pending"
}

const syncDriverIdentityByVerificationSession = async (
  adminClient: ReturnType<typeof createClient>,
  verificationSession: Stripe.Identity.VerificationSession,
) => {
  const sessionId = String(verificationSession.id || "").trim()
  const userId = String(verificationSession.metadata?.user_id || "").trim()
  if (!sessionId || !userId) {
    return
  }

  const nowIso = new Date().toISOString()
  const rawSessionStatus = String(verificationSession.status || "").trim().toLowerCase()
  const nextIdentityStatus = resolveIdentityStatus(verificationSession)
  const isVerified = rawSessionStatus === "verified"

  const { data: driverRow, error: driverFetchError } = await adminClient
    .from("drivers")
    .select("id,metadata,first_name,last_name")
    .eq("id", userId)
    .maybeSingle()

  if (driverFetchError) {
    throw driverFetchError
  }

  if (!driverRow?.id) {
    const { error: seedError } = await adminClient
      .from("drivers")
      .upsert({
        id: userId,
        email: String(verificationSession.metadata?.email || "").trim() || null,
        first_name: "",
        last_name: "",
        phone_number: "",
        phone_verified: false,
        rating: 5.0,
        created_at: nowIso,
        updated_at: nowIso,
        verification_session_id: sessionId,
        metadata: {
          identityVerificationStatus: nextIdentityStatus,
          onboardingDraft: {
            verificationStatus: nextIdentityStatus,
            verificationDataPopulated: false,
            updatedAt: nowIso,
          },
          onboardingLastSavedAt: nowIso,
        },
      })

    if (seedError) {
      throw seedError
    }

    return
  }

  const existingMetadata = asRecord(driverRow.metadata)
  const existingDraft = asRecord(existingMetadata.onboardingDraft)
  const existingDraftFormData = asRecord(existingDraft.formData)
  const existingHasPrefill = hasIdentityPrefill(existingDraftFormData)
  const identityPrefill = isVerified ? resolveIdentityPrefillPayload(verificationSession) : null
  const nextDraftAddress = asRecord(existingDraftFormData.address)
  const mergedDraftFormData = {
    ...existingDraftFormData,
  }

  if (identityPrefill?.firstName && !String(existingDraftFormData.firstName || "").trim()) {
    mergedDraftFormData.firstName = identityPrefill.firstName
  }
  if (identityPrefill?.lastName && !String(existingDraftFormData.lastName || "").trim()) {
    mergedDraftFormData.lastName = identityPrefill.lastName
  }
  if (identityPrefill?.address) {
    mergedDraftFormData.address = {
      ...nextDraftAddress,
      line1: String(nextDraftAddress.line1 || "").trim() || identityPrefill.address.line1,
      city: String(nextDraftAddress.city || "").trim() || identityPrefill.address.city,
      state: String(nextDraftAddress.state || "").trim() || identityPrefill.address.state,
      postalCode: String(nextDraftAddress.postalCode || "").trim() || identityPrefill.address.postalCode,
    }
  }

  const mergedHasPrefill = hasIdentityPrefill(mergedDraftFormData)
  const nextDraft = {
    ...existingDraft,
    verificationStatus: isVerified ? "completed" : nextIdentityStatus,
    verificationDataPopulated: isVerified
      ? Boolean(mergedHasPrefill || (existingDraft.verificationDataPopulated && existingHasPrefill))
      : Boolean(existingDraft.verificationDataPopulated && existingHasPrefill),
    formData: mergedDraftFormData,
    updatedAt: nowIso,
  }

  const nextMetadata = {
    ...existingMetadata,
    identityVerificationStatus: nextIdentityStatus,
    onboardingDraft: nextDraft,
    onboardingLastSavedAt: nowIso,
  }

  const driverUpdates: Record<string, unknown> = {
    verification_session_id: sessionId,
    metadata: nextMetadata,
    updated_at: nowIso,
  }

  if (isVerified) {
    driverUpdates.identity_verified = true
    if (identityPrefill?.firstName) {
      driverUpdates.first_name = identityPrefill.firstName
    }
    if (identityPrefill?.lastName) {
      driverUpdates.last_name = identityPrefill.lastName
    }
  }

  const { error: updateError } = await adminClient
    .from("drivers")
    .update(driverUpdates)
    .eq("id", userId)

  if (updateError) {
    throw updateError
  }
}

const resolveDriverOnboardingStatus = ({
  canReceivePayments,
  onboardingComplete,
  disabledReason,
  blockingRequirements,
  pendingVerification,
}: {
  canReceivePayments: boolean
  onboardingComplete: boolean
  disabledReason: string | null
  blockingRequirements: string[]
  pendingVerification: string[]
}) => {
  if (canReceivePayments) {
    return "verified"
  }

  if (!onboardingComplete) {
    return "action_required"
  }

  const isPendingVerificationOnly = disabledReason === "requirements.pending_verification"
  if (isPendingVerificationOnly || pendingVerification.length > 0) {
    return "under_review"
  }

  if (blockingRequirements.length > 0 || Boolean(disabledReason)) {
    return "action_required"
  }

  return "under_review"
}

const syncDriverOnboardingByAccount = async (
  adminClient: ReturnType<typeof createClient>,
  account: Stripe.Account,
) => {
  const accountId = String(account.id || "").trim()
  if (!accountId) {
    return
  }

  const currentlyDue = uniqueStringList(account.requirements?.currently_due || [])
  const pastDue = uniqueStringList(account.requirements?.past_due || [])
  const eventuallyDue = uniqueStringList(account.requirements?.eventually_due || [])
  const pendingVerification = uniqueStringList(account.requirements?.pending_verification || [])
  const disabledReason = String(account.requirements?.disabled_reason || "").trim() || null
  const transfersCapability = String(account.capabilities?.transfers || "").trim().toLowerCase()
  const isTransfersCapabilityActive = transfersCapability === "active"
  const isTransfersCapabilityPending = transfersCapability === "pending"
  const capabilityRequirement = !isTransfersCapabilityActive && !isTransfersCapabilityPending
    ? ["capabilities.transfers"]
    : []
  const blockingRequirements = uniqueStringList([
    ...currentlyDue,
    ...pastDue,
    ...capabilityRequirement,
  ])
  const onboardingComplete = Boolean(account.details_submitted)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const canReceivePayments =
    payoutsEnabled &&
    isTransfersCapabilityActive &&
    blockingRequirements.length === 0 &&
    !disabledReason

  const status = resolveDriverOnboardingStatus({
    canReceivePayments,
    onboardingComplete,
    disabledReason,
    blockingRequirements,
    pendingVerification,
  })

  const nowIso = new Date().toISOString()
  const { data: driverRows, error: driverFetchError } = await adminClient
    .from("drivers")
    .select("id")
    .eq("stripe_account_id", accountId)

  if (driverFetchError) {
    throw driverFetchError
  }

  if (!Array.isArray(driverRows) || driverRows.length === 0) {
    return
  }

  for (const driverRow of driverRows) {
    const { error: updateError } = await adminClient
      .from("drivers")
      .update({
        onboarding_complete: onboardingComplete,
        can_receive_payments: canReceivePayments,
        updated_at: nowIso,
      })
      .eq("id", String(driverRow.id || ""))

    if (updateError) {
      throw updateError
    }
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
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)

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

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account
      await syncDriverOnboardingByAccount(adminClient, account)
    }

    if (
      event.type === "identity.verification_session.created" ||
      event.type === "identity.verification_session.requires_input" ||
      event.type === "identity.verification_session.processing" ||
      event.type === "identity.verification_session.canceled" ||
      event.type === "identity.verification_session.verified"
    ) {
      let verificationSession = event.data.object as Stripe.Identity.VerificationSession

      if (event.type === "identity.verification_session.verified") {
        try {
          verificationSession = await stripe.identity.verificationSessions.retrieve(
            verificationSession.id,
            { expand: ["verified_outputs", "last_verification_report.document"] },
          )
        } catch (sessionFetchError) {
          console.error("Failed to retrieve expanded verified Stripe session", {
            sessionId: verificationSession.id,
            error: sessionFetchError,
          })
        }
      }

      await syncDriverIdentityByVerificationSession(adminClient, verificationSession)
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
