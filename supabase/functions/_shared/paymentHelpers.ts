import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

export class HttpError extends Error {
  status: number
  code: string | null

  constructor(message: string, status = 400, code: string | null = null) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
  }
}

export const getRequiredEnv = (name: string) => {
  const value = String(Deno.env.get(name) || "").trim()
  if (!value) {
    throw new HttpError(`Missing required environment variable: ${name}`, 500)
  }
  return value
}

export const buildStripeClient = () => {
  const stripeKey = getRequiredEnv("STRIPE_SECRET_KEY")
  return new Stripe(stripeKey, {
    apiVersion: "2022-11-15",
  })
}

export const getSupabaseConfig = () => {
  const supabaseServiceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim()
  return {
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    supabaseAnonKey: getRequiredEnv("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey,
  }
}

export const buildSupabaseClients = (authHeader: string) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseConfig()

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const adminClient = createClient(
    supabaseUrl,
    supabaseServiceRoleKey || supabaseAnonKey,
  )

  return {
    authClient,
    adminClient,
  }
}

export const requireAuthHeader = (req: Request) => {
  const authHeader = String(req.headers.get("Authorization") || "").trim()
  if (!authHeader) {
    throw new HttpError("Unauthorized", 401)
  }
  return authHeader
}

export const getAuthenticatedUser = async (authClient: ReturnType<typeof createClient>) => {
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser()

  if (error || !user) {
    throw new HttpError("Unauthorized", 401)
  }

  return user
}

export const toPositiveInteger = (value: unknown, fieldName: string) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(`${fieldName} must be a positive integer`, 400)
  }
  return parsed
}

export const toCents = (amount: unknown) => {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.round(parsed * 100)
}

export const centsToAmount = (amountCents: number) => {
  return Number((amountCents / 100).toFixed(2))
}

export const normalizeCurrency = (value: unknown, fallback = "usd") => {
  const normalized = String(value || fallback).trim().toLowerCase()
  return normalized || fallback
}

export const normalizeStripeStatus = (value: unknown) => {
  return String(value || "").trim().toLowerCase()
}

export const resolveIdempotencyKey = (value: unknown, fallback: string) => {
  const normalized = String(value || "").trim()
  return normalized || fallback
}

export const mapUnexpectedError = (error: unknown) => {
  if (error instanceof HttpError) {
    return error
  }

  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: string }).message || "Unexpected error")
      : "Unexpected error"

  return new HttpError(message, 400)
}

export const resolveProfileName = (
  profile: { first_name?: string | null; last_name?: string | null; email?: string | null } | null,
  fallback: string,
) => {
  const firstName = String(profile?.first_name || "").trim()
  const lastName = String(profile?.last_name || "").trim()
  const fullName = `${firstName} ${lastName}`.trim()

  if (fullName) {
    return fullName
  }

  const email = String(profile?.email || "").trim()
  if (email.includes("@")) {
    return email.split("@")[0]
  }

  return fallback
}

export const resolveStripeCustomerIdForCustomer = async ({
  adminClient,
  stripe,
  customerId,
  fallbackEmail,
}: {
  adminClient: ReturnType<typeof createClient>
  stripe: Stripe
  customerId: string
  fallbackEmail?: string | null
}) => {
  const { data: customerProfile, error: profileError } = await adminClient
    .from("customers")
    .select("id, stripe_customer_id, first_name, last_name, email")
    .eq("id", customerId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!customerProfile) {
    throw new HttpError("Customer profile not found", 404)
  }

  const existingStripeCustomerId = String(customerProfile.stripe_customer_id || "").trim()
  if (existingStripeCustomerId) {
    return existingStripeCustomerId
  }

  const createdCustomer = await stripe.customers.create({
    email: String(fallbackEmail || customerProfile.email || "").trim() || undefined,
    name: resolveProfileName(customerProfile, "Customer") || undefined,
    metadata: {
      customer_id: customerId,
    },
  })

  const { error: updateError } = await adminClient
    .from("customers")
    .update({ stripe_customer_id: createdCustomer.id })
    .eq("id", customerId)

  if (updateError) {
    throw updateError
  }

  return createdCustomer.id
}

export const ensurePaymentMethodBelongsToCustomer = async ({
  stripe,
  paymentMethodId,
  stripeCustomerId,
}: {
  stripe: Stripe
  paymentMethodId: string
  stripeCustomerId: string
}) => {
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

  const attachedCustomerId =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id || null

  if (!attachedCustomerId) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    })
    return
  }

  if (attachedCustomerId !== stripeCustomerId) {
    throw new HttpError(
      "Selected payment method belongs to a different customer. Please add a new card.",
      400,
      "payment_method_mismatch",
    )
  }
}

type TripTipCreditParams = {
  adminClient: ReturnType<typeof createClient>
  tripTipId: string
  driverId: string
  amount: number
  creditedAt?: string
}

export const creditDriverTipIfPending = async ({
  adminClient,
  tripTipId,
  driverId,
  amount,
  creditedAt,
}: TripTipCreditParams) => {
  const creditTimestamp = String(creditedAt || new Date().toISOString())
  const normalizedAmount = Number(amount)

  if (!tripTipId || !driverId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return false
  }

  const { data: tripTipRows, error: tripTipMarkError } = await adminClient
    .from("trip_tips")
    .update({
      credited_to_driver_at: creditTimestamp,
      updated_at: creditTimestamp,
    })
    .eq("id", tripTipId)
    .is("credited_to_driver_at", null)
    .select("id")
    .limit(1)

  if (tripTipMarkError) {
    throw tripTipMarkError
  }

  if (!Array.isArray(tripTipRows) || tripTipRows.length === 0) {
    return false
  }

  const { data: driverProfile, error: driverProfileError } = await adminClient
    .from("drivers")
    .select("id, metadata")
    .eq("id", driverId)
    .maybeSingle()

  if (driverProfileError) {
    throw driverProfileError
  }

  if (!driverProfile) {
    return false
  }

  const metadata =
    driverProfile.metadata &&
    typeof driverProfile.metadata === "object" &&
    !Array.isArray(driverProfile.metadata)
      ? { ...(driverProfile.metadata as Record<string, unknown>) }
      : {}

  const totalEarnings = Number(metadata.totalEarnings || 0)
  const totalTips = Number(metadata.totalTips || 0)
  const totalPayouts = Number(metadata.totalPayouts || 0)

  const nextTotalEarnings = Number((totalEarnings + normalizedAmount).toFixed(2))
  const nextTotalTips = Number((totalTips + normalizedAmount).toFixed(2))
  const nextAvailableBalance = Number((Math.max(0, nextTotalEarnings - totalPayouts)).toFixed(2))

  const nextMetadata = {
    ...metadata,
    totalEarnings: nextTotalEarnings,
    totalTips: nextTotalTips,
    availableBalance: nextAvailableBalance,
    lastTipAt: creditTimestamp,
  }

  const { error: driverUpdateError } = await adminClient
    .from("drivers")
    .update({
      metadata: nextMetadata,
      updated_at: creditTimestamp,
    })
    .eq("id", driverId)

  if (driverUpdateError) {
    throw driverUpdateError
  }

  return true
}
