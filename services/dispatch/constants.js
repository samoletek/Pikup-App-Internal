export const SMALL_ITEM_MAX_WEIGHT_LBS = 25;
export const MEDIUM_ITEM_MAX_WEIGHT_LBS = 75;
export const LARGE_ITEM_MAX_WEIGHT_LBS = 150;
export const LONG_DISTANCE_THRESHOLD_MILES = 50;
export const SHORT_NOTICE_THRESHOLD_MINUTES = 30;
export const REQUIREMENTS_VERSION = 1;

export const EXTRA_LARGE_ITEM_REGEX = /\b(piano|hot\s*tub|pool\s*table|safe|sectional|refrigerator|fridge|washer|dryer|grand)\b/i;
export const LARGE_ITEM_REGEX = /\b(sofa|couch|mattress|bed|dresser|wardrobe|cabinet|desk|bookshelf|table|appliance|treadmill|elliptical)\b/i;
export const SMALL_ITEM_REGEX = /\b(box|boxes|tote|bag|lamp|chair|stool|nightstand|monitor|printer)\b/i;
export const OUTDOOR_ITEM_REGEX = /\b(outdoor|garden|patio|grill|lawn|yard|planter)\b/i;
export const FRAGILE_ITEM_REGEX = /\b(fragile|glass|mirror|art|artwork|painting|ceramic|porcelain|china)\b/i;
export const TOOL_SET_REQUIRED_REGEX = /\b(disassembl|assembl|bed\s*frame|ikea|shelv|wardrobe|cabinet|desk)\b/i;

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
