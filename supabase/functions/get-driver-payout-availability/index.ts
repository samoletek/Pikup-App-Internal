import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  buildStripeClient,
  buildSupabaseClients,
  centsToAmount,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
  mapUnexpectedError,
  requireAuthHeader,
} from "../_shared/paymentHelpers.ts"
import { resolveDriverPayoutAvailability } from "../_shared/payoutHelpers.ts"

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
    const payload = await req.json().catch(() => ({}))

    const driverId = resolveString(payload?.driverId) || user.id
    if (driverId !== user.id) {
      return jsonResponse({ success: false, error: "Forbidden" }, 403)
    }

    const availability = await resolveDriverPayoutAvailability({
      adminClient,
      stripe,
      driverId,
    })

    return jsonResponse({
      success: true,
      balanceAmount: centsToAmount(availability.balanceCents),
      availableNowAmount: centsToAmount(availability.availableNowCents),
      pendingAmount: centsToAmount(availability.pendingCents),
      pendingUntil: availability.pendingUntil,
      pendingUntilUnix: availability.pendingUntilUnix,
      sources: availability.sources.map((source) => ({
        tripId: source.tripId,
        paymentIntentId: source.paymentIntentId,
        chargeId: source.chargeId,
        amount: centsToAmount(source.amountCents),
        amountCents: source.amountCents,
        status: source.status,
        availableOn: source.availableOn,
        availableOnUnix: source.availableOnUnix,
      })),
    })
  } catch (error) {
    const normalized = mapUnexpectedError(error)
    return jsonResponse(
      {
        success: false,
        error: normalized.message,
        code: normalized.code,
      },
      normalized.status,
    )
  }
})
