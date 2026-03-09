const SMALL_ITEM_MAX_WEIGHT_LBS = 25;
const MEDIUM_ITEM_MAX_WEIGHT_LBS = 75;
const LARGE_ITEM_MAX_WEIGHT_LBS = 150;
const LONG_DISTANCE_THRESHOLD_MILES = 50;
const SHORT_NOTICE_THRESHOLD_MINUTES = 30;
const REQUIREMENTS_VERSION = 1;

const EXTRA_LARGE_ITEM_REGEX = /\b(piano|hot\s*tub|pool\s*table|safe|sectional|refrigerator|fridge|washer|dryer|grand)\b/i;
const LARGE_ITEM_REGEX = /\b(sofa|couch|mattress|bed|dresser|wardrobe|cabinet|desk|bookshelf|table|appliance|treadmill|elliptical)\b/i;
const SMALL_ITEM_REGEX = /\b(box|boxes|tote|bag|lamp|chair|stool|nightstand|monitor|printer)\b/i;
const OUTDOOR_ITEM_REGEX = /\b(outdoor|garden|patio|grill|lawn|yard|planter)\b/i;
const FRAGILE_ITEM_REGEX = /\b(fragile|glass|mirror|art|artwork|painting|ceramic|porcelain|china)\b/i;
const TOOL_SET_REQUIRED_REGEX = /\b(disassembl|assembl|bed\s*frame|ikea|shelv|wardrobe|cabinet|desk)\b/i;

export const DISPATCH_HARD_REASON_CODES = Object.freeze({
  BLOCKED_SMALL_ITEMS: 'blocked_small_items',
  BLOCKED_MEDIUM_ITEMS: 'blocked_medium_items',
  BLOCKED_LARGE_ITEMS: 'blocked_large_items',
  BLOCKED_EXTRA_LARGE_ITEMS: 'blocked_extra_large_items',
  BLOCKED_FRAGILE_ITEMS: 'blocked_fragile_items',
  BLOCKED_OUTDOOR_ITEMS: 'blocked_outdoor_items',
  BLOCKED_MISSING_HEAVY_EQUIPMENT: 'blocked_missing_heavy_equipment',
  BLOCKED_MISSING_FURNITURE_PADS: 'blocked_missing_furniture_pads',
  BLOCKED_MISSING_TOOL_SET: 'blocked_missing_tool_set',
});

export const DISPATCH_SOFT_SIGNAL_CODES = Object.freeze({
  PREFER_SHORT_NOTICE: 'prefer_short_notice',
  AVOID_SHORT_NOTICE: 'avoid_short_notice',
  PREFER_LONG_DISTANCE: 'prefer_long_distance',
  AVOID_LONG_DISTANCE: 'avoid_long_distance',
  TRIP_IS_SCHEDULED: 'trip_is_scheduled',
  TRIP_IS_ASAP: 'trip_is_asap',
});

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
});

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
};

const toArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeItemText = (item) => {
  return [
    item?.name,
    item?.description,
    item?.category,
    item?.type,
  ].filter(Boolean).join(' ');
};

const normalizeWeight = (item) => {
  return toNumber(
    item?.weightEstimate ??
      item?.estimated_weight_lbs ??
      item?.weight ??
      item?.weight_lbs,
    0
  );
};

const getItemSizeKey = (item) => {
  const weight = normalizeWeight(item);
  if (weight > 0) {
    if (weight <= SMALL_ITEM_MAX_WEIGHT_LBS) return 'smallItems';
    if (weight <= MEDIUM_ITEM_MAX_WEIGHT_LBS) return 'mediumItems';
    if (weight <= LARGE_ITEM_MAX_WEIGHT_LBS) return 'largeItems';
    return 'extraLargeItems';
  }

  const text = normalizeItemText(item);
  const category = String(item?.category || '').toLowerCase();

  if (EXTRA_LARGE_ITEM_REGEX.test(text)) return 'extraLargeItems';
  if (LARGE_ITEM_REGEX.test(text)) return 'largeItems';
  if (SMALL_ITEM_REGEX.test(text)) return 'smallItems';
  if (category.includes('boxes') || category.includes('totes')) return 'smallItems';
  if (
    category.includes('furniture') ||
    category.includes('appliance') ||
    category.includes('mattress')
  ) {
    return 'largeItems';
  }

  return 'mediumItems';
};

const isFragileItem = (item) => {
  if (item?.isFragile === true || item?.is_fragile === true) return true;
  return FRAGILE_ITEM_REGEX.test(normalizeItemText(item));
};

const isOutdoorItem = (item) => {
  return OUTDOOR_ITEM_REGEX.test(normalizeItemText(item));
};

const requiresToolSet = (item) => {
  return TOOL_SET_REQUIRED_REGEX.test(normalizeItemText(item));
};

const getTimeDistanceMinutes = (scheduledTime, nowDate = new Date()) => {
  if (!scheduledTime) return null;
  const scheduledDate = new Date(scheduledTime);
  if (Number.isNaN(scheduledDate.getTime())) return null;
  return Math.floor((scheduledDate.getTime() - nowDate.getTime()) / 60000);
};

const getTripItems = (tripLike = {}) => {
  const items = toArray(tripLike.items);
  if (items.length > 0) return items;
  const singleItem = toObject(tripLike.item);
  return Object.keys(singleItem).length > 0 ? [singleItem] : [];
};

const getTripPickupDetails = (tripLike = {}) => {
  return toObject(
    tripLike.pickupDetails ||
      tripLike.pickup?.details ||
      tripLike.pickup_location?.details
  );
};

const getTripDropoffDetails = (tripLike = {}) => {
  return toObject(
    tripLike.dropoffDetails ||
      tripLike.dropoff?.details ||
      tripLike.dropoff_location?.details
  );
};

const resolveScheduleType = (scheduledTime) => {
  return scheduledTime ? 'scheduled' : 'asap';
};

const buildSizeBuckets = (items) => {
  const buckets = {
    smallItems: 0,
    mediumItems: 0,
    largeItems: 0,
    extraLargeItems: 0,
  };

  items.forEach((item) => {
    const key = getItemSizeKey(item);
    buckets[key] += 1;
  });

  return buckets;
};

const getMaxSizeBucket = (sizeBuckets) => {
  if ((sizeBuckets.extraLargeItems || 0) > 0) return 'extraLargeItems';
  if ((sizeBuckets.largeItems || 0) > 0) return 'largeItems';
  if ((sizeBuckets.mediumItems || 0) > 0) return 'mediumItems';
  return 'smallItems';
};

const sumItemWeight = (items) => {
  return items.reduce((total, item) => total + normalizeWeight(item), 0);
};

const inferDispatchRequirements = (tripLike = {}, nowDate = new Date()) => {
  const items = getTripItems(tripLike);
  const pickupDetails = getTripPickupDetails(tripLike);
  const dropoffDetails = getTripDropoffDetails(tripLike);
  const scheduledTime = tripLike.scheduledTime || tripLike.scheduled_time || null;
  const estimatedDistanceMiles = toNumber(
    tripLike?.pricing?.distance ??
      tripLike?.distance ??
      tripLike?.distance_miles,
    0
  );

  const sizeBuckets = buildSizeBuckets(items);
  const hasFragileItems = items.some((item) => isFragileItem(item));
  const hasOutdoorItems = items.some((item) => isOutdoorItem(item));
  const hasAssemblyLikeItems = items.some((item) => requiresToolSet(item));

  const driverHelpRequested =
    pickupDetails.driverHelpsLoading === true ||
    pickupDetails.driverHelp === true ||
    dropoffDetails.driverHelpsUnloading === true ||
    dropoffDetails.driverHelp === true;

  const leadTimeMinutes = getTimeDistanceMinutes(scheduledTime, nowDate);
  const scheduleType = resolveScheduleType(scheduledTime);
  const isShortNotice =
    scheduleType === 'asap' ||
    (typeof leadTimeMinutes === 'number' &&
      leadTimeMinutes >= 0 &&
      leadTimeMinutes <= SHORT_NOTICE_THRESHOLD_MINUTES);
  const isLongDistance = estimatedDistanceMiles >= LONG_DISTANCE_THRESHOLD_MILES;
  const hasLargeOrExtraLargeItems =
    sizeBuckets.largeItems > 0 || sizeBuckets.extraLargeItems > 0;

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
  };
};

const sanitizeDispatchRequirements = (candidate, tripLike = {}, nowDate = new Date()) => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return inferDispatchRequirements(tripLike, nowDate);
  }

  const inferred = inferDispatchRequirements(tripLike, nowDate);
  const sourceItems = toObject(candidate.items);
  const sourceHandling = toObject(candidate.handling);

  const sizeBuckets = {
    smallItems: toNumber(sourceItems?.sizeBuckets?.smallItems, inferred.items.sizeBuckets.smallItems),
    mediumItems: toNumber(sourceItems?.sizeBuckets?.mediumItems, inferred.items.sizeBuckets.mediumItems),
    largeItems: toNumber(sourceItems?.sizeBuckets?.largeItems, inferred.items.sizeBuckets.largeItems),
    extraLargeItems: toNumber(sourceItems?.sizeBuckets?.extraLargeItems, inferred.items.sizeBuckets.extraLargeItems),
  };

  return {
    ...inferred,
    version: toNumber(candidate.version, inferred.version),
    createdAt: candidate.createdAt || inferred.createdAt,
    scheduleType:
      candidate.scheduleType === 'scheduled' || candidate.scheduleType === 'asap'
        ? candidate.scheduleType
        : inferred.scheduleType,
    scheduledTime:
      typeof candidate.scheduledTime === 'string' || candidate.scheduledTime === null
        ? candidate.scheduledTime
        : inferred.scheduledTime,
    leadTimeMinutes:
      typeof candidate.leadTimeMinutes === 'number'
        ? candidate.leadTimeMinutes
        : inferred.leadTimeMinutes,
    isShortNotice: toBoolean(candidate.isShortNotice, inferred.isShortNotice),
    estimatedDistanceMiles: toNumber(candidate.estimatedDistanceMiles, inferred.estimatedDistanceMiles),
    isLongDistance: toBoolean(candidate.isLongDistance, inferred.isLongDistance),
    items: {
      totalCount: toNumber(sourceItems.totalCount, inferred.items.totalCount),
      totalWeightLbs: toNumber(sourceItems.totalWeightLbs, inferred.items.totalWeightLbs),
      maxSizeBucket:
        sourceItems.maxSizeBucket || getMaxSizeBucket(sizeBuckets),
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
  };
};

export const mergeDriverPreferences = (candidate) => {
  const source = toObject(candidate);
  const pickupSource = toObject(source.pickupPreferences);
  const equipmentSource = toObject(source.equipment);
  const availabilitySource = toObject(source.availability);

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
  };
};

export const buildDispatchRequirementsFromRequest = (requestData = {}, nowDate = new Date()) => {
  return inferDispatchRequirements(requestData, nowDate);
};

export const resolveDispatchRequirements = (tripLike = {}, nowDate = new Date()) => {
  const pickupDetails = getTripPickupDetails(tripLike);
  const candidate =
    tripLike.dispatchRequirements ||
    tripLike.dispatch_requirements ||
    tripLike.pickup?.dispatchRequirements ||
    tripLike.pickup_location?.dispatchRequirements ||
    pickupDetails.dispatchRequirements ||
    null;

  return sanitizeDispatchRequirements(candidate, tripLike, nowDate);
};

export const evaluateTripForDriverPreferences = (
  tripLike = {},
  rawPreferences = null,
  nowDate = new Date()
) => {
  const requirements = resolveDispatchRequirements(tripLike, nowDate);
  const preferences = mergeDriverPreferences(rawPreferences);
  const hardReasons = [];
  const softSignals = [];

  if (requirements.items.sizeBuckets.smallItems > 0 && preferences.pickupPreferences.smallItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_SMALL_ITEMS);
  }
  if (requirements.items.sizeBuckets.mediumItems > 0 && preferences.pickupPreferences.mediumItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MEDIUM_ITEMS);
  }
  if (requirements.items.sizeBuckets.largeItems > 0 && preferences.pickupPreferences.largeItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_LARGE_ITEMS);
  }
  if (requirements.items.sizeBuckets.extraLargeItems > 0 && preferences.pickupPreferences.extraLargeItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_EXTRA_LARGE_ITEMS);
  }
  if (requirements.items.hasFragileItems && preferences.pickupPreferences.fragileItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_FRAGILE_ITEMS);
  }
  if (requirements.items.hasOutdoorItems && preferences.pickupPreferences.outdoorItems === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_OUTDOOR_ITEMS);
  }
  if (requirements.handling.requiresHeavyHandlingEquipment) {
    const hasHeavyEquipment =
      preferences.equipment.dolly ||
      preferences.equipment.handTruck ||
      preferences.equipment.movingStraps;
    if (!hasHeavyEquipment || preferences.equipment.heavyDutyGloves === false) {
      hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_HEAVY_EQUIPMENT);
    }
  }
  if (
    requirements.handling.requiresFurniturePads &&
    preferences.equipment.furniturePads === false
  ) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_FURNITURE_PADS);
  }
  if (requirements.handling.requiresToolSet && preferences.equipment.toolSet === false) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MISSING_TOOL_SET);
  }

  if (requirements.scheduleType === 'scheduled') {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.TRIP_IS_SCHEDULED);
  } else {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.TRIP_IS_ASAP);
  }

  if (requirements.isShortNotice && preferences.availability.shortNotice === false) {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.AVOID_SHORT_NOTICE);
  } else if (requirements.isShortNotice && preferences.availability.shortNotice === true) {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.PREFER_SHORT_NOTICE);
  }

  if (requirements.isLongDistance && preferences.availability.longDistance === false) {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.AVOID_LONG_DISTANCE);
  } else if (requirements.isLongDistance && preferences.availability.longDistance === true) {
    softSignals.push(DISPATCH_SOFT_SIGNAL_CODES.PREFER_LONG_DISTANCE);
  }

  return {
    eligible: hardReasons.length === 0,
    hardReasons: Array.from(new Set(hardReasons)),
    softSignals: Array.from(new Set(softSignals)),
    requirements,
    preferences,
  };
};

