import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  buildStripeClient,
  buildSupabaseClients,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  requireAuthHeader,
  resolveStripeCustomerIdForCustomer,
} from "../_shared/paymentHelpers.ts"

const resolveStripeRefId = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim()
  }
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id?: unknown }).id || "").trim()
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

    const stripeCustomerId = await resolveStripeCustomerIdForCustomer({
      adminClient,
      stripe,
      customerId: user.id,
      fallbackEmail: user.email || null,
    })

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    })

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = resolveStripeRefId(
      (stripeCustomer as { invoice_settings?: { default_payment_method?: unknown } })
        ?.invoice_settings
        ?.default_payment_method,
    )

    const formattedMethods = paymentMethods.data
      .filter((pm) => Boolean(pm?.card))
      .map((pm) => ({
        id: pm.id,
        stripePaymentMethodId: pm.id,
        brand: pm.card?.brand || "",
        cardBrand: pm.card?.brand || "",
        last4: pm.card?.last4 || "",
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: pm.id === defaultPaymentMethodId,
      }))

    return jsonResponse({
      paymentMethods: formattedMethods,
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
