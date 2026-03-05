import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? ""
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const stripe = new Stripe(stripeKey, {
  apiVersion: "2022-11-15",
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!stripeKey || !supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing required server configuration.")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey || supabaseAnonKey
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const {
      amount,
      currency = "usd",
      userId,
      paymentMethodId,
      rideDetails,
    } = await req.json()

    if (userId && userId !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403)
    }

    const normalizedAmount = Number(amount)
    if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
      return jsonResponse({ error: "Invalid amount. Expected positive integer in cents." }, 400)
    }

    const metadata: Record<string, string> = {
      user_id: user.id,
    }

    if (rideDetails) {
      metadata.ride_details = JSON.stringify(rideDetails).slice(0, 500)
    }

    if (paymentMethodId) {
      metadata.payment_method_id = String(paymentMethodId)
    }

    const { data: customerProfile } = await supabaseAdminClient
      .from("customers")
      .select("id, stripe_customer_id, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()

    let stripeCustomerId = customerProfile?.stripe_customer_id || ""

    if (!stripeCustomerId) {
      const resolvedName = [
        customerProfile?.first_name ?? "",
        customerProfile?.last_name ?? "",
      ]
        .join(" ")
        .trim()

      const createdCustomer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: resolvedName || undefined,
        metadata: {
          user_id: user.id,
        },
      })

      stripeCustomerId = createdCustomer.id

      const { error: updateCustomerError } = await supabaseAdminClient
        .from("customers")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)

      if (updateCustomerError) {
        console.warn("Unable to persist stripe_customer_id for customer:", updateCustomerError)
      }
    }

    if (paymentMethodId) {
      const resolvedPaymentMethodId = String(paymentMethodId)
      const paymentMethod = await stripe.paymentMethods.retrieve(resolvedPaymentMethodId)
      const attachedCustomerId =
        typeof paymentMethod.customer === "string"
          ? paymentMethod.customer
          : paymentMethod.customer?.id || null

      if (!attachedCustomerId) {
        await stripe.paymentMethods.attach(resolvedPaymentMethodId, {
          customer: stripeCustomerId,
        })
      } else if (attachedCustomerId !== stripeCustomerId) {
        return jsonResponse(
          {
            error:
              "Selected payment method belongs to a different customer. Please add a new card.",
          },
          400
        )
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: normalizedAmount,
      currency: String(currency || "usd").toLowerCase(),
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata,
    })

    return jsonResponse({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return jsonResponse({ error: error.message || "Failed to create payment intent" }, 400)
  }
})
