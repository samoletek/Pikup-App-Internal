import {
  distanceMilesBetweenPoints,
  getPickupCoordinates,
  normalizeCoordinates,
  readEnvNumber,
  type AnyRecord,
} from "./poolUtils.ts"

export const DRIVER_SCHEDULE_CONFLICT_DB_STATUSES = Object.freeze([
  "accepted",
  "in_progress",
  "arrived_at_pickup",
  "picked_up",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
])

const OVERLAP_MIN_DURATION_MINUTES = readEnvNumber(
  ["DISPATCH_OVERLAP_MIN_DURATION_MINUTES", "EXPO_PUBLIC_DISPATCH_OVERLAP_MIN_DURATION_MINUTES"],
  25,
  { min: 5, max: 24 * 60 }
)

const OVERLAP_BASE_SERVICE_MINUTES = readEnvNumber(
  ["DISPATCH_OVERLAP_BASE_SERVICE_MINUTES", "EXPO_PUBLIC_DISPATCH_OVERLAP_BASE_SERVICE_MINUTES"],
  15,
  { min: 0, max: 12 * 60 }
)

const OVERLAP_AVERAGE_SPEED_MPH = readEnvNumber(
  ["DISPATCH_OVERLAP_AVERAGE_SPEED_MPH", "EXPO_PUBLIC_DISPATCH_OVERLAP_AVERAGE_SPEED_MPH"],
  22,
  { min: 5, max: 120 }
)

const OVERLAP_INTER_TRIP_BUFFER_MINUTES = readEnvNumber(
  [
    "DISPATCH_OVERLAP_INTER_TRIP_BUFFER_MINUTES",
    "EXPO_PUBLIC_DISPATCH_OVERLAP_INTER_TRIP_BUFFER_MINUTES",
  ],
  10,
  { min: 0, max: 4 * 60 }
)

const DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS = new Set([
  "accepted",
  "in_progress",
  "inprogress",
  "arrived_at_pickup",
  "arrivedatpickup",
  "picked_up",
  "pickedup",
  "en_route_to_dropoff",
  "enroutetodropoff",
  "arrived_at_dropoff",
  "arrivedatdropoff",
])

const toPositiveNumber = (value: unknown): number => {
  const normalizedValue = typeof value === "string" ? value.replace(",", ".").trim() : value
  const directNumber = Number(normalizedValue)
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return directNumber
  }

  if (typeof normalizedValue === "string") {
    const fallbackMatch = normalizedValue.match(/-?\d+(?:\.\d+)?/)
    const fallbackNumber = fallbackMatch?.[0] ? Number(fallbackMatch[0]) : Number.NaN
    if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) {
      return fallbackNumber
    }
  }

  return Number.NaN
}

const normalizeStatusToken = (statusValue: unknown) =>
  String(statusValue || "").trim().toLowerCase()

const isDriverScheduleBlockingStatus = (statusValue: unknown) => {
  const token = normalizeStatusToken(statusValue)
  return (
    DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS.has(token) ||
    DRIVER_SCHEDULE_BLOCKING_STATUS_TOKENS.has(token.replace(/_/g, ""))
  )
}

const resolveTripDistanceMiles = (trip: AnyRecord): number => {
  const candidates = [
    trip?.dispatchRequirements?.estimatedDistanceMiles,
    trip?.dispatch_requirements?.estimatedDistanceMiles,
    trip?.pricing?.distanceMiles,
    trip?.pricing?.distance_miles,
    trip?.pricing?.distance,
    trip?.distance,
    trip?.distance_miles,
  ]

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

const resolveTripDurationMinutes = (trip: AnyRecord): number => {
  const candidates = [
    trip?.dispatchRequirements?.estimatedDurationMinutes,
    trip?.dispatch_requirements?.estimatedDurationMinutes,
    trip?.pricing?.durationMinutes,
    trip?.pricing?.duration_minutes,
    trip?.pricing?.duration,
    trip?.pricing?.timeMinutes,
    trip?.pricing?.time_minutes,
    trip?.pricing?.time,
    trip?.durationMinutes,
    trip?.duration_minutes,
    trip?.duration,
  ]

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return Number.NaN
}

const resolveEstimatedTripDurationMinutes = (trip: AnyRecord): number => {
  const directDurationMinutes = resolveTripDurationMinutes(trip)
  const distanceMiles = resolveTripDistanceMiles(trip)
  const distanceEstimatedMinutes = distanceMiles > 0
    ? (distanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60 + OVERLAP_BASE_SERVICE_MINUTES
    : Number.NaN

  const fallbackDuration = Number.isFinite(distanceEstimatedMinutes)
    ? Math.max(OVERLAP_MIN_DURATION_MINUTES, distanceEstimatedMinutes)
    : OVERLAP_MIN_DURATION_MINUTES

  if (Number.isFinite(directDurationMinutes)) {
    return Math.max(fallbackDuration, directDurationMinutes)
  }

  return fallbackDuration
}

const resolveScheduledStartMs = (trip: AnyRecord): number => {
  const scheduledTime = trip?.dispatchRequirements?.scheduledTime ||
    trip?.dispatch_requirements?.scheduledTime ||
    trip?.scheduledTime ||
    trip?.scheduled_time ||
    null
  const parsed = scheduledTime ? new Date(String(scheduledTime)).getTime() : Number.NaN
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const getDropoffCoordinates = (trip: AnyRecord) => {
  return normalizeCoordinates(trip?.dropoff?.coordinates)
}

const estimateInterTripTransferMinutes = (fromTrip: AnyRecord, toTrip: AnyRecord) => {
  const fromDropoffCoordinates = getDropoffCoordinates(fromTrip)
  const toPickupCoordinates = getPickupCoordinates(toTrip)
  const transferDistanceMiles = distanceMilesBetweenPoints(fromDropoffCoordinates, toPickupCoordinates)

  if (!Number.isFinite(transferDistanceMiles)) {
    return OVERLAP_INTER_TRIP_BUFFER_MINUTES
  }

  const travelMinutes = (transferDistanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60
  return Math.max(OVERLAP_INTER_TRIP_BUFFER_MINUTES, travelMinutes)
}

const resolveTripWindow = ({
  trip,
  nowMs,
  driverLocation,
  isAssignedTrip = false,
}: {
  trip: AnyRecord
  nowMs: number
  driverLocation: { latitude: number; longitude: number } | null
  isAssignedTrip?: boolean
}) => {
  const scheduledStartMs = resolveScheduledStartMs(trip)
  const hasFutureSchedule = Number.isFinite(scheduledStartMs) && scheduledStartMs > nowMs
  const pickupCoordinates = getPickupCoordinates(trip)
  const approachDistanceMiles = distanceMilesBetweenPoints(driverLocation, pickupCoordinates)
  const approachMinutes = Number.isFinite(approachDistanceMiles)
    ? (approachDistanceMiles / OVERLAP_AVERAGE_SPEED_MPH) * 60
    : 0

  let startMs = hasFutureSchedule
    ? scheduledStartMs
    : nowMs + Math.max(0, Math.round(approachMinutes)) * 60 * 1000

  if (isAssignedTrip && isDriverScheduleBlockingStatus(trip?.status)) {
    if (!hasFutureSchedule) {
      startMs = nowMs
    }
  }

  if (!Number.isFinite(startMs)) {
    startMs = nowMs
  }

  const durationMinutes = resolveEstimatedTripDurationMinutes(trip)
  const endMs = startMs + Math.max(OVERLAP_MIN_DURATION_MINUTES, durationMinutes) * 60 * 1000

  return { startMs, endMs }
}

export const findDriverScheduleConflictForTrip = ({
  candidateTrip,
  assignedTrips,
  driverLocation = null,
  nowDate = new Date(),
}: {
  candidateTrip: AnyRecord | null
  assignedTrips: AnyRecord[]
  driverLocation?: { latitude: number; longitude: number } | null
  nowDate?: Date
}): AnyRecord | null => {
  const normalizedAssignedTrips = Array.isArray(assignedTrips) ? assignedTrips : []
  if (!candidateTrip || normalizedAssignedTrips.length === 0) {
    return null
  }

  const nowMs = nowDate.getTime()
  const candidateWindow = resolveTripWindow({
    trip: candidateTrip,
    nowMs,
    driverLocation,
    isAssignedTrip: false,
  })

  return normalizedAssignedTrips.find((assignedTrip) => {
    if (!assignedTrip) {
      return false
    }

    const candidateId = String(candidateTrip?.id || "").trim()
    const assignedId = String(assignedTrip?.id || "").trim()
    if (candidateId && assignedId && candidateId === assignedId) {
      return false
    }

    if (!isDriverScheduleBlockingStatus(assignedTrip?.status)) {
      return false
    }

    const assignedWindow = resolveTripWindow({
      trip: assignedTrip,
      nowMs,
      driverLocation,
      isAssignedTrip: true,
    })

    if (candidateWindow.startMs >= assignedWindow.startMs) {
      const transferMinutes = estimateInterTripTransferMinutes(assignedTrip, candidateTrip)
      return assignedWindow.endMs + transferMinutes * 60 * 1000 > candidateWindow.startMs
    }

    const transferMinutes = estimateInterTripTransferMinutes(candidateTrip, assignedTrip)
    return candidateWindow.endMs + transferMinutes * 60 * 1000 > assignedWindow.startMs
  }) || null
}
