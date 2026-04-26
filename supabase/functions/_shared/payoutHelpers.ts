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

const isStripeInsufficientFundsError = (error: unknown) => {
  const candidate = error as { code?: unknown; message?: unknown; raw?: { code?: unknown; message?: unknown } }
  const code = String(candidate?.code || candidate?.raw?.code || "").trim().toLowerCase()
  const message = String(candidate?.message || candidate?.raw?.message || "").trim().toLowerCase()

  return code === "balance_insufficient" ||
    code === "insufficient_funds" ||
    message.includes("insufficient funds") ||
    message.includes("insufficient available funds") ||
    message.includes("available balance")
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
  status?: string | null
  metadata?: unknown
}

type TripPayoutSourceRow = {
  id: string
  booking_payment_intent_id?: string | null
  pickup_location?: unknown
  price?: number | string | null
  insurance_premium?: number | string | null
  completed_at?: string | null
  created_at?: string | null
}

type PayoutSourceUsage = {
  tripId: string
  paymentIntentId: string
  chargeId: string
  amountCents: number
  availableOn: string | null
  availableOnUnix: number | null
}

type PayoutAvailabilitySource = PayoutSourceUsage & {
  status: "available" | "pending"
}

export type DriverPayoutAvailabilityResult = {
  balanceCents: number
  availableNowCents: number
  pendingCents: number
  pendingUntil: string | null
  pendingUntilUnix: number | null
  sources: PayoutAvailabilitySource[]
}

const unixSecondsToIso = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return new Date(Math.round(parsed) * 1000).toISOString()
}

const resolveTripDriverPayoutCents = (trip: TripPayoutSourceRow) => {
  const pickupLocation = toObjectRecord(trip.pickup_location)
  const pricing = toObjectRecord(pickupLocation.pricing)
  const directDriverPayout = toNumber(pricing.driverPayout ?? pricing.driver_payout, 0)

  if (directDriverPayout > 0) {
    return toCents(directDriverPayout)
  }

  const price = toNumber(trip.price ?? pricing.total, 0)
  const insurance = toNumber(trip.insurance_premium ?? pricing.mandatoryInsurance, 0)
  const splitBaseAmount = Math.max(0, price - insurance)
  const driverPayoutPercent = toNumber(pricing.driverPayoutPercent, 0.75)

  return toCents(splitBaseAmount * driverPayoutPercent)
}

const readPayoutSourceUsages = async (
  adminClient: ReturnType<typeof createClient>,
  driverId: string,
) => {
  const { data, error } = await adminClient
    .from("driver_payouts")
    .select("metadata")
    .eq("driver_id", driverId)
    .in("status", ["processed", "pending"])

  if (error) {
    throw error
  }

  const usedByTrip = new Map<string, number>()
  for (const row of data || []) {
    const metadata = toObjectRecord((row as { metadata?: unknown }).metadata)
    const sources = Array.isArray(metadata.sources) ? metadata.sources : []

    for (const source of sources) {
      const sourceRecord = toObjectRecord(source)
      const tripId = toString(sourceRecord.trip_id ?? sourceRecord.tripId)
      const amountCents = Math.max(
        0,
        Math.round(toNumber(sourceRecord.amount_cents ?? sourceRecord.amountCents, 0)),
      )

      if (tripId && amountCents > 0) {
        usedByTrip.set(tripId, (usedByTrip.get(tripId) || 0) + amountCents)
      }
    }
  }

  return usedByTrip
}

const resolveChargeAvailability = (charge: unknown) => {
  const chargeRecord = toObjectRecord(charge)
  const balanceTransaction = toObjectRecord(chargeRecord.balance_transaction)
  const availableOnUnix = toNumber(balanceTransaction.available_on, 0)

  return {
    chargeId: toString(chargeRecord.id),
    availableOn: unixSecondsToIso(availableOnUnix),
    availableOnUnix: availableOnUnix > 0 ? Math.round(availableOnUnix) : null,
  }
}

const resolvePaymentIntentChargeSource = async (stripe: Stripe, paymentIntentId: string) => {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  })
  const latestCharge = paymentIntent.latest_charge

  if (latestCharge && typeof latestCharge === "object") {
    const availability = resolveChargeAvailability(latestCharge)
    if (availability.chargeId) {
      return availability
    }
  }

  const chargeId = typeof latestCharge === "string" ? latestCharge : null
  if (!chargeId) {
    return { chargeId: "", availableOn: null, availableOnUnix: null }
  }

  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  })

  return resolveChargeAvailability(charge)
}

const listUnpaidTripPayoutSources = async ({
  adminClient,
  stripe,
  driverId,
}: {
  adminClient: ReturnType<typeof createClient>
  stripe: Stripe
  driverId: string
}): Promise<PayoutSourceUsage[]> => {
  const [usedByTrip, tripsResult] = await Promise.all([
    readPayoutSourceUsages(adminClient, driverId),
    adminClient
      .from("trips")
      .select("id,booking_payment_intent_id,pickup_location,price,insurance_premium,completed_at,created_at")
      .eq("driver_id", driverId)
      .eq("status", "completed")
      .eq("booking_payment_status", "captured")
      .not("booking_payment_intent_id", "is", null)
      .order("completed_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ])

  const { data: trips, error: tripsError } = tripsResult
  if (tripsError) {
    throw tripsError
  }

  const sources: PayoutSourceUsage[] = []
  for (const trip of (trips || []) as TripPayoutSourceRow[]) {
    const tripId = toString(trip.id)
    const paymentIntentId = toString(trip.booking_payment_intent_id)
    if (!tripId || !paymentIntentId) {
      continue
    }

    const payoutCents = resolveTripDriverPayoutCents(trip)
    const usedCents = usedByTrip.get(tripId) || 0
    const remainingCents = Math.max(0, payoutCents - usedCents)
    if (remainingCents <= 0) {
      continue
    }

    const chargeSource = await resolvePaymentIntentChargeSource(stripe, paymentIntentId)
    if (!chargeSource.chargeId) {
      continue
    }

    sources.push({
      tripId,
      paymentIntentId,
      chargeId: chargeSource.chargeId,
      amountCents: remainingCents,
      availableOn: chargeSource.availableOn,
      availableOnUnix: chargeSource.availableOnUnix,
    })
  }

  return sources
}

const isSourceAvailableNow = (source: PayoutSourceUsage) => {
  const availableOnUnix = Number(source.availableOnUnix || 0)
  return Number.isFinite(availableOnUnix) &&
    availableOnUnix > 0 &&
    availableOnUnix <= Math.floor(Date.now() / 1000)
}

const findSingleSourceTransactionForPayout = async ({
  adminClient,
  stripe,
  driverId,
  amountCents,
}: {
  adminClient: ReturnType<typeof createClient>
  stripe: Stripe
  driverId: string
  amountCents: number
}): Promise<PayoutSourceUsage | null> => {
  const sources = await listUnpaidTripPayoutSources({
    adminClient,
    stripe,
    driverId,
  })

  return sources.find((source) => source.amountCents >= amountCents && isSourceAvailableNow(source)) || null
}

const serializePayoutSources = (sources: PayoutSourceUsage[]) =>
  sources.map((source) => ({
    trip_id: source.tripId,
    payment_intent_id: source.paymentIntentId,
    charge_id: source.chargeId,
    amount_cents: source.amountCents,
    available_on: source.availableOn,
    available_on_unix: source.availableOnUnix,
  }))

const resolveSourcesAvailableOn = (sources: PayoutSourceUsage[]) => {
  const timestamps = sources
    .map((source) => Number(source.availableOnUnix || 0))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (timestamps.length === 0) {
    return null
  }

  return unixSecondsToIso(Math.max(...timestamps))
}

const resolvePayoutStatusForSources = (sources: PayoutSourceUsage[]) => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const hasFutureAvailability = sources.some((source) =>
    Number(source.availableOnUnix || 0) > nowSeconds
  )

  return hasFutureAvailability ? "pending" : "processed"
}

const readPayoutSourcesFromMetadata = (metadata: Record<string, unknown>): PayoutSourceUsage[] => {
  const sources = Array.isArray(metadata.sources) ? metadata.sources : []

  return sources
    .map((source) => {
      const sourceRecord = toObjectRecord(source)
      return {
        tripId: toString(sourceRecord.trip_id ?? sourceRecord.tripId),
        paymentIntentId: toString(sourceRecord.payment_intent_id ?? sourceRecord.paymentIntentId),
        chargeId: toString(sourceRecord.charge_id ?? sourceRecord.chargeId),
        amountCents: Math.max(
          0,
          Math.round(toNumber(sourceRecord.amount_cents ?? sourceRecord.amountCents, 0)),
        ),
        availableOn: toString(sourceRecord.available_on ?? sourceRecord.availableOn) || null,
        availableOnUnix: (() => {
          const parsed = toNumber(sourceRecord.available_on_unix ?? sourceRecord.availableOnUnix, 0)
          return parsed > 0 ? Math.round(parsed) : null
        })(),
      }
    })
    .filter((source) => source.tripId && source.paymentIntentId && source.chargeId && source.amountCents > 0)
}

export const resolveDriverPayoutAvailability = async ({
  adminClient,
  stripe,
  driverId,
}: {
  adminClient: ReturnType<typeof createClient>
  stripe: Stripe
  driverId: string
}): Promise<DriverPayoutAvailabilityResult> => {
  const normalizedDriverId = toString(driverId)
  if (!normalizedDriverId) {
    throw new HttpError("driverId is required", 400)
  }

  const driverRow = await fetchDriverRow(adminClient, normalizedDriverId)
  const metadata = toObjectRecord(driverRow.metadata)
  const balanceCents = Math.max(0, toCents(toNumber(metadata.availableBalance, 0)))

  if (balanceCents <= 0) {
    return {
      balanceCents: 0,
      availableNowCents: 0,
      pendingCents: 0,
      pendingUntil: null,
      pendingUntilUnix: null,
      sources: [],
    }
  }

  const openSources = await listUnpaidTripPayoutSources({
    adminClient,
    stripe,
    driverId: normalizedDriverId,
  })
  const nowSeconds = Math.floor(Date.now() / 1000)
  let sourceAvailableCents = 0
  let sourcePendingCents = 0
  const pendingAvailabilityUnix: number[] = []
  const sources: PayoutAvailabilitySource[] = openSources.map((source) => {
    const availableOnUnix = Number(source.availableOnUnix || 0)
    const isAvailable =
      Number.isFinite(availableOnUnix) &&
      availableOnUnix > 0 &&
      availableOnUnix <= nowSeconds

    if (isAvailable) {
      sourceAvailableCents += source.amountCents
    } else {
      sourcePendingCents += source.amountCents
      if (Number.isFinite(availableOnUnix) && availableOnUnix > nowSeconds) {
        pendingAvailabilityUnix.push(Math.round(availableOnUnix))
      }
    }

    return {
      ...source,
      status: isAvailable ? "available" : "pending",
    }
  })

  const availableNowCents = Math.min(balanceCents, Math.max(0, sourceAvailableCents))
  const pendingCents = Math.max(0, balanceCents - availableNowCents)
  const pendingUntilUnix =
    pendingCents > 0 && pendingAvailabilityUnix.length > 0
      ? Math.max(...pendingAvailabilityUnix)
      : null

  return {
    balanceCents,
    availableNowCents,
    pendingCents,
    pendingUntil: pendingUntilUnix ? unixSecondsToIso(pendingUntilUnix) : null,
    pendingUntilUnix,
    sources,
  }
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
    .select("id,driver_id,kind,transfer_id,gross_amount,fee_amount,net_amount,currency,status,metadata")
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
  sources = [],
  status = "processed",
  availableOn = null,
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
  sources?: PayoutSourceUsage[]
  status?: string
  availableOn?: string | null
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
    status,
    availableOn,
    transferGroup: toString(transferGroup) || null,
    kind: mode,
    source: requestedBy || "driver",
    sources: serializePayoutSources(sources),
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
  status: string
  availableOn: string | null
  sourceTransactionUsed: boolean
  deduplicated: boolean
}

const buildFundsPendingMessage = (availability: DriverPayoutAvailabilityResult) => {
  const pendingAmount = toAmount(availability.pendingCents)
  if (availability.pendingUntil) {
    const pendingDate = new Date(availability.pendingUntil)
    const dateLabel = Number.isNaN(pendingDate.getTime())
      ? availability.pendingUntil
      : pendingDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })

    return `No withdrawable funds yet. $${pendingAmount.toFixed(2)} is on Stripe hold until ${dateLabel}.`
  }

  return `No withdrawable funds yet. $${pendingAmount.toFixed(2)} is still on Stripe hold.`
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
      const existingSources = readPayoutSourcesFromMetadata(existingPayoutMetadata)
      const existingStatus = toString(existingPayout.status) || resolvePayoutStatusForSources(existingSources)
      const existingAvailableOn = resolveSourcesAvailableOn(existingSources)
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
        sources: existingSources,
        status: existingStatus,
        availableOn: existingAvailableOn,
      })

      return {
        transferId: existingPayout.transfer_id,
        payoutId: existingPayout.id,
        feeAmount: Number(existingPayout.fee_amount || 0),
        netAmount: Number(existingPayout.net_amount || 0),
        grossAmount: Number(existingPayout.gross_amount || 0),
        currency: normalizeCurrency(existingPayout.currency, "usd"),
        destinationAccountId: existingDestinationAccountId,
        status: existingStatus,
        availableOn: existingAvailableOn,
        sourceTransactionUsed: existingSources.length > 0,
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

    const payoutAvailability = await resolveDriverPayoutAvailability({
      adminClient,
      stripe,
      driverId: normalizedDriverId,
    })
    const withdrawableNowAmount = toAmount(payoutAvailability.availableNowCents)
    if (grossAmount > withdrawableNowAmount) {
      throw new HttpError(
        buildFundsPendingMessage(payoutAvailability),
        409,
        "payout_funds_pending",
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

    const transferPayload = {
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
    }
    let transferSources: PayoutSourceUsage[] = []
    let transfer: Stripe.Transfer

    try {
      transfer = await stripe.transfers.create(
        transferPayload,
        {
          idempotencyKey: normalizedIdempotencyKey,
        },
      )
    } catch (transferError) {
      if (!isStripeInsufficientFundsError(transferError)) {
        throw transferError
      }

      const payoutSource = await findSingleSourceTransactionForPayout({
        adminClient,
        stripe,
        driverId: normalizedDriverId,
        amountCents: transferAmountCents,
      })

      if (!payoutSource) {
        throw transferError
      }

      transferSources = [payoutSource]
      transfer = await stripe.transfers.create(
        {
          ...transferPayload,
          source_transaction: payoutSource.chargeId,
          metadata: {
            ...transferPayload.metadata,
            source_trip_id: payoutSource.tripId,
            source_payment_intent_id: payoutSource.paymentIntentId,
            source_charge_id: payoutSource.chargeId,
          },
        },
        {
          idempotencyKey: `${normalizedIdempotencyKey}:source:${payoutSource.tripId}`,
        },
      )
    }

    const resolvedFeeCentsRaw = await resolveTransferFeeCents(stripe, transfer)
    const actualStripeFeeCents =
      Number.isFinite(resolvedFeeCentsRaw) && resolvedFeeCentsRaw !== null
        ? Math.max(0, Math.round(Number(resolvedFeeCentsRaw)))
        : null

    const netAmountCents = transferAmountCents
    const payoutStatus = resolvePayoutStatusForSources(transferSources)
    const sourceAvailableOn = resolveSourcesAvailableOn(transferSources)

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
      status: payoutStatus,
      requested_by: toString(requestedBy) || null,
      metadata: {
        transfer_group: toString(transferGroup) || null,
        actual_stripe_fee_cents: actualStripeFeeCents,
        source_transaction_used: transferSources.length > 0,
        source_available_on: sourceAvailableOn,
        sources: serializePayoutSources(transferSources),
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
          const dedupedSources = readPayoutSourcesFromMetadata(dedupedMetadata)
          const dedupedStatus = toString(dedupedPayout.status) || resolvePayoutStatusForSources(dedupedSources)
          const dedupedAvailableOn = resolveSourcesAvailableOn(dedupedSources)
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
            sources: dedupedSources,
            status: dedupedStatus,
            availableOn: dedupedAvailableOn,
          })

          return {
            transferId: dedupedPayout.transfer_id,
            payoutId: dedupedPayout.id,
            feeAmount: Number(dedupedPayout.fee_amount || 0),
            netAmount: Number(dedupedPayout.net_amount || 0),
            grossAmount: Number(dedupedPayout.gross_amount || 0),
            currency: normalizeCurrency(dedupedPayout.currency, normalizedCurrency),
            destinationAccountId: connectAccountId,
            status: dedupedStatus,
            availableOn: dedupedAvailableOn,
            sourceTransactionUsed: dedupedSources.length > 0,
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
      sources: transferSources,
      status: payoutStatus,
      availableOn: sourceAvailableOn,
    })

    return {
      transferId: transfer.id,
      payoutId: String(insertedPayout?.id || ""),
      feeAmount: Number(insertedPayout?.fee_amount || toAmount(chargedFeeCents)),
      netAmount: Number(insertedPayout?.net_amount || toAmount(netAmountCents)),
      grossAmount: Number(insertedPayout?.gross_amount || toAmount(grossAmountCents)),
      currency: normalizeCurrency(insertedPayout?.currency, normalizedCurrency),
      destinationAccountId: connectAccountId,
      status: payoutStatus,
      availableOn: sourceAvailableOn,
      sourceTransactionUsed: transferSources.length > 0,
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
