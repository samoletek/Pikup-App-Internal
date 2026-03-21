import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import type {
  GetTripParticipantsPublicRequest,
  GetTripParticipantsPublicResponse,
  PublicTripParticipantProfile,
} from "../_shared/contracts.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type AnyRecord = Record<string, unknown>

const toObject = (value: unknown): AnyRecord => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {}
}

const toTrimmedString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim()
  }

  return ""
}

const toNullableString = (value: unknown): string | null => {
  const normalized = toTrimmedString(value)
  return normalized || null
}

const resolveFirstNonEmptyString = (...values: unknown[]): string => {
  for (const value of values) {
    const normalized = toTrimmedString(value)
    if (normalized) {
      return normalized
    }
  }

  return ""
}

const resolveRating = (profile: AnyRecord): number | null => {
  const metadata = toObject(profile.metadata)
  const candidates = [
    profile.rating,
    profile.user_rating,
    profile.customer_rating,
    profile.average_rating,
    profile.avg_rating,
    profile.averageRating,
    profile.avgRating,
    metadata.rating,
    metadata.userRating,
    metadata.customerRating,
    metadata.customer_rating,
    metadata.averageRating,
    metadata.average_rating,
    metadata.avgRating,
    metadata.avg_rating,
  ]

  for (const value of candidates) {
    const parsed = Number(
      typeof value === "string" ? value.replace(",", ".").trim() : value
    )
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(0, Math.min(parsed, 5))
    }
  }

  return null
}

const resolveAvatarUrl = (profile: AnyRecord): string | null => {
  const metadata = toObject(profile.metadata)
  const candidates = [
    profile.profile_image_url,
    profile.profileImageUrl,
    profile.avatar_url,
    profile.avatarUrl,
    profile.photo_url,
    profile.photo,
    metadata.profile_image_url,
    metadata.profileImageUrl,
    metadata.avatar_url,
    metadata.avatarUrl,
    metadata.photo_url,
    metadata.photo,
  ]

  for (const candidate of candidates) {
    const normalized = toTrimmedString(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

const toPublicProfile = (
  profile: AnyRecord | null,
  role: "customer" | "driver"
): PublicTripParticipantProfile | null => {
  if (!profile) {
    return null
  }

  const id = toTrimmedString(profile.id)
  if (!id) {
    return null
  }

  return {
    id,
    role,
    first_name: toTrimmedString(profile.first_name || profile.firstName),
    last_name: toTrimmedString(profile.last_name || profile.lastName),
    email: toNullableString(profile.email),
    profile_image_url: resolveAvatarUrl(profile),
    avatar_url: resolveAvatarUrl(profile),
    rating: resolveRating(profile),
  }
}

const jsonResponse = (
  payload: GetTripParticipantsPublicResponse,
  status = 200
) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

const successErrorPayload = (
  error: string,
  code: string,
  status = 200
) => {
  return jsonResponse({ error, code }, status)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return successErrorPayload("Supabase environment is not configured.", "config_missing", 500)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const body = toObject(await req.json().catch(() => ({})))
    const requestId = toTrimmedString((body as GetTripParticipantsPublicRequest).requestId)
    const targetUserId = toTrimmedString((body as GetTripParticipantsPublicRequest).targetUserId)

    if (!requestId) {
      return successErrorPayload("requestId is required.", "request_id_required")
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: tripRow, error: tripError } = await adminClient
      .from("trips")
      .select("*")
      .eq("id", requestId)
      .maybeSingle()

    if (tripError) {
      throw tripError
    }

    if (!tripRow) {
      return successErrorPayload("Trip not found.", "trip_not_found")
    }

    const customerId = resolveFirstNonEmptyString(
      tripRow.customer_id,
      tripRow.customerId,
      tripRow.user_id,
      tripRow.userId,
      tripRow.requester_id,
      tripRow.requesterId,
    )
    const driverId = resolveFirstNonEmptyString(
      tripRow.driver_id,
      tripRow.driverId,
      tripRow.assigned_driver_id,
      tripRow.assignedDriverId,
    )
    const requesterId = toTrimmedString(user.id)

    const [customerResult, driverResult] = await Promise.all([
      customerId
        ? adminClient
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      driverId
        ? adminClient
            .from("drivers")
            .select("*")
            .eq("id", driverId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (customerResult.error) {
      throw customerResult.error
    }
    if (driverResult.error) {
      throw driverResult.error
    }

    const customer = toPublicProfile(customerResult.data, "customer")
    const driver = toPublicProfile(driverResult.data, "driver")
    const requesterEmail = toTrimmedString(user.email).toLowerCase()
    const isParticipantById = requesterId && (requesterId === customerId || requesterId === driverId)
    const isParticipantByEmail = Boolean(
      requesterEmail &&
      (
        toTrimmedString(customer?.email).toLowerCase() === requesterEmail ||
        toTrimmedString(driver?.email).toLowerCase() === requesterEmail
      )
    )

    if (!isParticipantById && !isParticipantByEmail) {
      return successErrorPayload("Forbidden", "forbidden")
    }

    const profile =
      targetUserId && customer?.id === targetUserId
        ? customer
          : targetUserId && driver?.id === targetUserId
          ? driver
          : null

    return jsonResponse({
      success: true,
      requestId,
      customer,
      driver,
      profile,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return successErrorPayload(message, "internal_error")
  }
})
