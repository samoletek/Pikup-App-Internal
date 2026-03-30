import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  HttpError,
  buildStripeClient,
  buildSupabaseClients,
  corsHeaders,
  ensurePaymentMethodBelongsToCustomer,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  requireAuthHeader,
  resolveStripeCustomerIdForCustomer,
} from "../_shared/paymentHelpers.ts"

const resolveString = (value: unknown) => String(value || "").trim()

const resolveStripeRefId = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim()
  }
  if (value && typeof value === "object" && "id" in value) {
    return resolveString((value as { id?: unknown }).id)
  }
  return ""
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
    const paymentMethodId = resolveString(payload?.paymentMethodId)
    const setAsDefault = Boolean(payload?.setAsDefault)

    if (!paymentMethodId) {
      throw new HttpError("paymentMethodId is required", 400)
    }

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

    if (setAsDefault) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })
    }

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = resolveStripeRefId(
      (stripeCustomer as { invoice_settings?: { default_payment_method?: unknown } })
        ?.invoice_settings
        ?.default_payment_method,
    )

    return jsonResponse({
      success: true,
      paymentMethodId,
      defaultPaymentMethodId: defaultPaymentMethodId || null,
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

