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

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    return jsonResponse({
      success: true,
      defaultPaymentMethodId: paymentMethodId,
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

