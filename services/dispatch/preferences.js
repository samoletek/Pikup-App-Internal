import { DRIVER_PREFERENCES_DEFAULTS } from './constants';
import { toBoolean, toObject } from './normalizeUtils';

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
