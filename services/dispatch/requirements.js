import {
  EXTRA_LARGE_ITEM_REGEX,
  FRAGILE_ITEM_REGEX,
  LARGE_ITEM_MAX_WEIGHT_LBS,
  LARGE_ITEM_REGEX,
  LONG_DISTANCE_THRESHOLD_MILES,
  MEDIUM_ITEM_MAX_WEIGHT_LBS,
  OUTDOOR_ITEM_REGEX,
  REQUIREMENTS_VERSION,
  SHORT_NOTICE_THRESHOLD_MINUTES,
  SMALL_ITEM_MAX_WEIGHT_LBS,
  SMALL_ITEM_REGEX,
  TOOL_SET_REQUIRED_REGEX,
} from './constants';
import { toArray, toBoolean, toNumber, toObject } from './normalizeUtils';

const normalizeItemText = (item) => {
  return [item?.name, item?.description, item?.category, item?.type]
    .filter(Boolean)
    .join(' ');
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

const clampEstimatedDurationMinutes = (value) => {
  return Math.min(Math.max(Math.round(value), 30), 240);
};

const toPositiveDurationMinutes = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return clampEstimatedDurationMinutes(parsedValue);
};

const resolveEstimatedDurationMinutes = ({
  tripLike = {},
  estimatedDistanceMiles = 0,
  itemCount = 0,
  driverHelpRequested = false,
}) => {
  const explicitDurationMinutes = [
    tripLike?.pricing?.durationMinutes,
    tripLike?.pricing?.duration_minutes,
    tripLike?.pricing?.duration,
    tripLike?.durationMinutes,
    tripLike?.duration_minutes,
    tripLike?.duration,
    tripLike?.pickupDetails?.estimatedDurationMinutes,
    tripLike?.pickup?.details?.estimatedDurationMinutes,
    tripLike?.pickup_location?.details?.estimatedDurationMinutes,
  ]
    .map(toPositiveDurationMinutes)
    .find((value) => value !== null);

  if (explicitDurationMinutes !== undefined) {
    return explicitDurationMinutes;
  }

  return clampEstimatedDurationMinutes(
    25 + Math.ceil(Math.max(estimatedDistanceMiles, 0) * 4) + (Math.min(itemCount, 8) * 3) + (driverHelpRequested ? 20 : 0)
  );
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
  const estimatedDurationMinutes = resolveEstimatedDurationMinutes({
    tripLike,
    estimatedDistanceMiles,
    itemCount: items.length,
    driverHelpRequested,
  });

  return {
    version: REQUIREMENTS_VERSION,
    createdAt: tripLike.createdAt || tripLike.created_at || new Date().toISOString(),
    scheduleType,
    scheduledTime,
    leadTimeMinutes,
    isShortNotice,
    estimatedDistanceMiles,
    estimatedDurationMinutes,
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
    smallItems: toNumber(
      sourceItems?.sizeBuckets?.smallItems,
      inferred.items.sizeBuckets.smallItems
    ),
    mediumItems: toNumber(
      sourceItems?.sizeBuckets?.mediumItems,
      inferred.items.sizeBuckets.mediumItems
    ),
    largeItems: toNumber(
      sourceItems?.sizeBuckets?.largeItems,
      inferred.items.sizeBuckets.largeItems
    ),
    extraLargeItems: toNumber(
      sourceItems?.sizeBuckets?.extraLargeItems,
      inferred.items.sizeBuckets.extraLargeItems
    ),
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
    estimatedDistanceMiles: toNumber(
      candidate.estimatedDistanceMiles,
      inferred.estimatedDistanceMiles
    ),
    estimatedDurationMinutes:
      toPositiveDurationMinutes(candidate.estimatedDurationMinutes) ??
      inferred.estimatedDurationMinutes,
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
      requiresToolSet: toBoolean(sourceHandling.requiresToolSet, inferred.handling.requiresToolSet),
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
