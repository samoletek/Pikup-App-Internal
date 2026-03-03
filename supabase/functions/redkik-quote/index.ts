import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const REDKIK_BASE_URL = Deno.env.get("REDKIK_BASE_URL") ?? ""
const REDKIK_CLIENT_ID = Deno.env.get("REDKIK_CLIENT_ID") ?? ""
const REDKIK_CLIENT_SECRET = Deno.env.get("REDKIK_CLIENT_SECRET") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// ----- Redkik API helpers -----

interface RedkikTokenResponse {
  accessToken?: string
  access_token?: string
  token?: string
}

async function getRedkikToken(): Promise<string> {
  const tokenUrl = `${REDKIK_BASE_URL}/api/v2/user/oauth/token`

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: REDKIK_CLIENT_ID,
      client_secret: REDKIK_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik auth failed (${res.status}): ${text}`)
  }

  const data: RedkikTokenResponse = await res.json()
  const token = data.accessToken || data.access_token || data.token
  if (!token) {
    throw new Error("Redkik auth response missing token")
  }
  return token
}

interface QuoteItem {
  name?: string
  description?: string
  value?: number
  weight?: number
  condition?: string
}

interface QuoteParams {
  items: QuoteItem[]
  pickup?: { address?: string; coordinates?: { lat?: number; lng?: number; latitude?: number; longitude?: number } }
  dropoff?: { address?: string; coordinates?: { lat?: number; lng?: number; latitude?: number; longitude?: number } }
  scheduledTime?: string | null
}

function buildQuotePayload(params: QuoteParams) {
  const totalValue = (params.items || []).reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0
  )

  const pickupCoords = params.pickup?.coordinates
  const dropoffCoords = params.dropoff?.coordinates

  return {
    transportMode: "GROUND",
    originAddress: params.pickup?.address || "",
    originLatitude: pickupCoords?.lat ?? pickupCoords?.latitude ?? 0,
    originLongitude: pickupCoords?.lng ?? pickupCoords?.longitude ?? 0,
    destinationAddress: params.dropoff?.address || "",
    destinationLatitude: dropoffCoords?.lat ?? dropoffCoords?.latitude ?? 0,
    destinationLongitude: dropoffCoords?.lng ?? dropoffCoords?.longitude ?? 0,
    commodityDescription: (params.items || [])
      .map((i) => i.name || "Item")
      .join(", "),
    declaredValue: totalValue,
    currency: "USD",
    shipmentDate: params.scheduledTime || new Date().toISOString(),
    items: (params.items || []).map((item) => ({
      description: item.name || "Item",
      value: Number(item.value) || 0,
      weight: Number(item.weight) || 0,
      weightUnit: "LBS",
    })),
  }
}

async function requestQuote(token: string, params: QuoteParams) {
  const quoteUrl = `${REDKIK_BASE_URL}/api/v2/quote/bookings/quote`
  const payload = buildQuotePayload(params)

  const res = await fetch(quoteUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik quote failed (${res.status}): ${text}`)
  }

  return await res.json()
}

async function purchaseQuote(token: string, offerId: string) {
  const purchaseUrl = `${REDKIK_BASE_URL}/api/v2/quote/bookings/purchase`

  const res = await fetch(purchaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ offerId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik purchase failed (${res.status}): ${text}`)
  }

  return await res.json()
}

// ----- Main handler -----

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!REDKIK_BASE_URL || !REDKIK_CLIENT_ID || !REDKIK_CLIENT_SECRET) {
      return jsonResponse(
        { error: "Insurance service not configured", code: "REDKIK_NOT_CONFIGURED" },
        503
      )
    }

    // Auth check
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

    const body = await req.json()
    const { action } = body

    // Get Redkik auth token
    const token = await getRedkikToken()

    switch (action) {
      case "get-quote": {
        const { items, pickup, dropoff, scheduledTime } = body
        if (!items || !Array.isArray(items) || items.length === 0) {
          return jsonResponse({ error: "Items array is required" }, 400)
        }

        const quoteResponse = await requestQuote(token, {
          items,
          pickup,
          dropoff,
          scheduledTime,
        })

        // Extract key fields from Redkik response
        // Adapt field names based on actual Redkik API response structure
        const offerId =
          quoteResponse.offerId ||
          quoteResponse.offer_id ||
          quoteResponse.id ||
          quoteResponse.quoteId ||
          null
        const premium =
          quoteResponse.premium ||
          quoteResponse.totalPremium ||
          quoteResponse.price ||
          quoteResponse.amount ||
          0

        return jsonResponse({
          offerId,
          premium: Number(premium),
          details: quoteResponse,
        })
      }

      case "purchase": {
        const { offerId } = body
        if (!offerId) {
          return jsonResponse({ error: "offerId is required" }, 400)
        }

        const purchaseResponse = await purchaseQuote(token, offerId)

        const bookingId =
          purchaseResponse.bookingId ||
          purchaseResponse.booking_id ||
          purchaseResponse.id ||
          null

        return jsonResponse({
          bookingId,
          details: purchaseResponse,
        })
      }

      default:
        return jsonResponse(
          { error: `Unknown action: ${action}. Use 'get-quote' or 'purchase'.` },
          400
        )
    }
  } catch (error) {
    console.error("Redkik quote function error:", error)
    return jsonResponse(
      { error: error.message || "Insurance service error", code: "REDKIK_ERROR" },
      500
    )
  }
})
