// Driver preferences mapper: converts between nested preference payloads and dedicated drivers table columns.
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const toObject = (value) => (isObject(value) ? value : {});

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
};

export const normalizePreferredMode = (value) => {
  const normalized = String(value || 'solo').trim().toLowerCase();
  if (normalized === 'team') return 'team';
  if (normalized === 'both') return 'both';
  return 'solo';
};

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
  vehicleSpecs: {
    truckBed: false,
    trailer: false,
    largeVan: false,
    suvSpace: true,
    roofRack: false,
  },
  teamPreferences: {
    preferredMode: 'solo',
    willingToHelp: false,
    needsExtraHand: false,
  },
  availability: {
    weekends: true,
    evenings: true,
    shortNotice: false,
    longDistance: false,
  },
});

export const DRIVER_PREFERENCE_COLUMN_LIST = Object.freeze([
  'pref_pickup_small_items',
  'pref_pickup_medium_items',
  'pref_pickup_large_items',
  'pref_pickup_extra_large_items',
  'pref_pickup_fragile_items',
  'pref_pickup_outdoor_items',
  'pref_equipment_dolly',
  'pref_equipment_hand_truck',
  'pref_equipment_moving_straps',
  'pref_equipment_heavy_duty_gloves',
  'pref_equipment_furniture_pads',
  'pref_equipment_tool_set',
  'pref_equipment_rope',
  'pref_equipment_tarp',
  'pref_vehicle_truck_bed',
  'pref_vehicle_trailer',
  'pref_vehicle_large_van',
  'pref_vehicle_suv_space',
  'pref_vehicle_roof_rack',
  'pref_team_willing_to_help',
  'pref_team_needs_extra_hand',
  'pref_mode_solo',
  'pref_mode_team',
  'pref_mode_both',
  'pref_availability_weekends',
  'pref_availability_evenings',
  'pref_availability_short_notice',
  'pref_availability_long_distance',
]);

export const DRIVER_PREFERENCE_SELECT_COLUMNS = [
  'metadata',
  ...DRIVER_PREFERENCE_COLUMN_LIST,
].join(',');

export const mergeDriverPreferences = (candidate = {}) => {
  const source = toObject(candidate);
  const pickupSource = toObject(source.pickupPreferences);
  const equipmentSource = toObject(source.equipment);
  const vehicleSource = toObject(source.vehicleSpecs);
  const teamSource = toObject(source.teamPreferences);
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
      dolly: toBoolean(
        equipmentSource.dolly,
        DRIVER_PREFERENCES_DEFAULTS.equipment.dolly
      ),
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
      toolSet: toBoolean(
        equipmentSource.toolSet,
        DRIVER_PREFERENCES_DEFAULTS.equipment.toolSet
      ),
      rope: toBoolean(
        equipmentSource.rope,
        DRIVER_PREFERENCES_DEFAULTS.equipment.rope
      ),
      tarp: toBoolean(
        equipmentSource.tarp,
        DRIVER_PREFERENCES_DEFAULTS.equipment.tarp
      ),
    },
    vehicleSpecs: {
      truckBed: toBoolean(
        vehicleSource.truckBed,
        DRIVER_PREFERENCES_DEFAULTS.vehicleSpecs.truckBed
      ),
      trailer: toBoolean(
        vehicleSource.trailer,
        DRIVER_PREFERENCES_DEFAULTS.vehicleSpecs.trailer
      ),
      largeVan: toBoolean(
        vehicleSource.largeVan,
        DRIVER_PREFERENCES_DEFAULTS.vehicleSpecs.largeVan
      ),
      suvSpace: toBoolean(
        vehicleSource.suvSpace,
        DRIVER_PREFERENCES_DEFAULTS.vehicleSpecs.suvSpace
      ),
      roofRack: toBoolean(
        vehicleSource.roofRack,
        DRIVER_PREFERENCES_DEFAULTS.vehicleSpecs.roofRack
      ),
    },
    teamPreferences: {
      preferredMode: normalizePreferredMode(
        teamSource.preferredMode,
      ),
      willingToHelp: toBoolean(
        teamSource.willingToHelp,
        DRIVER_PREFERENCES_DEFAULTS.teamPreferences.willingToHelp
      ),
      needsExtraHand: toBoolean(
        teamSource.needsExtraHand,
        DRIVER_PREFERENCES_DEFAULTS.teamPreferences.needsExtraHand
      ),
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

const resolvePreferredModeFromColumns = (source) => {
  if (source.pref_mode_both === true) return 'both';
  if (source.pref_mode_team === true) return 'team';
  return 'solo';
};

const buildPreferencesFromColumns = (source) => mergeDriverPreferences({
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
  vehicleSpecs: {
    truckBed: source.pref_vehicle_truck_bed,
    trailer: source.pref_vehicle_trailer,
    largeVan: source.pref_vehicle_large_van,
    suvSpace: source.pref_vehicle_suv_space,
    roofRack: source.pref_vehicle_roof_rack,
  },
  teamPreferences: {
    preferredMode: resolvePreferredModeFromColumns(source),
    willingToHelp: source.pref_team_willing_to_help,
    needsExtraHand: source.pref_team_needs_extra_hand,
  },
  availability: {
    weekends: source.pref_availability_weekends,
    evenings: source.pref_availability_evenings,
    shortNotice: source.pref_availability_short_notice,
    longDistance: source.pref_availability_long_distance,
  },
});

export const extractDriverPreferencesFromDriverProfile = (driverProfile) => {
  const source = toObject(driverProfile);
  const hasPreferenceColumns = DRIVER_PREFERENCE_COLUMN_LIST.some((columnName) => (
    typeof source[columnName] === 'boolean'
  ));

  if (hasPreferenceColumns) {
    return buildPreferencesFromColumns(source);
  }

  const metadata = toObject(source.metadata);
  const metadataPreferences = toObject(metadata.driverPreferences);
  if (Object.keys(metadataPreferences).length > 0) {
    return mergeDriverPreferences(metadataPreferences);
  }

  return mergeDriverPreferences({});
};

export const buildDriverPreferenceColumnUpdates = (candidate = {}) => {
  const preferences = mergeDriverPreferences(candidate);
  const mode = normalizePreferredMode(preferences.teamPreferences.preferredMode);

  return {
    pref_pickup_small_items: preferences.pickupPreferences.smallItems,
    pref_pickup_medium_items: preferences.pickupPreferences.mediumItems,
    pref_pickup_large_items: preferences.pickupPreferences.largeItems,
    pref_pickup_extra_large_items: preferences.pickupPreferences.extraLargeItems,
    pref_pickup_fragile_items: preferences.pickupPreferences.fragileItems,
    pref_pickup_outdoor_items: preferences.pickupPreferences.outdoorItems,
    pref_equipment_dolly: preferences.equipment.dolly,
    pref_equipment_hand_truck: preferences.equipment.handTruck,
    pref_equipment_moving_straps: preferences.equipment.movingStraps,
    pref_equipment_heavy_duty_gloves: preferences.equipment.heavyDutyGloves,
    pref_equipment_furniture_pads: preferences.equipment.furniturePads,
    pref_equipment_tool_set: preferences.equipment.toolSet,
    pref_equipment_rope: preferences.equipment.rope,
    pref_equipment_tarp: preferences.equipment.tarp,
    pref_vehicle_truck_bed: preferences.vehicleSpecs.truckBed,
    pref_vehicle_trailer: preferences.vehicleSpecs.trailer,
    pref_vehicle_large_van: preferences.vehicleSpecs.largeVan,
    pref_vehicle_suv_space: preferences.vehicleSpecs.suvSpace,
    pref_vehicle_roof_rack: preferences.vehicleSpecs.roofRack,
    pref_team_willing_to_help: preferences.teamPreferences.willingToHelp,
    pref_team_needs_extra_hand: preferences.teamPreferences.needsExtraHand,
    pref_mode_solo: mode === 'solo',
    pref_mode_team: mode === 'team',
    pref_mode_both: mode === 'both',
    pref_availability_weekends: preferences.availability.weekends,
    pref_availability_evenings: preferences.availability.evenings,
    pref_availability_short_notice: preferences.availability.shortNotice,
    pref_availability_long_distance: preferences.availability.longDistance,
  };
};
