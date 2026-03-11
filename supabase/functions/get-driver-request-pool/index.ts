import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const REQUEST_POOLS = Object.freeze({
  ALL: "all",
  ASAP: "asap",
  SCHEDULED: "scheduled",
})

const readEnvNumber = (
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

const MAX_REQUEST_DISTANCE_BY_POOL_MILES = Object.freeze({
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
const SCHEDULED_LOOKAHEAD_HOURS = readEnvNumber(
  ["DISPATCH_SCHEDULED_LOOKAHEAD_HOURS", "EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS"],
  72,
  { min: 1, max: 24 * 30 }
)
const SCHEDULED_PAST_GRACE_MINUTES = readEnvNumber(
  ["DISPATCH_SCHEDULED_PAST_GRACE_MINUTES", "EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES"],
  5,
  { min: 0, max: 120 }
)

const SMALL_ITEM_MAX_WEIGHT_LBS = 25
const MEDIUM_ITEM_MAX_WEIGHT_LBS = 75
const LARGE_ITEM_MAX_WEIGHT_LBS = 150
const LONG_DISTANCE_THRESHOLD_MILES = 50
const SHORT_NOTICE_THRESHOLD_MINUTES = 30
const REQUIREMENTS_VERSION = 1

const EXTRA_LARGE_ITEM_REGEX =
  /\b(piano|hot\s*tub|pool\s*table|safe|sectional|refrigerator|fridge|washer|dryer|grand)\b/i
const LARGE_ITEM_REGEX =
  /\b(sofa|couch|mattress|bed|dresser|wardrobe|cabinet|desk|bookshelf|table|appliance|treadmill|elliptical)\b/i
const SMALL_ITEM_REGEX = /\b(box|boxes|tote|bag|lamp|chair|stool|nightstand|monitor|printer)\b/i
const OUTDOOR_ITEM_REGEX = /\b(outdoor|garden|patio|grill|lawn|yard|planter)\b/i
const FRAGILE_ITEM_REGEX = /\b(fragile|glass|mirror|art|artwork|painting|ceramic|porcelain|china)\b/i
const TOOL_SET_REQUIRED_REGEX = /\b(disassembl|assembl|bed\s*frame|ikea|shelv|wardrobe|cabinet|desk)\b/i

const DISPATCH_HARD_REASON_CODES = Object.freeze({
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

const DRIVER_PREFERENCES_DEFAULTS = Object.freeze({
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

type AnyRecord = Record<string, any>

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const toObject = (value: unknown): AnyRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord
  }
  return {}
}

const toArray = (value: unknown): any[] => {
  return Array.isArray(value) ? value : []
}

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value
  return fallback
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const round2 = (value: unknown): number => Math.round(toNumber(value, 0) * 100) / 100
const formatMoney = (value: unknown): string => `$${toNumber(value, 0).toFixed(2)}`

const resolveTaxRate = (pricing: AnyRecord = {}, fallback = 0.25): number => {
  const fromTaxRate = toNumber(pricing.taxRate, Number.NaN)
  if (Number.isFinite(fromTaxRate) && fromTaxRate >= 0) {
    return fromTaxRate
  }

  const fromServiceFee = toNumber(pricing.serviceFeePercent, Number.NaN)
  if (Number.isFinite(fromServiceFee) && fromServiceFee >= 0) {
    return fromServiceFee
  }

  return fallback
}

const calculateDriverPayoutFromGrossFare = (params: {
  grossFare: number
  mandatoryInsurance: number
  taxRate: number
  taxAmount?: number
  insuranceSpread?: number
  payoutPercent: number
}): { payout: number; taxAmount: number; tipAmount: number } => {
  const normalizedGrossFare = Math.max(0, toNumber(params.grossFare, 0))
  const normalizedInsurance = Math.max(0, toNumber(params.mandatoryInsurance, 12.99))
  const normalizedTaxRate = Math.max(0, toNumber(params.taxRate, 0.25))
  const explicitTaxAmount = toNumber(params.taxAmount, Number.NaN)
  const normalizedInsuranceSpread = Math.max(0, toNumber(params.insuranceSpread, 0))
  const normalizedTaxAmount = Number.isFinite(explicitTaxAmount)
    ? Math.max(0, explicitTaxAmount)
    : Math.max(
      0,
      ((normalizedGrossFare - normalizedInsurance) * normalizedTaxRate) + normalizedInsuranceSpread
    )
  const normalizedPayoutPercent = Math.max(0, toNumber(params.payoutPercent, 0.75))
  // Ordered flow from finance: total -> minus taxes -> minus insurance -> apply 25% platform cut.
  const afterTaxAmount = Math.max(0, normalizedGrossFare - normalizedTaxAmount)
  const payoutTaxableFare = Math.max(0, afterTaxAmount - normalizedInsurance)
  const payoutBase = payoutTaxableFare * normalizedPayoutPercent
  const payout = payoutBase

  return {
    payout: round2(payout),
    taxAmount: round2(normalizedTaxAmount),
    tipAmount: 0,
  }
}

const deriveDriverPayoutAmount = (
  pricing: AnyRecord = {},
  fallbackCustomerTotal = 0,
  fallbackPayoutPercent = 0.75
): number => {
  const explicitPayout = toNumber(pricing.driverPayout, Number.NaN)

  const payoutPercent = toNumber(pricing.driverPayoutPercent, fallbackPayoutPercent)
  const mandatoryInsurance = toNumber(pricing.mandatoryInsurance, 12.99)
  const taxRate = resolveTaxRate(pricing, 0.25)
  const taxAmount = toNumber(pricing.taxAmount ?? pricing.serviceFee, Number.NaN)
  const insuranceSpread = toNumber(pricing.insuranceSpread, 2)

  const driverGrossFare = toNumber(
    pricing.driverGrossFare ?? pricing.customerTotal ?? pricing.total ?? fallbackCustomerTotal,
    Number.NaN
  )
  if (Number.isFinite(driverGrossFare) && driverGrossFare > 0) {
    return calculateDriverPayoutFromGrossFare({
      grossFare: driverGrossFare,
      mandatoryInsurance,
      taxRate,
      taxAmount,
      insuranceSpread,
      payoutPercent,
    }).payout
  }

  // Legacy fallback: reconstruct customer-side gross from ride fare fields.
  const fareAfterSurge = toNumber(pricing.fareAfterSurge, Number.NaN)
  if (Number.isFinite(fareAfterSurge) && fareAfterSurge > 0) {
    const insuranceSpread = toNumber(pricing.insuranceSpread, 2)
    const serviceFeePercent = toNumber(pricing.serviceFeePercent, 0.25)
    const reconstructedTaxAmount = (fareAfterSurge * serviceFeePercent) + insuranceSpread
    const customerGrossFromFare =
      fareAfterSurge +
      reconstructedTaxAmount +
      mandatoryInsurance

    return calculateDriverPayoutFromGrossFare({
      grossFare: customerGrossFromFare,
      mandatoryInsurance,
      taxRate,
      taxAmount: reconstructedTaxAmount,
      payoutPercent,
    }).payout
  }

  const grossFare = toNumber(pricing.grossFare, Number.NaN)
  const surgeFee = toNumber(pricing.surgeFee, 0)
  if (Number.isFinite(grossFare) && grossFare > 0) {
    const legacyFareAfterSurge = grossFare + surgeFee
    const insuranceSpread = toNumber(pricing.insuranceSpread, 2)
    const serviceFeePercent = toNumber(pricing.serviceFeePercent, 0.25)
    const reconstructedTaxAmount = (legacyFareAfterSurge * serviceFeePercent) + insuranceSpread
    const customerGrossFromLegacy =
      legacyFareAfterSurge +
      reconstructedTaxAmount +
      mandatoryInsurance

    return calculateDriverPayoutFromGrossFare({
      grossFare: customerGrossFromLegacy,
      mandatoryInsurance,
      taxRate,
      taxAmount: reconstructedTaxAmount,
      payoutPercent,
    }).payout
  }

  const customerTotal = toNumber(pricing.customerTotal ?? pricing.total ?? fallbackCustomerTotal, 0)
  if (customerTotal > 0) {
    return calculateDriverPayoutFromGrossFare({
      grossFare: customerTotal,
      mandatoryInsurance,
      taxRate,
      taxAmount,
      insuranceSpread,
      payoutPercent,
    }).payout
  }

  if (Number.isFinite(explicitPayout) && explicitPayout > 0) {
    return round2(explicitPayout)
  }

  return 0
}

const normalizeRequestPool = (value: unknown): string => {
  const normalized = String(value || REQUEST_POOLS.ALL).trim().toLowerCase()
  if (normalized === REQUEST_POOLS.ASAP) return REQUEST_POOLS.ASAP
  if (normalized === REQUEST_POOLS.SCHEDULED) return REQUEST_POOLS.SCHEDULED
  return REQUEST_POOLS.ALL
}

const normalizeCoordinates = (value: unknown): { latitude: number; longitude: number } | null => {
  const source = toObject(value)
  const latitude = toNumber(source.latitude ?? source.lat, Number.NaN)
  const longitude = toNumber(source.longitude ?? source.lng, Number.NaN)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return { latitude, longitude }
}

const toLocation = (value: unknown): AnyRecord | null => {
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

const getAddress = (location: AnyRecord | null, fallback = "") => {
  if (!location) return fallback
  const address = String(location.address || location.formatted_address || "").trim()
  return address || fallback
}

const mapTripFromDb = (tripRow: AnyRecord): AnyRecord => {
  const pickup = toLocation(tripRow.pickup_location || tripRow.pickup)
  const dropoff = toLocation(tripRow.dropoff_location || tripRow.dropoff)
  const pickupPhotos = toArray(tripRow.pickup_photos || tripRow.pickupPhotos)
  const dropoffPhotos = toArray(tripRow.dropoff_photos || tripRow.dropoffPhotos)
  const pricingSource = toObject(tripRow.pricing || pickup?.pricing)
  const fallbackPricing = {
    total: toNumber(tripRow.price),
    distance: toNumber(tripRow.distance_miles),
  }
  const customerTotal = toNumber(
    pricingSource.customerTotal ?? pricingSource.total ?? fallbackPricing.total,
    0
  )
  const pricing = {
    ...fallbackPricing,
    ...pricingSource,
    total: customerTotal,
    customerTotal,
    driverGrossFare: customerTotal,
    driverPayout: deriveDriverPayoutAmount(pricingSource, customerTotal),
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

const normalizeItemText = (item: AnyRecord) =>
  [item?.name, item?.description, item?.category, item?.type].filter(Boolean).join(" ")

const normalizeWeight = (item: AnyRecord) =>
  toNumber(
    item?.weightEstimate ??
      item?.estimated_weight_lbs ??
      item?.weight ??
      item?.weight_lbs,
    0
  )

const getItemSizeKey = (item: AnyRecord) => {
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

const isFragileItem = (item: AnyRecord) => {
  if (item?.isFragile === true || item?.is_fragile === true) return true
  return FRAGILE_ITEM_REGEX.test(normalizeItemText(item))
}

const isOutdoorItem = (item: AnyRecord) => OUTDOOR_ITEM_REGEX.test(normalizeItemText(item))

const requiresToolSet = (item: AnyRecord) => TOOL_SET_REQUIRED_REGEX.test(normalizeItemText(item))

const getTimeDistanceMinutes = (scheduledTime: string | null, nowDate = new Date()) => {
  if (!scheduledTime) return null
  const scheduledDate = new Date(scheduledTime)
  if (Number.isNaN(scheduledDate.getTime())) return null
  return Math.floor((scheduledDate.getTime() - nowDate.getTime()) / 60000)
}

const getTripItems = (tripLike: AnyRecord = {}) => {
  const items = toArray(tripLike.items)
  if (items.length > 0) return items
  const singleItem = toObject(tripLike.item)
  return Object.keys(singleItem).length > 0 ? [singleItem] : []
}

const getTripPickupDetails = (tripLike: AnyRecord = {}) =>
  toObject(
    tripLike.pickupDetails ||
      tripLike.pickup?.details ||
      tripLike.pickup_location?.details
  )

const getTripDropoffDetails = (tripLike: AnyRecord = {}) =>
  toObject(
    tripLike.dropoffDetails ||
      tripLike.dropoff?.details ||
      tripLike.dropoff_location?.details
  )

const resolveScheduleType = (scheduledTime: string | null) =>
  scheduledTime ? REQUEST_POOLS.SCHEDULED : REQUEST_POOLS.ASAP

const buildSizeBuckets = (items: AnyRecord[]) => {
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

const getMaxSizeBucket = (sizeBuckets: AnyRecord) => {
  if ((sizeBuckets.extraLargeItems || 0) > 0) return "extraLargeItems"
  if ((sizeBuckets.largeItems || 0) > 0) return "largeItems"
  if ((sizeBuckets.mediumItems || 0) > 0) return "mediumItems"
  return "smallItems"
}

const sumItemWeight = (items: AnyRecord[]) =>
  items.reduce((total, item) => total + normalizeWeight(item), 0)

const inferDispatchRequirements = (tripLike: AnyRecord = {}, nowDate = new Date()) => {
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

const sanitizeDispatchRequirements = (
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

const mergeDriverPreferences = (candidate: AnyRecord) => {
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

const resolveDispatchRequirements = (tripLike: AnyRecord = {}, nowDate = new Date()) => {
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

const evaluateTripForDriverPreferences = (
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

const toRadians = (value: number) => (value * Math.PI) / 180

const distanceMilesBetweenPoints = (
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

const getPickupCoordinates = (trip: AnyRecord) => {
  return normalizeCoordinates(trip?.pickup?.coordinates)
}

const toTimestampOrInfinity = (value: unknown) => {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const getRequestDistanceLimitMiles = (requestPool: string, scheduleType: string) => {
  if (requestPool === REQUEST_POOLS.ASAP || requestPool === REQUEST_POOLS.SCHEDULED) {
    return MAX_REQUEST_DISTANCE_BY_POOL_MILES[requestPool as keyof typeof MAX_REQUEST_DISTANCE_BY_POOL_MILES]
  }
  return scheduleType === REQUEST_POOLS.SCHEDULED
    ? MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.SCHEDULED]
    : MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP]
}

const isTripOutsideScheduledWindow = (requirements: AnyRecord, nowDate = new Date()) => {
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

const isTripOutsideDistanceWindow = ({
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

const sortTripsForPool = (
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

      if (isTripOutsideScheduledWindow(normalizedRequirements)) {
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

    const sortedTrips = sortTripsForPool(filteredTrips, {
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
      const customerTotal = toNumber(trip?.pricing?.customerTotal ?? trip?.pricing?.total, 0)
      const driverPayoutAmount = deriveDriverPayoutAmount(trip?.pricing || {}, customerTotal)
      const driverPayoutLabel = formatMoney(driverPayoutAmount)

      return {
        id: trip.id,
        price: driverPayoutLabel,
        driverPayout: driverPayoutLabel,
        customerPrice: formatMoney(customerTotal),
        pricing: {
          ...(trip.pricing || {}),
          total: round2(customerTotal),
          customerTotal: round2(customerTotal),
          driverGrossFare: round2(customerTotal),
          driverPayout: round2(driverPayoutAmount),
        },
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
        hiddenReasonCounts,
        dispatchPolicy: {
          asapMaxDistanceMiles: MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.ASAP],
          scheduledMaxDistanceMiles: MAX_REQUEST_DISTANCE_BY_POOL_MILES[REQUEST_POOLS.SCHEDULED],
          scheduledLookaheadHours: SCHEDULED_LOOKAHEAD_HOURS,
          scheduledPastGraceMinutes: SCHEDULED_PAST_GRACE_MINUTES,
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
