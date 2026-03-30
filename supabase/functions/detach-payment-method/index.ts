import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  HttpError,
  buildStripeClient,
  buildSupabaseClients,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  requireAuthHeader,
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

const isStripeMissingResourceError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeError = error as { code?: unknown; message?: unknown; type?: unknown }
  const code = resolveString(maybeError.code).toLowerCase()
  const type = resolveString(maybeError.type).toLowerCase()
  const message = resolveString(maybeError.message).toLowerCase()
  return (
    code === "resource_missing" ||
    type === "invalid_request_error" && message.includes("no such paymentmethod")
  )
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
    if (!paymentMethodId) {
      throw new HttpError("paymentMethodId is required", 400)
    }

    const { data: customerProfile, error: customerError } = await adminClient
      .from("customers")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle()

    if (customerError) {
      throw customerError
    }

    const stripeCustomerId = resolveString(customerProfile?.stripe_customer_id)
    if (!stripeCustomerId) {
      return jsonResponse({
        success: true,
        detachedPaymentMethodId: paymentMethodId,
        defaultPaymentMethodId: null,
      })
    }

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId)
    const currentDefaultPaymentMethodId = resolveStripeRefId(
      (stripeCustomer as { invoice_settings?: { default_payment_method?: unknown } })
        ?.invoice_settings
        ?.default_payment_method,
    )

    let attachedCustomerId = ""
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
      attachedCustomerId = resolveStripeRefId(
        (paymentMethod as { customer?: unknown }).customer,
      )
    } catch (error) {
      if (isStripeMissingResourceError(error)) {
        return jsonResponse({
          success: true,
          detachedPaymentMethodId: paymentMethodId,
          defaultPaymentMethodId: currentDefaultPaymentMethodId || null,
        })
      }
      throw error
    }

    if (attachedCustomerId && attachedCustomerId !== stripeCustomerId) {
      throw new HttpError(
        "Payment method belongs to a different customer.",
        403,
        "payment_method_mismatch",
      )
    }

    if (attachedCustomerId) {
      await stripe.paymentMethods.detach(paymentMethodId)
    }

    let nextDefaultPaymentMethodId = currentDefaultPaymentMethodId || null
    if (currentDefaultPaymentMethodId === paymentMethodId) {
      const remainingMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
        limit: 1,
      })
      nextDefaultPaymentMethodId = remainingMethods.data?.[0]?.id || null

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: nextDefaultPaymentMethodId,
        },
      })
    }

    return jsonResponse({
      success: true,
      detachedPaymentMethodId: paymentMethodId,
      defaultPaymentMethodId: nextDefaultPaymentMethodId,
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

