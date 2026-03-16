import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const REDKIK_BASE_URL = Deno.env.get("REDKIK_BASE_URL") ?? ""
const REDKIK_CLIENT_ID = Deno.env.get("REDKIK_CLIENT_ID") ?? ""
const REDKIK_CLIENT_SECRET = Deno.env.get("REDKIK_CLIENT_SECRET") ?? ""
// Optional fallback customer id when setup API returns no registered customers.
const REDKIK_ORG_ID = Deno.env.get("REDKIK_ORG_ID") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// ----- Auth: OAuth 2.0 with refresh token support -----

let cachedToken: string | null = null
let cachedRefreshToken: string | null = null
let tokenExpiresAt = 0

async function getRedkikToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  // Try refresh token first (avoids re-auth with client credentials)
  if (cachedRefreshToken && cachedToken) {
    try {
      const refreshed = await refreshAccessToken(cachedRefreshToken)
      if (refreshed) return refreshed
    } catch (e) {
      console.warn("[Redkik] Refresh token failed, falling back to client credentials:", e)
    }
  }

  // Full auth with client credentials
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
  return storeTokens(data)
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const tokenUrl = `${REDKIK_BASE_URL}/api/v2/user/oauth/token`

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    console.warn("[Redkik] Refresh failed:", res.status)
    return null
  }

  const data = await res.json()
  return storeTokens(data)
}

function storeTokens(data: Record<string, unknown>): string {
  const token = (data.access_token || data.accessToken || data.token) as string
  if (!token) {
    console.error("[Redkik] Auth response (no token found):", JSON.stringify(data))
    throw new Error("Redkik auth response missing token")
  }

  cachedToken = token
  cachedRefreshToken = (data.refresh_token || data.refreshToken || null) as string | null

  // Redkik returns expires_in in milliseconds (86400000 = 24h).
  // If value > 10000 treat as ms, otherwise treat as seconds.
  const rawExpires = (data.expires_in as number) || 3600000
  const expiresInMs = rawExpires > 10000 ? rawExpires : rawExpires * 1000
  tokenExpiresAt = Date.now() + expiresInMs - 60_000 // 1 min safety margin

  return token
}

// ----- Setup cache -----

interface SetupData {
  commodities: Array<{ id: string; name: string }>
  currencies: Array<{ id: string; symbol: string; divisionModifier: number }>
  policies: Array<{ id: string; alias: string }>
  customers: Array<{ id: string; name: string; email: string }>
  defaultCurrencyId: string
  raw: Record<string, unknown>
}

interface SetupCommodityRaw {
  id: string
  name?: string
}

interface SetupCurrencyRaw {
  id: string
  symbol?: string
  divisionModifier?: number
}

interface SetupPolicyRaw {
  id: string
  alias?: string
  name?: string
}

interface SetupCustomerRaw {
  id: string
  name?: string
  email?: string
}

interface SetupResponseRaw extends Record<string, unknown> {
  commodities?: SetupCommodityRaw[]
  currencies?: SetupCurrencyRaw[]
  policies?: SetupPolicyRaw[]
  customers?: SetupCustomerRaw[]
  currencyId?: string
}

let cachedSetup: SetupData | null = null
let setupExpiresAt = 0
const SETUP_TTL_MS = 30 * 60 * 1000 // 30 minutes

async function getSetupData(token: string): Promise<SetupData> {
  if (cachedSetup && Date.now() < setupExpiresAt) {
    return cachedSetup
  }

  const setupUrl = `${REDKIK_BASE_URL}/api/v2/quote/quotes/setup`
  console.log("[Redkik] Fetching setup from:", setupUrl)

  const res = await fetch(setupUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik setup failed (${res.status}): ${text}`)
  }

  const raw = (await res.json()) as SetupResponseRaw
  console.log("[Redkik] Setup response keys:", Object.keys(raw))

  const commodities = Array.isArray(raw.commodities)
    ? raw.commodities.map((commodity) => ({
        id: commodity.id,
        name: commodity.name || "Unknown",
      }))
    : []

  // Redkik currencies use id as the currency code (e.g. "USD", "EUR")
  const currencies = Array.isArray(raw.currencies)
    ? raw.currencies.map((currency) => ({
        id: currency.id,
        symbol: currency.symbol || "$",
        divisionModifier: currency.divisionModifier || 100,
      }))
    : []

  const policies = Array.isArray(raw.policies)
    ? raw.policies.map((policy) => ({
        id: policy.id,
        alias: policy.alias || policy.name || "",
      }))
    : []

  // Pre-registered customers in Redkik
  const customers = Array.isArray(raw.customers)
    ? raw.customers.map((customer) => ({
        id: customer.id,
        name: customer.name || "",
        email: customer.email || "",
      }))
    : []

  const defaultCurrencyId = raw.currencyId || "USD"

  cachedSetup = { commodities, currencies, policies, customers, defaultCurrencyId, raw }
  setupExpiresAt = Date.now() + SETUP_TTL_MS

  return cachedSetup
}

// Get the divisionModifier for a currency (for converting cents to dollars)
function getCurrencyDivider(setup: SetupData, currencyId: string): number {
  const c = setup.currencies.find((cur) => cur.id === currencyId)
  return c?.divisionModifier || 100
}

// Resolve first commodity ID (or find General Goods)
function findDefaultCommodity(setup: SetupData): string {
  const general = setup.commodities.find(
    (c) => c.name.toLowerCase().includes("general")
  )
  if (general) return general.id
  if (setup.commodities.length > 0) return setup.commodities[0].id
  return "ebe38cf9-df60-4f69-9210-a439981e6989"
}

// Find a pre-registered customer or return the first available
function findCustomerId(setup: SetupData): string | null {
  if (setup.customers.length > 0) return setup.customers[0].id
  return null
}

// ----- Quote helpers -----

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

interface OfferRecord extends Record<string, unknown> {
  id?: string
  accepted?: boolean
  totalCost?: number
  currencyDivisionModifier?: number
  insurerPremium?: number
  technologyFee?: number
  bookingFee?: number
  deductibles?: unknown[]
  currencySymbol?: string
  amendments?: Amendment[]
}

interface RedkikRequestBody {
  action?: string
  items?: QuoteItem[]
  pickup?: QuoteParams["pickup"]
  dropoff?: QuoteParams["dropoff"]
  scheduledTime?: string | null
  durationMinutes?: number | null
  customerEmail?: string
  customerName?: string
  offerId?: string
  bookingId?: string
}

function buildQuotePayload(params: QuoteParams, setup: SetupData) {
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

  const commodityId = findDefaultCommodity(setup)
  const currencyId = setup.defaultCurrencyId || "USD"
  const insuredValue = Math.max(Math.round(totalValue * 100), 100)

  const payload: Record<string, unknown> = {
    isPublic: false,
    commodities: [{
      commodityId,
      insuredValue,
      currencyId,
    }],
    commodityDescription,
    insuredValue,
    originFormatted: params.pickup?.address || "",
    destinationFormatted: params.dropoff?.address || "",
    startDate,
    endDate,
    transportType: 1, // ROAD per Redkik docs
  }

  // Use pre-registered customer from setup, or org UUID as fallback
  const customerId = findCustomerId(setup)
  if (customerId) {
    payload.customerId = customerId
  } else if (REDKIK_ORG_ID) {
    payload.customerId = REDKIK_ORG_ID
  }

  // Attach policy if available from setup
  if (setup.policies.length > 0) {
    payload.policyId = setup.policies[0].id
  }

  return payload
}

async function requestQuote(token: string, params: QuoteParams, setup: SetupData) {
  const quoteUrl = `${REDKIK_BASE_URL}/api/v2/quote/quotes/quote`
  const payload = buildQuotePayload(params, setup)

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

async function completeBooking(token: string, bookingId: string) {
  const completeUrl = `${REDKIK_BASE_URL}/api/v2/quote/bookings/${bookingId}/complete`

  console.log("[Redkik] Complete booking:", bookingId)

  const res = await fetch(completeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik complete failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  console.log("[Redkik] Complete response:", JSON.stringify(data))
  return data
}

async function cancelBooking(token: string, bookingId: string) {
  const cancelUrl = `${REDKIK_BASE_URL}/api/v2/quote/bookings/${bookingId}/cancel`

  console.log("[Redkik] Cancel booking:", bookingId)

  const res = await fetch(cancelUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Redkik cancel failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  console.log("[Redkik] Cancel response:", JSON.stringify(data))
  return data
}

// ----- Amendments validation -----

interface Amendment {
  type?: string       // "error" | "warning" | "info"
  message?: string
  field?: string
}

function extractAmendments(offer: Record<string, unknown>): Amendment[] {
  const amendments = (offer.amendments || offer.Amendments || []) as Amendment[]
  return Array.isArray(amendments) ? amendments : []
}

function hasBlockingAmendments(amendments: Amendment[]): boolean {
  return amendments.some(
    (a) => (a.type || "").toLowerCase() === "error"
  )
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

    const body = (await req.json()) as RedkikRequestBody
    const { action } = body

    const token = await getRedkikToken()

    switch (action) {
      // ----- Setup: returns available commodities, currencies, policies -----
      case "setup": {
        const setup = await getSetupData(token)
        return jsonResponse({
          commodities: setup.commodities,
          currencies: setup.currencies,
          policies: setup.policies,
          customers: setup.customers,
          defaultCurrencyId: setup.defaultCurrencyId,
        })
      }

      // ----- Get Quote: Setup -> Quote with amendments validation -----
      case "get-quote": {
        const {
          items = [],
          pickup,
          dropoff,
          scheduledTime,
          durationMinutes,
          customerEmail,
          customerName,
        } = body
        if (!items || !Array.isArray(items) || items.length === 0) {
          return jsonResponse({ error: "Items array is required" }, 400)
        }

        const totalItemValue = items.reduce((sum, item) => sum + (Number(item?.value) || 0), 0)
        if (totalItemValue <= 0) {
          return jsonResponse({ error: "Items must have a positive total value for insurance" }, 400)
        }

        // Step 1: Get setup data (cached) for correct UUIDs
        const setup = await getSetupData(token)

        // Step 2: Request quote with correct payload
        const quoteResponse = await requestQuote(token, {
          items, pickup, dropoff, scheduledTime, durationMinutes, customerEmail, customerName,
        }, setup)

        // Response is an array of offers — take the first accepted one
        const offers: OfferRecord[] = Array.isArray(quoteResponse)
          ? (quoteResponse as OfferRecord[])
          : [quoteResponse as OfferRecord]
        const acceptedOffer = offers.find((offer) => Boolean(offer.accepted)) || offers[0]

        if (!acceptedOffer) {
          return jsonResponse(
            { error: "No insurance offers returned", code: "NO_OFFERS" },
            502
          )
        }

        // Step 3: Validate amendments — block if errors present
        const amendments = extractAmendments(acceptedOffer)
        const blocked = hasBlockingAmendments(amendments)

        const offerId = String(acceptedOffer.id || "").trim()
        const divider = Number(
          acceptedOffer.currencyDivisionModifier || getCurrencyDivider(setup, setup.defaultCurrencyId)
        )
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
          canPurchase: !blocked,
          amendments: amendments.map((a) => ({
            type: a.type || "info",
            message: a.message || "",
            field: a.field || null,
          })),
          details: {
            insurerPremium: Number(acceptedOffer.insurerPremium || 0) / divider,
            technologyFee: Number(acceptedOffer.technologyFee || 0) / divider,
            bookingFee: Number(acceptedOffer.bookingFee || 0) / divider,
            totalCost: premium,
            deductibles: Array.isArray(acceptedOffer.deductibles) ? acceptedOffer.deductibles : [],
            accepted: Boolean(acceptedOffer.accepted),
            currencySymbol: String(acceptedOffer.currencySymbol || "$"),
          },
        })
      }

      // ----- Purchase: buy the quoted offer -----
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

      // ----- Complete: close the booking after successful delivery -----
      case "complete": {
        const { bookingId } = body
        if (!bookingId) {
          return jsonResponse({ error: "bookingId is required" }, 400)
        }

        const completeResponse = await completeBooking(token, bookingId)

        return jsonResponse({
          success: true,
          bookingId,
          details: completeResponse,
        })
      }

      // ----- Cancel: cancel the booking -----
      case "cancel": {
        const { bookingId } = body
        if (!bookingId) {
          return jsonResponse({ error: "bookingId is required" }, 400)
        }

        const cancelResponse = await cancelBooking(token, bookingId)

        return jsonResponse({
          success: true,
          bookingId,
          details: cancelResponse,
        })
      }

      default:
        return jsonResponse(
          { error: `Unknown action: ${action}. Supported: 'setup', 'get-quote', 'purchase', 'complete', 'cancel'.` },
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
