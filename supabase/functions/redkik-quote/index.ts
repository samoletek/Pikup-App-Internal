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

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getRedkikToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

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

  const data = await res.json()
  const token = data.access_token || data.accessToken || data.token
  if (!token) {
    console.error("[Redkik] Auth response (no token found):", JSON.stringify(data))
    throw new Error("Redkik auth response missing token")
  }

  cachedToken = token
  // Redkik returns expires_in in milliseconds (86400000 = 24h).
  // If value > 10000 treat as ms, otherwise treat as seconds.
  const expiresInMs = (data.expires_in || 3600000) > 10000
    ? (data.expires_in || 3600000)
    : (data.expires_in || 3600) * 1000
  tokenExpiresAt = Date.now() + expiresInMs - 60_000

  return token
}

// Default commodity ID for "General Goods &/or Merchandise" from Redkik setup
const DEFAULT_COMMODITY_ID = "ebe38cf9-df60-4f69-9210-a439981e6989"

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
  durationMinutes?: number | null
  customerEmail?: string
  customerName?: string
}

function buildQuotePayload(params: QuoteParams) {
  const totalValue = (params.items || []).reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0
  )

  const now = new Date()
  const startMs = params.scheduledTime
    ? new Date(params.scheduledTime).getTime()
    : now.getTime()
  const startDate = new Date(startMs).toISOString()

  // End date: trip duration (with 2h buffer) or fallback 6h from start
  const tripDurationMs = params.durationMinutes
    ? (params.durationMinutes + 120) * 60 * 1000
    : 6 * 60 * 60 * 1000
  const endDate = new Date(startMs + tripDurationMs).toISOString()

  const commodityDescription = (params.items || [])
    .map((i) => i.name || "Item")
    .join(", ")

  const fullName = (params.customerName || "").trim()
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || "Pikup"
  const lastName = nameParts.slice(1).join(" ") || "Customer"

  return {
    commodities: [{
      commodityId: DEFAULT_COMMODITY_ID,
      // Redkik expects insuredValue in smallest currency unit (cents for USD)
      insuredValue: Math.max(Math.round(totalValue * 100), 100),
      currencyId: "USD",
    }],
    commodityDescription,
    origin: { formatted: params.pickup?.address || "" },
    destination: { formatted: params.dropoff?.address || "" },
    startDate,
    endDate,
    conveyanceType: "ROAD",
    customer: {
      type: "INDIVIDUAL",
      email: params.customerEmail || "insurance@pikup-app.com",
      individualFirstName: firstName,
      individualLastName: lastName,
      address: { formatted: params.pickup?.address || "" },
    },
  }
}

async function requestQuote(token: string, params: QuoteParams) {
  // Correct endpoint: /api/v2/quote/quotes/quote (NOT /bookings/quote)
  const quoteUrl = `${REDKIK_BASE_URL}/api/v2/quote/quotes/quote`
  const payload = buildQuotePayload(params)

  console.log("[Redkik] Quote request URL:", quoteUrl)
  console.log("[Redkik] Quote request payload:", JSON.stringify(payload))

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

  const quoteData = await res.json()
  console.log("[Redkik] Quote response:", JSON.stringify(quoteData))
  return quoteData
}

async function purchaseQuote(token: string, offerId: string) {
  // Purchase endpoint confirmed in Swagger: /api/v2/quote/bookings/purchase
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

  const purchaseData = await res.json()
  console.log("[Redkik] Purchase response:", JSON.stringify(purchaseData))
  return purchaseData
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

    const token = await getRedkikToken()

    switch (action) {
      case "get-quote": {
        const { items, pickup, dropoff, scheduledTime, durationMinutes, customerEmail, customerName } = body
        if (!items || !Array.isArray(items) || items.length === 0) {
          return jsonResponse({ error: "Items array is required" }, 400)
        }

        const totalItemValue = items.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0)
        if (totalItemValue <= 0) {
          return jsonResponse({ error: "Items must have a positive total value for insurance" }, 400)
        }

        const quoteResponse = await requestQuote(token, {
          items,
          pickup,
          dropoff,
          scheduledTime,
          durationMinutes,
          customerEmail,
          customerName,
        })

        // Response is an array of offers — take the first accepted one
        const offers = Array.isArray(quoteResponse) ? quoteResponse : [quoteResponse]
        const acceptedOffer = offers.find((o: any) => o.accepted) || offers[0]

        if (!acceptedOffer) {
          return jsonResponse(
            { error: "No insurance offers returned", code: "NO_OFFERS" },
            502
          )
        }

        const offerId = acceptedOffer.id
        // Prices are in cents — convert using currencyDivisionModifier (default 100)
        const divider = acceptedOffer.currencyDivisionModifier || 100
        const premium = Number(acceptedOffer.totalCost || 0) / divider

        if (!offerId) {
          console.error("Redkik offer missing id:", JSON.stringify(acceptedOffer))
          return jsonResponse(
            { error: "Insurance quote returned no offer identifier", code: "MISSING_OFFER_ID" },
            502
          )
        }
        if (premium <= 0) {
          console.error("Redkik offer zero premium:", JSON.stringify(acceptedOffer))
          return jsonResponse(
            { error: "Insurance quote returned invalid premium", code: "INVALID_PREMIUM" },
            502
          )
        }

        return jsonResponse({
          offerId,
          premium,
          details: {
            insurerPremium: Number(acceptedOffer.insurerPremium || 0) / divider,
            technologyFee: Number(acceptedOffer.technologyFee || 0) / divider,
            bookingFee: Number(acceptedOffer.bookingFee || 0) / divider,
            totalCost: premium,
            deductibles: acceptedOffer.deductibles || [],
            accepted: acceptedOffer.accepted,
            currencySymbol: acceptedOffer.currencySymbol || "$",
          },
        })
      }

      case "purchase": {
        const { offerId } = body
        if (!offerId) {
          return jsonResponse({ error: "offerId is required" }, 400)
        }

        const purchaseResponse = await purchaseQuote(token, offerId)

        const bookingId =
          purchaseResponse.id ||
          purchaseResponse.bookingId ||
          purchaseResponse.booking_id ||
          null

        if (!bookingId) {
          console.error("Redkik purchase response missing bookingId:", JSON.stringify(purchaseResponse))
          return jsonResponse(
            { error: "Insurance purchase returned no booking identifier", code: "MISSING_BOOKING_ID" },
            502
          )
        }

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
    const message = error instanceof Error ? error.message : "Insurance service error"
    return jsonResponse(
      { error: message, code: "REDKIK_ERROR" },
      500
    )
  }
})
