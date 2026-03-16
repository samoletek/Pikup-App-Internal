import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  corsHeaders,
  DRIVER_REQUEST_OFFER_TTL_SECONDS,
  evaluateTripForDriverPreferences,
  isScheduledDispatchTrip,
  isTripOutsideDistanceWindow,
  isTripOutsideScheduledWindow,
  jsonResponse,
  mapTripFromDb,
  MAX_REQUEST_DISTANCE_BY_POOL_MILES,
  mergeDriverPreferences,
  normalizeCoordinates,
  normalizeOfferAction,
  normalizeOfferStatus,
  normalizeRequestPool,
  OFFER_ACTIONS,
  OFFER_STATUSES,
  REQUEST_POOLS,
  resolveDispatchRequirements,
  SCHEDULED_LOOKAHEAD_HOURS,
  SCHEDULED_PAST_GRACE_MINUTES,
  sortTripsForPool,
  toObject,
  type AnyRecord,
} from "./poolUtils.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are missing")
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const dbClient = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : authClient

    let body: AnyRecord = {}
    try {
      body = toObject(await req.json())
    } catch (_error) {
      body = {}
    }

    const requestPool = normalizeRequestPool(body.requestPool)
    const driverLocation = normalizeCoordinates(body.driverLocation)
    const offerAction = normalizeOfferAction(body.action)
    const actionTripId = String(body.tripId || body.requestId || "").trim()

    const { data: driverProfile, error: driverProfileError } = await dbClient
      .from("drivers")
      .select("metadata")
      .eq("id", user.id)
      .maybeSingle()

    if (driverProfileError && driverProfileError.code !== "PGRST116") {
      console.warn("Unable to load driver profile for request filtering:", driverProfileError)
    }
    if (!driverProfile) {
      return jsonResponse({ error: "Driver profile not found" }, 403)
    }

    if (offerAction === OFFER_ACTIONS.DECLINE) {
      if (!actionTripId) {
        return jsonResponse({ error: "tripId is required for decline action" }, 400)
      }

      const { data: existingOffer, error: existingOfferError } = await dbClient
        .from("driver_request_offers")
        .select("status")
        .eq("trip_id", actionTripId)
        .eq("driver_id", user.id)
        .maybeSingle()

      if (existingOfferError && existingOfferError.code !== "PGRST116") {
        throw existingOfferError
      }

      const existingOfferStatus = normalizeOfferStatus(existingOffer?.status)
      if (existingOfferStatus && existingOfferStatus !== OFFER_STATUSES.OFFERED) {
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: existingOfferStatus,
          noOp: true,
          reason: "offer_already_finalized",
        })
      }

      const { data: tripSnapshot, error: tripSnapshotError } = await dbClient
        .from("trips")
        .select("status,driver_id")
        .eq("id", actionTripId)
        .maybeSingle()

      if (tripSnapshotError && tripSnapshotError.code !== "PGRST116") {
        throw tripSnapshotError
      }

      if (!tripSnapshot) {
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: "ignored",
          noOp: true,
          reason: "trip_not_found",
        })
      }

      const normalizedTripStatus = String(tripSnapshot.status || "").trim().toLowerCase()
      if (normalizedTripStatus !== "pending") {
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: "ignored",
          noOp: true,
          reason: "trip_not_pending",
          tripStatus: normalizedTripStatus || null,
        })
      }

      if (tripSnapshot.driver_id && String(tripSnapshot.driver_id) !== String(user.id)) {
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: "ignored",
          noOp: true,
          reason: "trip_assigned_to_other_driver",
        })
      }

      if (!existingOffer) {
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: "ignored",
          noOp: true,
          reason: "offer_not_active",
        })
      }

      const nowIso = new Date().toISOString()
      const { data: updatedOffer, error: updateOfferError } = await dbClient
        .from("driver_request_offers")
        .update({
          request_pool: requestPool,
          status: OFFER_STATUSES.DECLINED,
          responded_at: nowIso,
          response_source: "driver_decline",
          updated_at: nowIso,
        })
        .eq("trip_id", actionTripId)
        .eq("driver_id", user.id)
        .eq("status", OFFER_STATUSES.OFFERED)
        .select("status")
        .maybeSingle()

      if (updateOfferError) {
        throw updateOfferError
      }

      if (!updatedOffer) {
        const { data: latestOffer, error: latestOfferError } = await dbClient
          .from("driver_request_offers")
          .select("status")
          .eq("trip_id", actionTripId)
          .eq("driver_id", user.id)
          .maybeSingle()

        if (latestOfferError && latestOfferError.code !== "PGRST116") {
          throw latestOfferError
        }

        const latestStatus = normalizeOfferStatus(latestOffer?.status) || "ignored"
        return jsonResponse({
          success: true,
          action: OFFER_ACTIONS.DECLINE,
          tripId: actionTripId,
          status: latestStatus,
          noOp: true,
          reason: "offer_status_changed",
        })
      }

      return jsonResponse({
        success: true,
        action: OFFER_ACTIONS.DECLINE,
        tripId: actionTripId,
        status: OFFER_STATUSES.DECLINED,
      })
    }

    const rawPreferences = driverProfile?.metadata?.driverPreferences
    const hasPreferences =
      rawPreferences &&
      typeof rawPreferences === "object" &&
      !Array.isArray(rawPreferences)
    const mergedPreferences = hasPreferences ? mergeDriverPreferences(rawPreferences) : null

    const { data: tripRows, error: tripsError } = await dbClient
      .from("trips")
      .select("*")
      .eq("status", "pending")
      .or(`driver_id.is.null,driver_id.eq.${user.id}`)

    if (tripsError) {
      throw tripsError
    }

    const trips = (tripRows || []).map((row) => mapTripFromDb(row as AnyRecord))
    const hiddenReasonCounts: Record<string, number> = {}
    const filteredTrips: AnyRecord[] = []
    let filteredByPool = 0
    let filteredByDistance = 0
    let filteredByTimeWindow = 0
    let filteredByPreference = 0

    trips.forEach((trip) => {
      const normalizedRequirements = resolveDispatchRequirements(trip)
      const normalizedTrip = {
        ...trip,
        dispatchRequirements: normalizedRequirements,
      }

      if (
        requestPool === REQUEST_POOLS.SCHEDULED &&
        normalizedRequirements.scheduleType !== REQUEST_POOLS.SCHEDULED
      ) {
        filteredByPool += 1
        return
      }
      if (
        requestPool === REQUEST_POOLS.ASAP &&
        normalizedRequirements.scheduleType !== REQUEST_POOLS.ASAP
      ) {
        filteredByPool += 1
        return
      }

      // In Scheduled mode we keep pending scheduled requests visible until they are accepted/cancelled.
      if (
        requestPool !== REQUEST_POOLS.SCHEDULED &&
        isTripOutsideScheduledWindow(normalizedRequirements)
      ) {
        filteredByTimeWindow += 1
        return
      }

      if (
        isTripOutsideDistanceWindow({
          trip: normalizedTrip,
          requirements: normalizedRequirements,
          requestPool,
          driverLocation,
        })
      ) {
        filteredByDistance += 1
        return
      }

      if (!mergedPreferences) {
        filteredTrips.push(normalizedTrip)
        return
      }

      const evaluation = evaluateTripForDriverPreferences(normalizedTrip, mergedPreferences)
      if (evaluation.eligible) {
        filteredTrips.push({
          ...normalizedTrip,
          dispatchRequirements: evaluation.requirements,
        })
        return
      }

      filteredByPreference += 1
      evaluation.hardReasons.forEach((reasonCode) => {
        hiddenReasonCounts[reasonCode] = (hiddenReasonCounts[reasonCode] || 0) + 1
      })
    })

    const filteredTripIds = Array.from(
      new Set(
        filteredTrips
          .map((trip) => String(trip.id || "").trim())
          .filter(Boolean)
      )
    )

    const existingOffersByTripId = new Map<string, AnyRecord>()
    if (filteredTripIds.length > 0) {
      const { data: existingOfferRows, error: existingOfferError } = await dbClient
        .from("driver_request_offers")
        .select("trip_id,status,expires_at,offered_at,responded_at")
        .eq("driver_id", user.id)
        .in("trip_id", filteredTripIds)

      if (existingOfferError) {
        throw existingOfferError
      }

      ;(existingOfferRows || []).forEach((row: AnyRecord) => {
        const tripId = String(row.trip_id || "").trim()
        if (!tripId) return
        existingOffersByTripId.set(tripId, row)
      })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const nowMs = now.getTime()
    const lifecycleFilteredTrips: AnyRecord[] = []
    const tripIdsToExpire: string[] = []
    const newOfferRows: AnyRecord[] = []
    let filteredByOfferDeclined = 0
    let filteredByOfferExpired = 0

    filteredTrips.forEach((trip) => {
      const tripId = String(trip.id || "").trim()
      if (!tripId) return
      const isScheduledTrip = isScheduledDispatchTrip(trip)
      const nextExpiresAt = isScheduledTrip
        ? null
        : new Date(nowMs + DRIVER_REQUEST_OFFER_TTL_SECONDS * 1000).toISOString()

      const existingOffer = existingOffersByTripId.get(tripId)
      if (!existingOffer) {
        newOfferRows.push({
          trip_id: tripId,
          driver_id: user.id,
          request_pool: requestPool,
          status: OFFER_STATUSES.OFFERED,
          offered_at: nowIso,
          expires_at: nextExpiresAt,
          responded_at: null,
          response_source: "pool_fetch",
          updated_at: nowIso,
        })
        lifecycleFilteredTrips.push({
          ...trip,
          dispatchOffer: {
            status: OFFER_STATUSES.OFFERED,
            expiresAt: nextExpiresAt,
            offeredAt: nowIso,
            ttlSeconds: isScheduledTrip ? null : DRIVER_REQUEST_OFFER_TTL_SECONDS,
          },
        })
        return
      }

      const offerStatus = String(existingOffer.status || "").trim().toLowerCase()
      if (offerStatus === OFFER_STATUSES.DECLINED) {
        filteredByOfferDeclined += 1
        return
      }
      if (offerStatus === OFFER_STATUSES.EXPIRED) {
        newOfferRows.push({
          trip_id: tripId,
          driver_id: user.id,
          request_pool: requestPool,
          status: OFFER_STATUSES.OFFERED,
          offered_at: nowIso,
          expires_at: nextExpiresAt,
          responded_at: null,
          response_source: "offer_reissued_after_expired",
          updated_at: nowIso,
        })
        lifecycleFilteredTrips.push({
          ...trip,
          dispatchOffer: {
            status: OFFER_STATUSES.OFFERED,
            offeredAt: nowIso,
            expiresAt: nextExpiresAt,
            ttlSeconds: isScheduledTrip ? null : DRIVER_REQUEST_OFFER_TTL_SECONDS,
          },
        })
        return
      }
      if (offerStatus === OFFER_STATUSES.ACCEPTED) {
        filteredByOfferExpired += 1
        return
      }

      const offerExpiresAt = existingOffer.expires_at
      const offerExpiresAtMs = offerExpiresAt ? new Date(offerExpiresAt).getTime() : Number.NaN
      const hasExpired =
        !isScheduledTrip && Number.isFinite(offerExpiresAtMs) && offerExpiresAtMs <= nowMs

      if (hasExpired) {
        tripIdsToExpire.push(tripId)
        newOfferRows.push({
          trip_id: tripId,
          driver_id: user.id,
          request_pool: requestPool,
          status: OFFER_STATUSES.OFFERED,
          offered_at: nowIso,
          expires_at: nextExpiresAt,
          responded_at: null,
          response_source: "offer_reissued_after_ttl",
          updated_at: nowIso,
        })
        lifecycleFilteredTrips.push({
          ...trip,
          dispatchOffer: {
            status: OFFER_STATUSES.OFFERED,
            offeredAt: nowIso,
            expiresAt: nextExpiresAt,
            ttlSeconds: isScheduledTrip ? null : DRIVER_REQUEST_OFFER_TTL_SECONDS,
          },
        })
        return
      }

      lifecycleFilteredTrips.push({
        ...trip,
        dispatchOffer: {
          status: OFFER_STATUSES.OFFERED,
          offeredAt: existingOffer.offered_at || nowIso,
          expiresAt: isScheduledTrip ? null : offerExpiresAt || nextExpiresAt,
          ttlSeconds: isScheduledTrip ? null : DRIVER_REQUEST_OFFER_TTL_SECONDS,
        },
      })
    })

    if (tripIdsToExpire.length > 0) {
      const { error: expireOffersError } = await dbClient
        .from("driver_request_offers")
        .update({
          status: OFFER_STATUSES.EXPIRED,
          responded_at: nowIso,
          response_source: "offer_ttl_expired",
          updated_at: nowIso,
        })
        .eq("driver_id", user.id)
        .in("trip_id", tripIdsToExpire)
        .eq("status", OFFER_STATUSES.OFFERED)

      if (expireOffersError) {
        throw expireOffersError
      }
    }

    if (newOfferRows.length > 0) {
      const { error: insertOffersError } = await dbClient
        .from("driver_request_offers")
        .upsert(newOfferRows, { onConflict: "trip_id,driver_id" })

      if (insertOffersError) {
        throw insertOffersError
      }
    }

    const sortedTrips = sortTripsForPool(lifecycleFilteredTrips, {
      requestPool,
      driverLocation,
    })

    const customerIds = Array.from(
      new Set(
        sortedTrips
          .map((trip) => String(trip.customerId || trip.customer_id || "").trim())
          .filter(Boolean)
      )
    )

    const customerMap: Record<string, { name: string; email: string | null }> = {}
    if (customerIds.length > 0) {
      const { data: customers, error: customersError } = await dbClient
        .from("customers")
        .select("id, first_name, last_name, email")
        .in("id", customerIds)

      if (customersError) {
        console.warn("Unable to load customer profile info for pool response:", customersError)
      } else {
        ;(customers || []).forEach((customer: AnyRecord) => {
          const customerId = String(customer.id || "")
          if (!customerId) return
          const firstName = String(customer.first_name || "").trim()
          const lastName = String(customer.last_name || "").trim()
          const email = String(customer.email || "").trim()
          customerMap[customerId] = {
            name: [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0] || "Customer",
            email: email || null,
          }
        })
      }
    }

    const requests = sortedTrips.map((trip) => {
      const customer = customerMap[String(trip.customerId || trip.customer_id || "")] || {
        name: "Customer",
        email: null,
      }

      return {
        id: trip.id,
        price: `$${Number(trip.pricing?.total || 0).toFixed(2)}`,
        pricing: trip.pricing || {},
        type: "Moves",
        vehicle: { type: trip.vehicleType || "Standard" },
        pickup: {
          address: trip.pickupAddress || "Unknown",
          coordinates: trip.pickup?.coordinates || null,
          details: trip.pickup?.details || {},
        },
        dropoff: {
          address: trip.dropoffAddress || "",
          coordinates: trip.dropoff?.coordinates || null,
          details: trip.dropoff?.details || {},
        },
        items: trip.items || [],
        item: trip.item || null,
        photos: trip.pickupPhotos || [],
        scheduledTime: trip.scheduledTime || null,
        expiresAt: trip.dispatchOffer?.expiresAt || null,
        dispatchOffer: trip.dispatchOffer || null,
        dispatchRequirements: trip.dispatchRequirements || null,
        customerName: customer.name,
        customerEmail: customer.email,
        originalData: trip,
      }
    })

    return jsonResponse({
      requests,
      meta: {
        requestPool,
        totalPending: trips.length,
        returnedCount: requests.length,
        filteredByPool,
        filteredByDistance,
        filteredByTimeWindow,
        filteredByPreference,
        filteredByOfferDeclined,
        filteredByOfferExpired,
        hiddenReasonCounts,
        dispatchPolicy: {
          asapMaxDistanceMiles: MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP],
          scheduledMaxDistanceMiles: MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.SCHEDULED],
          scheduledLookaheadHours: SCHEDULED_LOOKAHEAD_HOURS,
          scheduledPastGraceMinutes: SCHEDULED_PAST_GRACE_MINUTES,
          requestOfferTtlSeconds: DRIVER_REQUEST_OFFER_TTL_SECONDS,
        },
      },
    })
  } catch (error) {
    console.error("get-driver-request-pool error:", error)
    return jsonResponse(
      {
        error: (error as Error)?.message || "Could not load driver request pool",
      },
      400
    )
  }
})
