import {
  DISPATCH_HARD_REASON_CODES,
  DISPATCH_SOFT_SIGNAL_CODES,
} from './constants';
import { mergeDriverPreferences } from './preferences';
import { resolveDispatchRequirements } from './requirements';

export const evaluateTripForDriverPreferences = (
  tripLike = {},
  rawPreferences = null,
  nowDate = new Date()
) => {
  const requirements = resolveDispatchRequirements(tripLike, nowDate);
  const preferences = mergeDriverPreferences(rawPreferences);
  const hardReasons = [];
  const softSignals = [];

  if (
    requirements.items.sizeBuckets.smallItems > 0 &&
    preferences.pickupPreferences.smallItems === false
  ) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_SMALL_ITEMS);
  }
  if (
    requirements.items.sizeBuckets.mediumItems > 0 &&
    preferences.pickupPreferences.mediumItems === false
  ) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_MEDIUM_ITEMS);
  }
  if (
    requirements.items.sizeBuckets.largeItems > 0 &&
    preferences.pickupPreferences.largeItems === false
  ) {
    hardReasons.push(DISPATCH_HARD_REASON_CODES.BLOCKED_LARGE_ITEMS);
  }
  if (
    requirements.items.sizeBuckets.extraLargeItems > 0 &&
    preferences.pickupPreferences.extraLargeItems === false
  ) {
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
