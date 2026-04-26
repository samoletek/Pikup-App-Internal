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
import { processDriverPayout } from "../_shared/payoutHelpers.ts"

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

    const {
      amount,
      currency = "usd",
      transferGroup,
      driverId,
      mode = "instant",
      idempotencyKey,
    } = await req.json()

    const normalizedDriverId = resolveString(driverId) || user.id
    if (normalizedDriverId !== user.id) {
      throw new HttpError("Forbidden", 403)
    }

    const normalizedMode = resolveString(mode).toLowerCase() === "scheduled"
      ? "scheduled"
      : "instant"

    const resolvedIdempotencyKey = resolveString(idempotencyKey) ||
      resolveString(transferGroup) ||
      `payout:${normalizedDriverId}:${normalizedMode}:${Date.now()}`

    const payoutResult = await processDriverPayout({
      adminClient,
      stripe,
      driverId: normalizedDriverId,
      amount: Number(amount),
      currency: resolveString(currency) || "usd",
      transferGroup: resolveString(transferGroup) || null,
      mode: normalizedMode,
      idempotencyKey: resolvedIdempotencyKey,
      requestedBy: normalizedDriverId,
    })

    return jsonResponse({
      success: true,
      transferId: payoutResult.transferId,
      payoutId: payoutResult.payoutId,
      feeAmount: payoutResult.feeAmount,
      netAmount: payoutResult.netAmount,
      grossAmount: payoutResult.grossAmount,
      destinationAccountId: payoutResult.destinationAccountId,
      status: payoutResult.status,
      availableOn: payoutResult.availableOn,
      sourceTransactionUsed: payoutResult.sourceTransactionUsed,
      deduplicated: payoutResult.deduplicated,
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
