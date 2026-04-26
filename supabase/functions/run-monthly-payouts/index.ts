import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  HttpError,
  buildStripeClient,
  corsHeaders,
  getRequiredEnv,
  jsonResponse,
  mapUnexpectedError,
} from "../_shared/paymentHelpers.ts"
import { processDriverPayout, resolveDriverPayoutAvailability } from "../_shared/payoutHelpers.ts"

const resolveString = (value: unknown) => String(value || "").trim()
const PERIOD_KEY_REGEX = /^\d{4}-\d{2}$/

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const resolveNyClock = (date = new Date()) => {
  const parts = nyFormatter.formatToParts(date)
  const partValue = (type: string) => resolveString(parts.find((part) => part.type === type)?.value)

  return {
    year: partValue("year"),
    month: partValue("month"),
    day: Number(partValue("day")),
    hour: Number(partValue("hour")),
    minute: Number(partValue("minute")),
  }
}

const resolvePeriodKey = (value: unknown) => {
  const candidate = resolveString(value)
  if (PERIOD_KEY_REGEX.test(candidate)) {
    return candidate
  }

  const nyClock = resolveNyClock()
  return `${nyClock.year}-${nyClock.month}`
}

const toObjectRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

const upsertRunStarted = async (
  adminClient: ReturnType<typeof createClient>,
  periodKey: string,
  startedAt: string,
  triggerReason: string,
) => {
  const { data: existingRun, error: existingRunError } = await adminClient
    .from("driver_monthly_payout_runs")
    .select("period_key,status,processed_count,failed_count,summary")
    .eq("period_key", periodKey)
    .maybeSingle()

  if (existingRunError) {
    throw existingRunError
  }

  if (existingRun?.status === "completed") {
    return {
      skipped: true,
      summary: existingRun.summary,
      processedCount: Number(existingRun.processed_count || 0),
      failedCount: Number(existingRun.failed_count || 0),
    }
  }

  const nextSummary = {
    ...(toObjectRecord(existingRun?.summary)),
    triggerReason,
    startedAt,
  }

  const { error: upsertError } = await adminClient
    .from("driver_monthly_payout_runs")
    .upsert({
      period_key: periodKey,
      status: "running",
      started_at: startedAt,
      completed_at: null,
      failed_count: Number(existingRun?.failed_count || 0),
      processed_count: Number(existingRun?.processed_count || 0),
      summary: nextSummary,
      updated_at: startedAt,
    }, {
      onConflict: "period_key",
    })

  if (upsertError) {
    throw upsertError
  }

  return {
    skipped: false,
    summary: nextSummary,
    processedCount: Number(existingRun?.processed_count || 0),
    failedCount: Number(existingRun?.failed_count || 0),
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  try {
    const triggerSecret = getRequiredEnv("MONTHLY_PAYOUT_SECRET")
    const providedSecret = resolveString(req.headers.get("x-monthly-payout-secret"))
    if (!providedSecret || providedSecret !== triggerSecret) {
      throw new HttpError("Unauthorized", 401)
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL")
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const stripe = buildStripeClient()

    const payload = await req.json().catch(() => ({}))
    const periodKey = resolvePeriodKey(payload?.periodKey)
    const triggerReason = resolveString(payload?.triggerReason) || "scheduled"
    const startedAt = new Date().toISOString()

    const runStartState = await upsertRunStarted(adminClient, periodKey, startedAt, triggerReason)
    if (runStartState.skipped) {
      return jsonResponse({
        success: true,
        periodKey,
        skipped: true,
        reason: "run_already_completed",
        processedCount: runStartState.processedCount,
        failedCount: runStartState.failedCount,
        summary: runStartState.summary || {},
      })
    }

    const { data: driverRows, error: driverRowsError } = await adminClient
      .from("drivers")
      .select("id, stripe_account_id, can_receive_payments, metadata")

    if (driverRowsError) {
      throw driverRowsError
    }

    let processedCount = 0
    let failedCount = 0
    let skippedCount = 0
    const failures: Array<Record<string, unknown>> = []

    for (const driverRow of driverRows || []) {
      const driverId = resolveString(driverRow?.id)
      if (!driverId) {
        continue
      }

      const metadata = toObjectRecord(driverRow?.metadata)
      const availableBalance = Number(toNumber(metadata.availableBalance, 0).toFixed(2))
      if (availableBalance <= 0) {
        skippedCount += 1
        continue
      }

      const payoutAvailability = await resolveDriverPayoutAvailability({
        adminClient,
        stripe,
        driverId,
      })
      const withdrawableNow = Number((payoutAvailability.availableNowCents / 100).toFixed(2))
      if (withdrawableNow <= 0) {
        skippedCount += 1
        continue
      }

      const idempotencyKey = `monthly_payout:${periodKey}:${driverId}`
      const transferGroup = `monthly_payout:${periodKey}:${driverId}`

      try {
        const payoutResult = await processDriverPayout({
          adminClient,
          stripe,
          driverId,
          amount: withdrawableNow,
          currency: "usd",
          transferGroup,
          mode: "scheduled",
          idempotencyKey,
          requestedBy: "system_monthly",
          providedConnectAccountId: null,
          periodKey,
        })

        if (payoutResult.transferId) {
          processedCount += 1
        } else {
          skippedCount += 1
        }
      } catch (error) {
        failedCount += 1
        failures.push({
          driverId,
          message: error instanceof Error ? error.message : "Monthly payout failed",
        })
      }
    }

    const completedAt = new Date().toISOString()
    const summary = {
      ...toObjectRecord(runStartState.summary),
      processedCount,
      failedCount,
      skippedCount,
      failures,
      completedAt,
    }

    const finalStatus = failedCount > 0 ? "completed_with_errors" : "completed"
    const { error: runUpdateError } = await adminClient
      .from("driver_monthly_payout_runs")
      .update({
        status: finalStatus,
        processed_count: processedCount,
        failed_count: failedCount,
        summary,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("period_key", periodKey)

    if (runUpdateError) {
      throw runUpdateError
    }

    return jsonResponse({
      success: true,
      periodKey,
      processedCount,
      failedCount,
      skippedCount,
      status: finalStatus,
      failures,
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
