import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? ""
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: normalizedAmount,
      currency: String(currency || "usd").toLowerCase(),
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
