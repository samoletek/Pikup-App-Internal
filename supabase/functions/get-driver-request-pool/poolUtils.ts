export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

export const REQUEST_POOLS = Object.freeze({
  ALL: "all",
  ASAP: "asap",
  SCHEDULED: "scheduled",
})

export const DEFAULT_SUPPORTED_ORDER_STATES = Object.freeze(["GA"])

export const readEnvCsv = (names: string[], fallback: string[] = []) => {
  for (const name of names) {
    const raw = Deno.env.get(name)
    if (!raw) continue

    const values = raw
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)

    if (values.length > 0) {
      return values
    }
  }

  return fallback
}

export const SUPPORTED_ORDER_STATE_CODES = readEnvCsv(
  ["SUPPORTED_ORDER_STATE_CODES", "EXPO_PUBLIC_SUPPORTED_ORDER_STATE_CODES"],
  [...DEFAULT_SUPPORTED_ORDER_STATES]
)

export const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ",
  "NEW MEXICO": "NM",
  "NEW YORK": "NY",
  "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI",
  "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  "WEST VIRGINIA": "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC",
}

export const readEnvNumber = (
  names: string[],
  fallback: number,
  { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}
) => {
  for (const name of names) {
    const raw = Deno.env.get(name)
    if (raw == null) continue
    const parsed = Number(raw)
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      return parsed
    }
  }

  return fallback
}

export const MAX_REQUEST_DISTANCE_BY_POOL_MILES = Object.freeze({
  [REQUEST_POOLS.ASAP]: readEnvNumber(
    ["DISPATCH_MAX_DISTANCE_ASAP_MILES", "EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_ASAP_MILES"],
    15,
    { min: 1, max: 500 }
  ),
  [REQUEST_POOLS.SCHEDULED]: readEnvNumber(
    ["DISPATCH_MAX_DISTANCE_SCHEDULED_MILES", "EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES"],
    35,
    { min: 1, max: 1000 }
  ),
  [REQUEST_POOLS.ALL]: readEnvNumber(
    ["DISPATCH_MAX_DISTANCE_SCHEDULED_MILES", "EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES"],
    35,
    { min: 1, max: 1000 }
  ),
})
export const SCHEDULED_LOOKAHEAD_HOURS = readEnvNumber(
  ["DISPATCH_SCHEDULED_LOOKAHEAD_HOURS", "EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS"],
  72,
  { min: 1, max: 24 * 30 }
)
export const SCHEDULED_PAST_GRACE_MINUTES = readEnvNumber(
  ["DISPATCH_SCHEDULED_PAST_GRACE_MINUTES", "EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES"],
  5,
  { min: 0, max: 120 }
)
export const DRIVER_REQUEST_OFFER_TTL_SECONDS = readEnvNumber(
  ["DISPATCH_REQUEST_OFFER_TTL_SECONDS", "EXPO_PUBLIC_DISPATCH_REQUEST_OFFER_TTL_SECONDS"],
  180,
  { min: 10, max: 600 }
)

export const OFFER_ACTIONS = Object.freeze({
  DECLINE: "decline",
})

export const OFFER_STATUSES = Object.freeze({
  OFFERED: "offered",
  DECLINED: "declined",
  EXPIRED: "expired",
  ACCEPTED: "accepted",
})

export const SMALL_ITEM_MAX_WEIGHT_LBS = 25
export const MEDIUM_ITEM_MAX_WEIGHT_LBS = 75
export const LARGE_ITEM_MAX_WEIGHT_LBS = 150
export const LONG_DISTANCE_THRESHOLD_MILES = 50
export const SHORT_NOTICE_THRESHOLD_MINUTES = 30
export const REQUIREMENTS_VERSION = 1

export const EXTRA_LARGE_ITEM_REGEX =
  /\b(piano|hot\s*tub|pool\s*table|safe|sectional|refrigerator|fridge|washer|dryer|grand)\b/i
export const LARGE_ITEM_REGEX =
  /\b(sofa|couch|mattress|bed|dresser|wardrobe|cabinet|desk|bookshelf|table|appliance|treadmill|elliptical)\b/i
export const SMALL_ITEM_REGEX = /\b(box|boxes|tote|bag|lamp|chair|stool|nightstand|monitor|printer)\b/i
export const OUTDOOR_ITEM_REGEX = /\b(outdoor|garden|patio|grill|lawn|yard|planter)\b/i
export const FRAGILE_ITEM_REGEX = /\b(fragile|glass|mirror|art|artwork|painting|ceramic|porcelain|china)\b/i
export const TOOL_SET_REQUIRED_REGEX = /\b(disassembl|assembl|bed\s*frame|ikea|shelv|wardrobe|cabinet|desk)\b/i

export const DISPATCH_HARD_REASON_CODES = Object.freeze({
  BLOCKED_SMALL_ITEMS: "blocked_small_items",
  BLOCKED_MEDIUM_ITEMS: "blocked_medium_items",
  BLOCKED_LARGE_ITEMS: "blocked_large_items",
  BLOCKED_EXTRA_LARGE_ITEMS: "blocked_extra_large_items",
  BLOCKED_FRAGILE_ITEMS: "blocked_fragile_items",
  BLOCKED_OUTDOOR_ITEMS: "blocked_outdoor_items",
  BLOCKED_MISSING_HEAVY_EQUIPMENT: "blocked_missing_heavy_equipment",
  BLOCKED_MISSING_FURNITURE_PADS: "blocked_missing_furniture_pads",
  BLOCKED_MISSING_TOOL_SET: "blocked_missing_tool_set",
})

export const DRIVER_PREFERENCES_DEFAULTS = Object.freeze({
  pickupPreferences: {
    smallItems: true,
    mediumItems: true,
    largeItems: false,
    extraLargeItems: false,
    fragileItems: true,
    outdoorItems: true,
  },
  equipment: {
    dolly: false,
    handTruck: false,
    movingStraps: false,
    heavyDutyGloves: true,
    furniturePads: false,
    toolSet: false,
    rope: true,
    tarp: false,
  },
  availability: {
    weekends: true,
    evenings: true,
    shortNotice: false,
    longDistance: false,
  },
})

export const DRIVER_PREFERENCE_FILTER_COLUMNS = Object.freeze([
  "pref_pickup_small_items",
  "pref_pickup_medium_items",
  "pref_pickup_large_items",
  "pref_pickup_extra_large_items",
  "pref_pickup_fragile_items",
  "pref_pickup_outdoor_items",
  "pref_equipment_dolly",
  "pref_equipment_hand_truck",
  "pref_equipment_moving_straps",
  "pref_equipment_heavy_duty_gloves",
  "pref_equipment_furniture_pads",
  "pref_equipment_tool_set",
  "pref_equipment_rope",
  "pref_equipment_tarp",
  "pref_availability_weekends",
  "pref_availability_evenings",
  "pref_availability_short_notice",
  "pref_availability_long_distance",
])

export const DRIVER_PREFERENCE_FILTER_SELECT_COLUMNS = [
  "metadata",
  ...DRIVER_PREFERENCE_FILTER_COLUMNS,
].join(",")

export type AnyRecord = Record<string, unknown>

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

export const toObject = (value: unknown): AnyRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord
  }
  return {}
}

export const toArray = <T = AnyRecord>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : []
}

export const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value
  return fallback
}

export const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const normalizeRequestPool = (value: unknown): string => {
  const normalized = String(value || REQUEST_POOLS.ALL).trim().toLowerCase()
  if (normalized === REQUEST_POOLS.ASAP) return REQUEST_POOLS.ASAP
  if (normalized === REQUEST_POOLS.SCHEDULED) return REQUEST_POOLS.SCHEDULED
  return REQUEST_POOLS.ALL
}

export const normalizeOfferAction = (value: unknown): string | null => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === OFFER_ACTIONS.DECLINE) return OFFER_ACTIONS.DECLINE
  return null
}

export const normalizeOfferStatus = (value: unknown): string => {
  return String(value || "").trim().toLowerCase()
}

export const normalizeCoordinates = (value: unknown): { latitude: number; longitude: number } | null => {
  const source = toObject(value)
  const latitude = toNumber(source.latitude ?? source.lat, Number.NaN)
  const longitude = toNumber(source.longitude ?? source.lng, Number.NaN)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return { latitude, longitude }
}

export const toLocation = (value: unknown): AnyRecord | null => {
  if (!value) return null
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as AnyRecord
      }
    } catch (_error) {
      return null
    }
  }

  return null
}

export const getAddress = (location: AnyRecord | null, fallback = "") => {
  if (!location) return fallback
  const address = String(location.address || location.formatted_address || "").trim()
  return address || fallback
}

export const normalizeStateCode = (value: unknown): string | null => {
  const raw = String(value || "").trim().toUpperCase()
  if (!raw) return null

  const normalized = raw.startsWith("US-") ? raw.slice(3) : raw
  if (normalized.length !== 2) return null
  return normalized
}

export const extractStateCodeFromAddress = (address: unknown): string | null => {
  const value = String(address || "").trim().toUpperCase()
  if (!value) return null

  const zipMatch = value.match(
    /,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?(?:\s*,?\s*(?:USA|UNITED STATES))?\s*$/
  )
  if (zipMatch?.[1]) {
    return normalizeStateCode(zipMatch[1])
  }

  const stateMatch = value.match(/,\s*([A-Z]{2})(?:\s*,|\s*$)/)
  if (stateMatch?.[1]) {
    return normalizeStateCode(stateMatch[1])
  }

  const stateNameWithZipMatch = value.match(/,\s*([A-Z ]+?)\s+\d{5}(?:-\d{4})?(?:\s*,|\s*$)/)
  if (stateNameWithZipMatch?.[1]) {
    const normalizedStateName = stateNameWithZipMatch[1].replace(/\s+/g, " ").trim()
    const stateFromName = STATE_NAME_TO_CODE[normalizedStateName]
    if (stateFromName) {
      return stateFromName
    }
  }

  return null
}

export const extractStateCodeFromMapboxContext = (context: unknown): string | null => {
  const entries = toArray<AnyRecord>(context)
  const regionEntry = entries.find((entry) => String(entry?.id || "").startsWith("region"))
  if (!regionEntry) return null
  return normalizeStateCode(regionEntry.short_code || regionEntry.text || "")
}

export const resolveLocationStateCode = (location: unknown): string | null => {
  const locationRecord = toObject(location)
  const directState = normalizeStateCode(
    locationRecord.stateCode ||
      locationRecord.state ||
      locationRecord.region ||
      locationRecord.regionCode
  )
  if (directState) return directState

  const contextState = extractStateCodeFromMapboxContext(locationRecord.context)
  if (contextState) return contextState

  return extractStateCodeFromAddress(
    locationRecord.address || locationRecord.formatted_address || locationRecord.formattedAddress || ""
  )
}

export const isSupportedOrderStateCode = (
  stateCode: unknown,
  supportedStateCodes: string[] = SUPPORTED_ORDER_STATE_CODES
): boolean => {
  const normalized = normalizeStateCode(stateCode)
  if (!normalized) return false

  return supportedStateCodes
    .map((code) => normalizeStateCode(code))
    .filter(Boolean)
    .includes(normalized)
}

export const isTripWithinSupportedStates = (
  tripLike: AnyRecord,
  supportedStateCodes: string[] = SUPPORTED_ORDER_STATE_CODES
) => {
  const pickup = toObject(tripLike.pickup || tripLike.pickup_location)
  const dropoff = toObject(tripLike.dropoff || tripLike.dropoff_location)
  const pickupStateCode = resolveLocationStateCode(pickup)
  const dropoffStateCode = resolveLocationStateCode(dropoff)

  if (!pickupStateCode || !dropoffStateCode) {
    return {
      supported: false,
      pickupStateCode,
      dropoffStateCode,
      reason: "state_unresolved",
    }
  }

  const supported =
    isSupportedOrderStateCode(pickupStateCode, supportedStateCodes) &&
    isSupportedOrderStateCode(dropoffStateCode, supportedStateCodes)

  return {
    supported,
    pickupStateCode,
    dropoffStateCode,
    reason: supported ? null : "unsupported_state",
  }
}

export const resolveDriverStateCodeFromProfile = (driverProfile: AnyRecord) => {
  const metadata = toObject(driverProfile.metadata)
  const onboardingDraft = toObject(metadata.onboardingDraft)
  const draftFormData = toObject(onboardingDraft.formData)
  const draftAddress = toObject(draftFormData.address)
  const metadataAddress = toObject(metadata.address)
  const profileAddress = toObject(driverProfile.address)

  return (
    normalizeStateCode(driverProfile.state || driverProfile.state_code) ||
    normalizeStateCode(
      draftAddress.state ||
        metadataAddress.state ||
        profileAddress.state ||
        metadata.state
    ) ||
    null
  )
}

export const mapTripFromDb = (tripRow: AnyRecord): AnyRecord => {
  const pickup = toLocation(tripRow.pickup_location || tripRow.pickup)
  const dropoff = toLocation(tripRow.dropoff_location || tripRow.dropoff)
  const pickupPhotos = toArray(tripRow.pickup_photos || tripRow.pickupPhotos)
  const dropoffPhotos = toArray(tripRow.dropoff_photos || tripRow.dropoffPhotos)
  const pricingSource = toObject(tripRow.pricing || pickup?.pricing)
  const pricing = Object.keys(pricingSource).length > 0
    ? pricingSource
    : {
      total: toNumber(tripRow.price),
      distance: toNumber(tripRow.distance_miles),
    }
  const items = toArray(tripRow.items)
  const dispatchRequirements =
    tripRow.dispatchRequirements ||
    tripRow.dispatch_requirements ||
    pickup?.dispatchRequirements ||
    pickup?.details?.dispatchRequirements ||
    null

  return {
    ...tripRow,
    id: tripRow.id,
    createdAt: tripRow.created_at || tripRow.createdAt || null,
    updatedAt: tripRow.updated_at || tripRow.updatedAt || null,
    pickup,
    dropoff,
    pickupAddress: tripRow.pickupAddress || getAddress(pickup, "Unknown"),
    dropoffAddress: tripRow.dropoffAddress || getAddress(dropoff, ""),
    pickupPhotos,
    dropoffPhotos,
    pricing,
    dispatchRequirements,
    scheduledTime: tripRow.scheduledTime || tripRow.scheduled_time || null,
    items,
    item: tripRow.item || (items.length > 0 ? items[0] : null),
    vehicleType: tripRow.vehicleType || tripRow.vehicle_type || tripRow.vehicle?.type || null,
    vehicle: tripRow.vehicle || { type: tripRow.vehicleType || tripRow.vehicle_type || null },
    customerId: tripRow.customerId || tripRow.customer_id || null,
    customer_id: tripRow.customer_id || tripRow.customerId || null,
    driverId: tripRow.driverId || tripRow.driver_id || null,
    driver_id: tripRow.driver_id || tripRow.driverId || null,
    photos: pickupPhotos,
  }
}

export const normalizeItemText = (item: AnyRecord) =>
  [item?.name, item?.description, item?.category, item?.type].filter(Boolean).join(" ")

export const normalizeWeight = (item: AnyRecord) =>
  toNumber(
    item?.weightEstimate ??
      item?.estimated_weight_lbs ??
      item?.weight ??
      item?.weight_lbs,
    0
  )

export const getItemSizeKey = (item: AnyRecord) => {
  const weight = normalizeWeight(item)
  if (weight > 0) {
    if (weight <= SMALL_ITEM_MAX_WEIGHT_LBS) return "smallItems"
    if (weight <= MEDIUM_ITEM_MAX_WEIGHT_LBS) return "mediumItems"
    if (weight <= LARGE_ITEM_MAX_WEIGHT_LBS) return "largeItems"
    return "extraLargeItems"
  }

  const text = normalizeItemText(item)
  const category = String(item?.category || "").toLowerCase()

  if (EXTRA_LARGE_ITEM_REGEX.test(text)) return "extraLargeItems"
  if (LARGE_ITEM_REGEX.test(text)) return "largeItems"
  if (SMALL_ITEM_REGEX.test(text)) return "smallItems"
  if (category.includes("boxes") || category.includes("totes")) return "smallItems"
  if (
    category.includes("furniture") ||
    category.includes("appliance") ||
    category.includes("mattress")
  ) {
    return "largeItems"
  }

  return "mediumItems"
}

export const isFragileItem = (item: AnyRecord) => {
  if (item?.isFragile === true || item?.is_fragile === true) return true
  return FRAGILE_ITEM_REGEX.test(normalizeItemText(item))
}

export const isOutdoorItem = (item: AnyRecord) => OUTDOOR_ITEM_REGEX.test(normalizeItemText(item))

export const requiresToolSet = (item: AnyRecord) => TOOL_SET_REQUIRED_REGEX.test(normalizeItemText(item))

export const getTimeDistanceMinutes = (scheduledTime: string | null, nowDate = new Date()) => {
  if (!scheduledTime) return null
  const scheduledDate = new Date(scheduledTime)
  if (Number.isNaN(scheduledDate.getTime())) return null
  return Math.floor((scheduledDate.getTime() - nowDate.getTime()) / 60000)
}

export const getTripItems = (tripLike: AnyRecord = {}) => {
  const items = toArray(tripLike.items)
  if (items.length > 0) return items
  const singleItem = toObject(tripLike.item)
  return Object.keys(singleItem).length > 0 ? [singleItem] : []
}

export const getTripPickupDetails = (tripLike: AnyRecord = {}) =>
  toObject(
    tripLike.pickupDetails ||
      tripLike.pickup?.details ||
      tripLike.pickup_location?.details
  )

export const getTripDropoffDetails = (tripLike: AnyRecord = {}) =>
  toObject(
    tripLike.dropoffDetails ||
      tripLike.dropoff?.details ||
      tripLike.dropoff_location?.details
  )

export const resolveScheduleType = (scheduledTime: string | null) =>
  scheduledTime ? REQUEST_POOLS.SCHEDULED : REQUEST_POOLS.ASAP

export const buildSizeBuckets = (items: AnyRecord[]) => {
  const buckets = {
    smallItems: 0,
    mediumItems: 0,
    largeItems: 0,
    extraLargeItems: 0,
  }

  items.forEach((item) => {
    const key = getItemSizeKey(item)
    buckets[key as keyof typeof buckets] += 1
  })

  return buckets
}

export const getMaxSizeBucket = (sizeBuckets: AnyRecord) => {
  if ((sizeBuckets.extraLargeItems || 0) > 0) return "extraLargeItems"
  if ((sizeBuckets.largeItems || 0) > 0) return "largeItems"
  if ((sizeBuckets.mediumItems || 0) > 0) return "mediumItems"
  return "smallItems"
}

export const sumItemWeight = (items: AnyRecord[]) =>
  items.reduce((total, item) => total + normalizeWeight(item), 0)

export const inferDispatchRequirements = (tripLike: AnyRecord = {}, nowDate = new Date()) => {
  const items = getTripItems(tripLike)
  const pickupDetails = getTripPickupDetails(tripLike)
  const dropoffDetails = getTripDropoffDetails(tripLike)
  const scheduledTime = tripLike.scheduledTime || tripLike.scheduled_time || null
  const estimatedDistanceMiles = toNumber(
    tripLike?.pricing?.distance ??
      tripLike?.distance ??
      tripLike?.distance_miles,
    0
  )

  const sizeBuckets = buildSizeBuckets(items)
  const hasFragileItems = items.some((item) => isFragileItem(item))
  const hasOutdoorItems = items.some((item) => isOutdoorItem(item))
  const hasAssemblyLikeItems = items.some((item) => requiresToolSet(item))

  const driverHelpRequested =
    pickupDetails.driverHelpsLoading === true ||
    pickupDetails.driverHelp === true ||
    dropoffDetails.driverHelpsUnloading === true ||
    dropoffDetails.driverHelp === true

  const leadTimeMinutes = getTimeDistanceMinutes(scheduledTime, nowDate)
  const scheduleType = resolveScheduleType(scheduledTime)
  const isShortNotice =
    scheduleType === REQUEST_POOLS.ASAP ||
    (typeof leadTimeMinutes === "number" &&
      leadTimeMinutes >= 0 &&
      leadTimeMinutes <= SHORT_NOTICE_THRESHOLD_MINUTES)
  const isLongDistance = estimatedDistanceMiles >= LONG_DISTANCE_THRESHOLD_MILES
  const hasLargeOrExtraLargeItems =
    sizeBuckets.largeItems > 0 || sizeBuckets.extraLargeItems > 0

  return {
    version: REQUIREMENTS_VERSION,
    createdAt: tripLike.createdAt || tripLike.created_at || new Date().toISOString(),
    scheduleType,
    scheduledTime,
    leadTimeMinutes,
    isShortNotice,
    estimatedDistanceMiles,
    isLongDistance,
    items: {
      totalCount: items.length,
      totalWeightLbs: sumItemWeight(items),
      maxSizeBucket: getMaxSizeBucket(sizeBuckets),
      sizeBuckets,
      hasFragileItems,
      hasOutdoorItems,
      hasAssemblyLikeItems,
    },
    handling: {
      driverHelpRequested,
      requiresHeavyHandlingEquipment: driverHelpRequested && hasLargeOrExtraLargeItems,
      requiresFurniturePads: driverHelpRequested && hasFragileItems,
      requiresToolSet: driverHelpRequested && hasAssemblyLikeItems,
    },
  }
}

export const sanitizeDispatchRequirements = (
  candidate: AnyRecord | null,
  tripLike: AnyRecord = {},
  nowDate = new Date()
) => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return inferDispatchRequirements(tripLike, nowDate)
  }

  const inferred = inferDispatchRequirements(tripLike, nowDate)
  const sourceItems = toObject(candidate.items)
  const sourceHandling = toObject(candidate.handling)

  const sizeBuckets = {
    smallItems: toNumber(sourceItems?.sizeBuckets?.smallItems, inferred.items.sizeBuckets.smallItems),
    mediumItems: toNumber(sourceItems?.sizeBuckets?.mediumItems, inferred.items.sizeBuckets.mediumItems),
    largeItems: toNumber(sourceItems?.sizeBuckets?.largeItems, inferred.items.sizeBuckets.largeItems),
    extraLargeItems: toNumber(sourceItems?.sizeBuckets?.extraLargeItems, inferred.items.sizeBuckets.extraLargeItems),
  }

  return {
    ...inferred,
    version: toNumber(candidate.version, inferred.version),
    createdAt: candidate.createdAt || inferred.createdAt,
    scheduleType:
      candidate.scheduleType === REQUEST_POOLS.SCHEDULED || candidate.scheduleType === REQUEST_POOLS.ASAP
        ? candidate.scheduleType
        : inferred.scheduleType,
    scheduledTime:
      typeof candidate.scheduledTime === "string" || candidate.scheduledTime === null
        ? candidate.scheduledTime
        : inferred.scheduledTime,
    leadTimeMinutes:
      typeof candidate.leadTimeMinutes === "number"
        ? candidate.leadTimeMinutes
        : inferred.leadTimeMinutes,
    isShortNotice: toBoolean(candidate.isShortNotice, inferred.isShortNotice),
    estimatedDistanceMiles: toNumber(candidate.estimatedDistanceMiles, inferred.estimatedDistanceMiles),
    isLongDistance: toBoolean(candidate.isLongDistance, inferred.isLongDistance),
    items: {
      totalCount: toNumber(sourceItems.totalCount, inferred.items.totalCount),
      totalWeightLbs: toNumber(sourceItems.totalWeightLbs, inferred.items.totalWeightLbs),
      maxSizeBucket: sourceItems.maxSizeBucket || getMaxSizeBucket(sizeBuckets),
      sizeBuckets,
      hasFragileItems: toBoolean(sourceItems.hasFragileItems, inferred.items.hasFragileItems),
      hasOutdoorItems: toBoolean(sourceItems.hasOutdoorItems, inferred.items.hasOutdoorItems),
      hasAssemblyLikeItems: toBoolean(
        sourceItems.hasAssemblyLikeItems,
        inferred.items.hasAssemblyLikeItems
      ),
    },
    handling: {
      driverHelpRequested: toBoolean(
        sourceHandling.driverHelpRequested,
        inferred.handling.driverHelpRequested
      ),
      requiresHeavyHandlingEquipment: toBoolean(
        sourceHandling.requiresHeavyHandlingEquipment,
        inferred.handling.requiresHeavyHandlingEquipment
      ),
      requiresFurniturePads: toBoolean(
        sourceHandling.requiresFurniturePads,
        inferred.handling.requiresFurniturePads
      ),
      requiresToolSet: toBoolean(
        sourceHandling.requiresToolSet,
        inferred.handling.requiresToolSet
      ),
    },
  }
}

export const mergeDriverPreferences = (candidate: AnyRecord) => {
  const source = toObject(candidate)
  const pickupSource = toObject(source.pickupPreferences)
  const equipmentSource = toObject(source.equipment)
  const availabilitySource = toObject(source.availability)

  return {
    pickupPreferences: {
      smallItems: toBoolean(
        pickupSource.smallItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.smallItems
      ),
      mediumItems: toBoolean(
        pickupSource.mediumItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.mediumItems
      ),
      largeItems: toBoolean(
        pickupSource.largeItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.largeItems
      ),
      extraLargeItems: toBoolean(
        pickupSource.extraLargeItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.extraLargeItems
      ),
      fragileItems: toBoolean(
        pickupSource.fragileItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.fragileItems
      ),
      outdoorItems: toBoolean(
        pickupSource.outdoorItems,
        DRIVER_PREFERENCES_DEFAULTS.pickupPreferences.outdoorItems
      ),
    },
    equipment: {
      dolly: toBoolean(equipmentSource.dolly, DRIVER_PREFERENCES_DEFAULTS.equipment.dolly),
      handTruck: toBoolean(
        equipmentSource.handTruck,
        DRIVER_PREFERENCES_DEFAULTS.equipment.handTruck
      ),
      movingStraps: toBoolean(
        equipmentSource.movingStraps,
        DRIVER_PREFERENCES_DEFAULTS.equipment.movingStraps
      ),
      heavyDutyGloves: toBoolean(
        equipmentSource.heavyDutyGloves,
        DRIVER_PREFERENCES_DEFAULTS.equipment.heavyDutyGloves
      ),
      furniturePads: toBoolean(
        equipmentSource.furniturePads,
        DRIVER_PREFERENCES_DEFAULTS.equipment.furniturePads
      ),
      toolSet: toBoolean(equipmentSource.toolSet, DRIVER_PREFERENCES_DEFAULTS.equipment.toolSet),
      rope: toBoolean(equipmentSource.rope, DRIVER_PREFERENCES_DEFAULTS.equipment.rope),
      tarp: toBoolean(equipmentSource.tarp, DRIVER_PREFERENCES_DEFAULTS.equipment.tarp),
    },
    availability: {
      weekends: toBoolean(
        availabilitySource.weekends,
        DRIVER_PREFERENCES_DEFAULTS.availability.weekends
      ),
      evenings: toBoolean(
        availabilitySource.evenings,
        DRIVER_PREFERENCES_DEFAULTS.availability.evenings
      ),
      shortNotice: toBoolean(
        availabilitySource.shortNotice,
        DRIVER_PREFERENCES_DEFAULTS.availability.shortNotice
      ),
      longDistance: toBoolean(
        availabilitySource.longDistance,
        DRIVER_PREFERENCES_DEFAULTS.availability.longDistance
      ),
    },
  }
}

export const extractDriverPreferencesFromDriverRow = (driverRow: AnyRecord = {}) => {
  const source = toObject(driverRow)
  const hasColumnPreferences = DRIVER_PREFERENCE_FILTER_COLUMNS.some((columnName) => (
    typeof source[columnName] === "boolean"
  ))

  if (hasColumnPreferences) {
    return mergeDriverPreferences({
      pickupPreferences: {
        smallItems: source.pref_pickup_small_items,
        mediumItems: source.pref_pickup_medium_items,
        largeItems: source.pref_pickup_large_items,
        extraLargeItems: source.pref_pickup_extra_large_items,
        fragileItems: source.pref_pickup_fragile_items,
        outdoorItems: source.pref_pickup_outdoor_items,
      },
      equipment: {
        dolly: source.pref_equipment_dolly,
        handTruck: source.pref_equipment_hand_truck,
        movingStraps: source.pref_equipment_moving_straps,
        heavyDutyGloves: source.pref_equipment_heavy_duty_gloves,
        furniturePads: source.pref_equipment_furniture_pads,
        toolSet: source.pref_equipment_tool_set,
        rope: source.pref_equipment_rope,
        tarp: source.pref_equipment_tarp,
      },
      availability: {
        weekends: source.pref_availability_weekends,
        evenings: source.pref_availability_evenings,
        shortNotice: source.pref_availability_short_notice,
        longDistance: source.pref_availability_long_distance,
      },
    })
  }

  const metadata = toObject(source.metadata)
  const metadataPreferences = toObject(metadata.driverPreferences)
  return mergeDriverPreferences(metadataPreferences)
}

export const resolveDispatchRequirements = (tripLike: AnyRecord = {}, nowDate = new Date()) => {
  const pickupDetails = getTripPickupDetails(tripLike)
  const candidate =
    tripLike.dispatchRequirements ||
    tripLike.dispatch_requirements ||
    tripLike.pickup?.dispatchRequirements ||
    tripLike.pickup_location?.dispatchRequirements ||
    pickupDetails.dispatchRequirements ||
    null

  return sanitizeDispatchRequirements(candidate, tripLike, nowDate)
}

export const evaluateTripForDriverPreferences = (
  tripLike: AnyRecord = {},
  rawPreferences: AnyRecord = {},
  nowDate = new Date()
) => {
  const requirements = resolveDispatchRequirements(tripLike, nowDate)
  const preferences = mergeDriverPreferences(rawPreferences)
  const hardReasons: string[] = []

  if (requirements.items.sizeBuckets.smallItems > 0 && preferences.pickupPreferences.smallItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_SMALL_ITEMS)
  }
  if (requirements.items.sizeBuckets.mediumItems > 0 && preferences.pickupPreferences.mediumItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MEDIUM_ITEMS)
  }
  if (requirements.items.sizeBuckets.largeItems > 0 && preferences.pickupPreferences.largeItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_LARGE_ITEMS)
  }
  if (requirements.items.sizeBuckets.extraLargeItems > 0 && preferences.pickupPreferences.extraLargeItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_EXTRA_LARGE_ITEMS)
  }
  if (requirements.items.hasFragileItems && preferences.pickupPreferences.fragileItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_FRAGILE_ITEMS)
  }
  if (requirements.items.hasOutdoorItems && preferences.pickupPreferences.outdoorItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_OUTDOOR_ITEMS)
  }
  if (requirements.handling.requiresHeavyHandlingEquipment) {
    const hasHeavyEquipment =
      preferences.equipment.dolly ||
      preferences.equipment.handTruck ||
      preferences.equipment.movingStraps
    if (!hasHeavyEquipment || preferences.equipment.heavyDutyGloves === false) {
      hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_HEAVY_EQUIPMENT)
    }
  }
  if (
    requirements.handling.requiresFurniturePads &&
    preferences.equipment.furniturePads === false
  ) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_FURNITURE_PADS)
  }
  if (requirements.handling.requiresToolSet && preferences.equipment.toolSet === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_TOOL_SET)
  }

  return {
    eligible: hardReasons.length === 0,
    hardReasons: Array.from(new Set(hardReasons)),
    requirements,
  }
}

export const toRadians = (value: number) => (value * Math.PI) / 180

export const distanceMilesBetweenPoints = (
  first: { latitude: number; longitude: number } | null,
  second: { latitude: number; longitude: number } | null
) => {
  if (!first || !second) return Number.POSITIVE_INFINITY

  const earthRadiusMiles = 3959
  const dLat = toRadians(second.latitude - first.latitude)
  const dLng = toRadians(second.longitude - first.longitude)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMiles * c
}

export const getPickupCoordinates = (trip: AnyRecord) => {
  return normalizeCoordinates(trip?.pickup?.coordinates)
}

export const toTimestampOrInfinity = (value: unknown) => {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const getPositiveMinutes = (value: unknown): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.round(parsed)
}

export const resolveTripEstimatedDurationMinutes = (trip: AnyRecord = {}) => {
  const requirements = resolveDispatchRequirements(trip)
  const pickupDetails = getTripPickupDetails(trip)
  const dropoffDetails = getTripDropoffDetails(trip)
  const items = getTripItems(trip)
  const distanceMiles = Math.max(
    0,
    toNumber(
      requirements?.estimatedDistanceMiles ??
        trip?.pricing?.distance ??
        trip?.distance ??
        trip?.distance_miles,
      0
    )
  )

  const explicitDurationMinutes =
    getPositiveMinutes(requirements?.estimatedDurationMinutes) ||
    getPositiveMinutes(
      trip?.durationMinutes ??
        trip?.duration_minutes ??
        trip?.duration ??
        pickupDetails?.estimatedDurationMinutes
    )

  if (explicitDurationMinutes) {
    return Math.min(Math.max(explicitDurationMinutes, 30), 240)
  }

  const helpRequested = Boolean(
    pickupDetails?.driverHelpsLoading ||
      pickupDetails?.driverHelp ||
      dropoffDetails?.driverHelpsUnloading ||
      dropoffDetails?.driverHelp
  )
  const itemCount = Math.max(items.length, 1)
  const estimated = Math.round(
    25 + (distanceMiles * 4) + (Math.min(itemCount, 8) * 3) + (helpRequested ? 20 : 0)
  )
  return Math.min(Math.max(estimated, 30), 240)
}

export const resolveTripScheduleWindow = (trip: AnyRecord = {}) => {
  const scheduledTimeRaw = trip?.scheduledTime || trip?.scheduled_time || null
  const scheduledAtMs = Number(new Date(String(scheduledTimeRaw || "")).getTime())
  if (!Number.isFinite(scheduledAtMs)) {
    return null
  }

  const requirements = resolveDispatchRequirements(trip)
  const distanceMiles = Math.max(
    0,
    toNumber(
      requirements?.estimatedDistanceMiles ??
        trip?.pricing?.distance ??
        trip?.distance ??
        trip?.distance_miles,
      0
    )
  )
  const leadMinutes = Math.min(Math.max(Math.round(distanceMiles * 2), 10), 90)
  const durationMinutes = resolveTripEstimatedDurationMinutes(trip)
  const bufferMinutes = 10

  const startMs = scheduledAtMs - ((leadMinutes + bufferMinutes) * 60 * 1000)
  const endMs = scheduledAtMs + ((durationMinutes + bufferMinutes) * 60 * 1000)

  return {
    startMs,
    endMs,
  }
}

export const hasTripScheduleConflict = (
  candidateTrip: AnyRecord,
  acceptedTrips: AnyRecord[] = []
) => {
  const candidateWindow = resolveTripScheduleWindow(candidateTrip)
  if (!candidateWindow) {
    return false
  }

  return acceptedTrips.some((acceptedTrip) => {
    if (!acceptedTrip || String(acceptedTrip.id || "") === String(candidateTrip.id || "")) {
      return false
    }
    const acceptedWindow = resolveTripScheduleWindow(acceptedTrip)
    if (!acceptedWindow) {
      return false
    }

    return candidateWindow.startMs < acceptedWindow.endMs &&
      acceptedWindow.startMs < candidateWindow.endMs
  })
}

export const getRequestDistanceLimitMiles = (requestPool: string, scheduleType: string) => {
  if (requestPool === REQUEST_POOLS.ASAP || requestPool === REQUEST_POOLS.SCHEDULED) {
    return MAX_REQUEST_DISTANCE_BY_POOL_MILES[requestPool as keyof typeof MAX_REQUEST_DISTANCE_BY_POOL_MILES]
  }
  return scheduleType === REQUEST_POOLS.SCHEDULED
    ? MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.SCHEDULED]
    : MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP]
}

export const isTripOutsideScheduledWindow = (requirements: AnyRecord, nowDate = new Date()) => {
  if (requirements?.scheduleType !== REQUEST_POOLS.SCHEDULED) {
    return false
  }

  const scheduledAtMs = toTimestampOrInfinity(requirements?.scheduledTime)
  if (!Number.isFinite(scheduledAtMs)) {
    return false
  }

  const nowMs = nowDate.getTime()
  const minAllowedMs = nowMs - SCHEDULED_PAST_GRACE_MINUTES * 60 * 1000
  const maxAllowedMs = nowMs + SCHEDULED_LOOKAHEAD_HOURS * 60 * 60 * 1000
  return scheduledAtMs < minAllowedMs || scheduledAtMs > maxAllowedMs
}

export const isTripOutsideDistanceWindow = ({
  trip,
  requirements,
  requestPool,
  driverLocation,
}: {
  trip: AnyRecord
  requirements: AnyRecord
  requestPool: string
  driverLocation: { latitude: number; longitude: number } | null
}) => {
  if (!driverLocation) {
    return false
  }

  const pickupCoordinates = getPickupCoordinates(trip)
  const distanceMiles = distanceMilesBetweenPoints(driverLocation, pickupCoordinates)
  if (!Number.isFinite(distanceMiles)) {
    return false
  }

  const maxDistanceMiles = getRequestDistanceLimitMiles(requestPool, requirements?.scheduleType)
  return distanceMiles > maxDistanceMiles
}

export const sortTripsForPool = (
  trips: AnyRecord[],
  {
    requestPool = REQUEST_POOLS.ALL,
    driverLocation = null,
  }: {
    requestPool?: string
    driverLocation?: { latitude: number; longitude: number } | null
  } = {}
) => {
  const normalizedPool = normalizeRequestPool(requestPool)
  const sorted = [...trips]

  if (normalizedPool === REQUEST_POOLS.SCHEDULED) {
    sorted.sort((first, second) => {
      const firstTime = toTimestampOrInfinity(
        first?.dispatchRequirements?.scheduledTime || first?.scheduledTime
      )
      const secondTime = toTimestampOrInfinity(
        second?.dispatchRequirements?.scheduledTime || second?.scheduledTime
      )
      if (firstTime !== secondTime) {
        return firstTime - secondTime
      }

      const firstDistance = distanceMilesBetweenPoints(
        driverLocation,
        getPickupCoordinates(first)
      )
      const secondDistance = distanceMilesBetweenPoints(
        driverLocation,
        getPickupCoordinates(second)
      )
      if (firstDistance !== secondDistance) {
        return firstDistance - secondDistance
      }

      const firstCreatedAt = new Date(first?.createdAt || 0).getTime()
      const secondCreatedAt = new Date(second?.createdAt || 0).getTime()
      return secondCreatedAt - firstCreatedAt
    })

    return sorted
  }

  sorted.sort(
    (first, second) => {
      const firstDistance = distanceMilesBetweenPoints(
        driverLocation,
        getPickupCoordinates(first)
      )
      const secondDistance = distanceMilesBetweenPoints(
        driverLocation,
        getPickupCoordinates(second)
      )
      const firstNormalizedDistance = Number.isFinite(firstDistance)
        ? firstDistance
        : Number.POSITIVE_INFINITY
      const secondNormalizedDistance = Number.isFinite(secondDistance)
        ? secondDistance
        : Number.POSITIVE_INFINITY

      if (firstNormalizedDistance !== secondNormalizedDistance) {
        return firstNormalizedDistance - secondNormalizedDistance
      }

      const firstCreatedAt = new Date(first?.createdAt || 0).getTime()
      const secondCreatedAt = new Date(second?.createdAt || 0).getTime()
      return firstCreatedAt - secondCreatedAt
    }
  )
  return sorted
}

export const isScheduledDispatchTrip = (trip: AnyRecord = {}) => {
  const scheduleType = String(
    trip?.dispatchRequirements?.scheduleType ||
      trip?.dispatch_requirements?.scheduleType ||
      ""
  )
    .trim()
    .toLowerCase()
  return scheduleType === REQUEST_POOLS.SCHEDULED
}
