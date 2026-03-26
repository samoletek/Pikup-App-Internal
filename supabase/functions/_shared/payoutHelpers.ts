import Stripe from "https://esm.sh/stripe@12.0.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { HttpError, normalizeCurrency } from "./paymentHelpers.ts"

const readNonNegativeNumber = (name: string, fallback = 0) => {
  const raw = Number(Deno.env.get(name))
  if (!Number.isFinite(raw) || raw < 0) {
    return fallback
  }
  return raw
}

const INSTANT_PAYOUT_FEE_BPS = readNonNegativeNumber("STRIPE_INSTANT_PAYOUT_FEE_BPS", 0)
const INSTANT_PAYOUT_FEE_FLAT_CENTS = readNonNegativeNumber("STRIPE_INSTANT_PAYOUT_FEE_FLAT_CENTS", 0)

const toCents = (amount: number) => Math.round(amount * 100)
const toAmount = (amountCents: number) => Number((amountCents / 100).toFixed(2))

const toObjectRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

const toString = (value: unknown) => String(value || "").trim()

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  if (typeof value === "number") {
    return value !== 0
  }
  return fallback
}

const isDuplicateKeyError = (error: unknown) => {
  const code = String((error as { code?: string })?.code || "").trim()
  if (code === "23505") {
    return true
  }

  const details = `${(error as { message?: string })?.message || ""} ${(error as { details?: string })?.details || ""}`
    .toLowerCase()
  return details.includes("duplicate key")
}

const resolveTransferFeeCents = async (stripe: Stripe, transfer: Stripe.Transfer) => {
  if (!transfer.balance_transaction) {
    return null
  }

  if (typeof transfer.balance_transaction === "object") {
    const fee = Number(transfer.balance_transaction.fee)
    if (Number.isFinite(fee) && fee >= 0) {
      return Math.round(fee)
    }
    return null
  }

  const balanceTransaction = await stripe.balanceTransactions.retrieve(transfer.balance_transaction)
  const fee = Number(balanceTransaction?.fee)
  if (!Number.isFinite(fee) || fee < 0) {
    return null
  }

  return Math.round(fee)
}

const estimateFeeCents = (mode: "instant" | "scheduled", grossAmountCents: number) => {
  if (mode !== "instant") {
    return 0
  }

  return Math.max(
    0,
    Math.round((grossAmountCents * INSTANT_PAYOUT_FEE_BPS) / 10000) + Math.round(INSTANT_PAYOUT_FEE_FLAT_CENTS),
  )
}

type DriverPayoutRow = {
  id: string
  metadata?: unknown
}

const fetchDriverRow = async (
  adminClient: ReturnType<typeof createClient>,
  driverId: string,
) => {
  const { data: row, error } = await adminClient
    .from("drivers")
    .select("id, stripe_account_id, can_receive_payments, metadata")
    .eq("id", driverId)
    .maybeSingle()

  if (error) {
    throw error
  }
  if (!row) {
    throw new HttpError("Driver profile not found", 404)
  }
  return row as DriverPayoutRow & {
    stripe_account_id?: string | null
    can_receive_payments?: boolean | null
  }
}

type ExistingPayoutRow = {
  id: string
  driver_id: string
  kind: string
  transfer_id: string
  gross_amount: number
  fee_amount: number
  net_amount: number
  currency: string
  metadata?: unknown
}

const acquireDriverPayoutLock = async ({
  adminClient,
  driverId,
  lockToken,
  ttlSeconds = 180,
}: {
  adminClient: ReturnType<typeof createClient>
  driverId: string
  lockToken: string
  ttlSeconds?: number
}) => {
  const { data, error } = await adminClient.rpc("acquire_driver_payout_lock", {
    p_driver_id: driverId,
    p_lock_token: lockToken,
    p_ttl_seconds: Math.max(30, Math.min(Math.trunc(ttlSeconds), 900)),
  })

  if (error) {
    throw error
  }

  return Boolean(data)
}

const releaseDriverPayoutLock = async ({
  adminClient,
  driverId,
  lockToken,
}: {
  adminClient: ReturnType<typeof createClient>
  driverId: string
  lockToken: string
}) => {
  const { error } = await adminClient.rpc("release_driver_payout_lock", {
    p_driver_id: driverId,
    p_lock_token: lockToken,
  })

  if (error) {
    throw error
  }
}

const fetchPayoutByIdempotencyKey = async (
  adminClient: ReturnType<typeof createClient>,
  idempotencyKey: string,
) => {
  const { data: existingRow, error: existingError } = await adminClient
    .from("driver_payouts")
    .select("id,driver_id,kind,transfer_id,gross_amount,fee_amount,net_amount,currency,metadata")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  return existingRow as ExistingPayoutRow | null
}

const updateDriverMetadataWithPayout = async ({
  adminClient,
  driverId,
  grossAmount,
  feeAmount,
  netAmount,
  transferId,
  transferGroup,
  mode,
  requestedBy,
  processedAt,
}: {
  adminClient: ReturnType<typeof createClient>
  driverId: string
  grossAmount: number
  feeAmount: number
  netAmount: number
  transferId: string
  transferGroup?: string | null
  mode: "instant" | "scheduled"
  requestedBy?: string | null
  processedAt: string
}) => {
  const driverRow = await fetchDriverRow(adminClient, driverId)
  const metadata = toObjectRecord(driverRow.metadata)
  const payouts = Array.isArray(metadata.payouts) ? metadata.payouts : []
  const hasTransferAlready = payouts.some((entry) => {
    const candidate = toObjectRecord(entry)
    return toString(candidate.id) === transferId
  })

  if (hasTransferAlready || toString(metadata.lastPayoutId) === transferId) {
    return
  }

  const currentTotalPayouts = toNumber(metadata.totalPayouts, 0)
  const currentAvailableBalance = toNumber(metadata.availableBalance, 0)
  const nextTotalPayouts = Number((currentTotalPayouts + grossAmount).toFixed(2))
  const nextAvailableBalance = Number((Math.max(0, currentAvailableBalance - grossAmount)).toFixed(2))

  const payoutRecord = {
    id: transferId,
    amount: grossAmount,
    grossAmount,
    feeAmount,
    netAmount,
    createdAt: processedAt,
    status: "processed",
    transferGroup: toString(transferGroup) || null,
    kind: mode,
    source: requestedBy || "driver",
  }

  const nextMetadata = {
    ...metadata,
    totalPayouts: nextTotalPayouts,
    availableBalance: nextAvailableBalance,
    payouts: [payoutRecord, ...payouts].slice(0, 100),
    lastPayoutAt: processedAt,
    lastPayoutId: transferId,
    updatedAt: processedAt,
  }

  const { error: updateError } = await adminClient
    .from("drivers")
    .update({
      metadata: nextMetadata,
      updated_at: processedAt,
    })
    .eq("id", driverId)

  if (updateError) {
    throw updateError
  }
}

export type ProcessDriverPayoutParams = {
  adminClient: ReturnType<typeof createClient>
  stripe: Stripe
  driverId: string
  amount: number
  currency?: string
  transferGroup?: string | null
  mode?: "instant" | "scheduled"
  idempotencyKey: string
  requestedBy?: string | null
  providedConnectAccountId?: string | null
  periodKey?: string | null
}

export type ProcessDriverPayoutResult = {
  transferId: string
  payoutId: string
  feeAmount: number
  netAmount: number
  grossAmount: number
  currency: string
  destinationAccountId: string
  deduplicated: boolean
}

export const processDriverPayout = async ({
  adminClient,
  stripe,
  driverId,
  amount,
  currency = "usd",
  transferGroup = null,
  mode = "instant",
  idempotencyKey,
  requestedBy = null,
  providedConnectAccountId = null,
  periodKey = null,
}: ProcessDriverPayoutParams): Promise<ProcessDriverPayoutResult> => {
  const normalizedDriverId = toString(driverId)
  if (!normalizedDriverId) {
    throw new HttpError("driverId is required", 400)
  }

  const normalizedIdempotencyKey = toString(idempotencyKey)
  if (!normalizedIdempotencyKey) {
    throw new HttpError("idempotencyKey is required", 400)
  }

  const lockToken = crypto.randomUUID()
  const hasLock = await acquireDriverPayoutLock({
    adminClient,
    driverId: normalizedDriverId,
    lockToken,
    ttlSeconds: 180,
  })

  if (!hasLock) {
    throw new HttpError(
      "Another payout is currently being processed for this driver. Please retry in a moment.",
      409,
      "payout_in_progress",
    )
  }

  try {
    const existingPayout = await fetchPayoutByIdempotencyKey(adminClient, normalizedIdempotencyKey)
    if (existingPayout?.id && existingPayout.transfer_id) {
      if (toString(existingPayout.driver_id) !== normalizedDriverId) {
        throw new HttpError("Forbidden", 403)
      }

      const existingDriverRow = await fetchDriverRow(adminClient, normalizedDriverId)
      const existingDriverMetadata = toObjectRecord(existingDriverRow.metadata)
      const existingDestinationAccountId =
        toString(existingDriverRow.stripe_account_id) ||
        toString(existingDriverMetadata.connectAccountId)
      const existingPayoutMetadata = toObjectRecord(existingPayout.metadata)
      const existingMode = toString(existingPayout.kind) === "scheduled" ? "scheduled" : "instant"
      await updateDriverMetadataWithPayout({
        adminClient,
        driverId: normalizedDriverId,
        grossAmount: Number(existingPayout.gross_amount || 0),
        feeAmount: Number(existingPayout.fee_amount || 0),
        netAmount: Number(existingPayout.net_amount || 0),
        transferId: existingPayout.transfer_id,
        transferGroup: toString(existingPayoutMetadata.transfer_group) || null,
        mode: existingMode,
        requestedBy,
        processedAt: new Date().toISOString(),
      })

      return {
        transferId: existingPayout.transfer_id,
        payoutId: existingPayout.id,
        feeAmount: Number(existingPayout.fee_amount || 0),
        netAmount: Number(existingPayout.net_amount || 0),
        grossAmount: Number(existingPayout.gross_amount || 0),
        currency: normalizeCurrency(existingPayout.currency, "usd"),
        destinationAccountId: existingDestinationAccountId,
        deduplicated: true,
      }
    }

    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new HttpError("Invalid payout amount", 400)
    }

    const grossAmountCents = toCents(normalizedAmount)
    if (!Number.isInteger(grossAmountCents) || grossAmountCents <= 0) {
      throw new HttpError("Invalid payout amount", 400)
    }

    const modeValue = mode === "scheduled" ? "scheduled" : "instant"
    const normalizedCurrency = normalizeCurrency(currency, "usd")

    const driverRow = await fetchDriverRow(adminClient, normalizedDriverId)
    const metadata = toObjectRecord(driverRow.metadata)
    const connectAccountId =
      toString(driverRow.stripe_account_id) ||
      toString(metadata.connectAccountId)

    if (!connectAccountId) {
      throw new HttpError("Stripe Connect account is not configured", 409)
    }

    const requestedConnectAccountId = toString(providedConnectAccountId)
    if (requestedConnectAccountId && requestedConnectAccountId !== connectAccountId) {
      throw new HttpError("Payout destination does not match onboarding account", 403, "payout_destination_mismatch")
    }

    const canReceivePayments = toBoolean(
      driverRow.can_receive_payments,
      toBoolean(metadata.canReceivePayments, false),
    )
    if (!canReceivePayments) {
      throw new HttpError("Driver payout account is not ready", 409, "payout_account_not_ready")
    }

    const availableBalance = Number(toNumber(metadata.availableBalance, 0).toFixed(2))
    const grossAmount = toAmount(grossAmountCents)
    if (grossAmount > availableBalance) {
      throw new HttpError(
        `Insufficient available balance. Available: $${availableBalance.toFixed(2)}`,
        409,
        "insufficient_available_balance",
      )
    }

    const estimatedFeeCents = estimateFeeCents(modeValue, grossAmountCents)
    const chargedFeeCents = Math.min(
      Math.max(0, Math.round(estimatedFeeCents)),
      Math.max(0, grossAmountCents - 1),
    )
    const transferAmountCents = grossAmountCents - chargedFeeCents
    if (transferAmountCents <= 0) {
      throw new HttpError("Payout amount is too low after fees", 400)
    }

    const transfer = await stripe.transfers.create(
      {
        amount: transferAmountCents,
        currency: normalizedCurrency,
        destination: connectAccountId,
        transfer_group: toString(transferGroup) || undefined,
        metadata: {
          driver_id: normalizedDriverId,
          mode: modeValue,
          gross_amount_cents: String(grossAmountCents),
          charged_fee_amount_cents: String(chargedFeeCents),
          transfer_amount_cents: String(transferAmountCents),
          requested_by: toString(requestedBy) || "driver",
          period_key: toString(periodKey) || "",
        },
      },
      {
        idempotencyKey: normalizedIdempotencyKey,
      },
    )

    const resolvedFeeCentsRaw = await resolveTransferFeeCents(stripe, transfer)
    const actualStripeFeeCents =
      Number.isFinite(resolvedFeeCentsRaw) && resolvedFeeCentsRaw !== null
        ? Math.max(0, Math.round(Number(resolvedFeeCentsRaw)))
        : null

    const netAmountCents = transferAmountCents

    const nowIso = new Date().toISOString()
    const payload = {
      driver_id: normalizedDriverId,
      kind: modeValue,
      period_key: toString(periodKey) || null,
      transfer_id: transfer.id,
      idempotency_key: normalizedIdempotencyKey,
      gross_amount: toAmount(grossAmountCents),
      fee_amount: toAmount(chargedFeeCents),
      net_amount: toAmount(netAmountCents),
      currency: normalizedCurrency,
      status: "processed",
      requested_by: toString(requestedBy) || null,
      metadata: {
        transfer_group: toString(transferGroup) || null,
        actual_stripe_fee_cents: actualStripeFeeCents,
      },
      processed_at: nowIso,
      updated_at: nowIso,
    }

    const { data: insertedPayout, error: insertError } = await adminClient
      .from("driver_payouts")
      .insert(payload)
      .select("id,transfer_id,gross_amount,fee_amount,net_amount,currency")
      .single()

    if (insertError) {
      if (isDuplicateKeyError(insertError)) {
        const dedupedPayout = await fetchPayoutByIdempotencyKey(adminClient, normalizedIdempotencyKey)
        if (dedupedPayout?.id && dedupedPayout.transfer_id) {
          const dedupedMetadata = toObjectRecord(dedupedPayout.metadata)
          const dedupedMode = toString(dedupedPayout.kind) === "scheduled" ? "scheduled" : "instant"
          await updateDriverMetadataWithPayout({
            adminClient,
            driverId: normalizedDriverId,
            grossAmount: Number(dedupedPayout.gross_amount || 0),
            feeAmount: Number(dedupedPayout.fee_amount || 0),
            netAmount: Number(dedupedPayout.net_amount || 0),
            transferId: dedupedPayout.transfer_id,
            transferGroup: toString(dedupedMetadata.transfer_group) || null,
            mode: dedupedMode,
            requestedBy,
            processedAt: new Date().toISOString(),
          })

          return {
            transferId: dedupedPayout.transfer_id,
            payoutId: dedupedPayout.id,
            feeAmount: Number(dedupedPayout.fee_amount || 0),
            netAmount: Number(dedupedPayout.net_amount || 0),
            grossAmount: Number(dedupedPayout.gross_amount || 0),
            currency: normalizeCurrency(dedupedPayout.currency, normalizedCurrency),
            destinationAccountId: connectAccountId,
            deduplicated: true,
          }
        }
      }
      throw insertError
    }

    await updateDriverMetadataWithPayout({
      adminClient,
      driverId: normalizedDriverId,
      grossAmount: toAmount(grossAmountCents),
      feeAmount: toAmount(chargedFeeCents),
      netAmount: toAmount(netAmountCents),
      transferId: transfer.id,
      transferGroup,
      mode: modeValue,
      requestedBy,
      processedAt: nowIso,
    })

    return {
      transferId: transfer.id,
      payoutId: String(insertedPayout?.id || ""),
      feeAmount: Number(insertedPayout?.fee_amount || toAmount(chargedFeeCents)),
      netAmount: Number(insertedPayout?.net_amount || toAmount(netAmountCents)),
      grossAmount: Number(insertedPayout?.gross_amount || toAmount(grossAmountCents)),
      currency: normalizeCurrency(insertedPayout?.currency, normalizedCurrency),
      destinationAccountId: connectAccountId,
      deduplicated: false,
    }
  } finally {
    try {
      await releaseDriverPayoutLock({
        adminClient,
        driverId: normalizedDriverId,
        lockToken,
      })
    } catch (_releaseError) {
      // No-op: lock has TTL fallback and should not mask the payout result.
    }
  }
}
