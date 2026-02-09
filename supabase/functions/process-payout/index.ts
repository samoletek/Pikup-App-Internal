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
      return jsonResponse({ success: false, error: "Unauthorized" }, 401)
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Unauthorized" }, 401)
    }

    const {
      amount,
      currency = "usd",
      connectAccountId,
      transferGroup,
      driverId,
    } = await req.json()

    const normalizedDriverId = driverId || user.id
    if (normalizedDriverId !== user.id) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403)
    }

    if (!connectAccountId) {
      return jsonResponse({ success: false, error: "Missing 'connectAccountId'" }, 400)
    }

    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return jsonResponse({ success: false, error: "Invalid payout amount" }, 400)
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(normalizedAmount * 100),
      currency: String(currency || "usd").toLowerCase(),
      destination: connectAccountId,
      transfer_group: transferGroup || undefined,
      metadata: {
        driver_id: normalizedDriverId,
      },
    })

    return jsonResponse({ success: true, transferId: transfer.id })
  } catch (error) {
    console.error("Error processing payout:", error)
    return jsonResponse({ success: false, error: error.message }, 400)
  }
})
