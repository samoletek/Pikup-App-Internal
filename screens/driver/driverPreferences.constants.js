import {
  DRIVER_PREFERENCES_DEFAULTS,
  mergeDriverPreferences as mergeStoredDriverPreferences,
} from "../../services/driverPreferencesColumns";

export const DEFAULT_DRIVER_PREFERENCES = DRIVER_PREFERENCES_DEFAULTS;

export const mergeDriverPreferences = (candidate) => (
  mergeStoredDriverPreferences(candidate)
);

export const DRIVER_PREFERENCE_ITEM_META = {
  smallItems: { icon: "cube-outline", desc: "Boxes, bags, small furniture" },
  mediumItems: { icon: "file-tray-stacked-outline", desc: "Desks, chairs, appliances" },
  largeItems: { icon: "resize-outline", desc: "Sofas, mattresses, large tables" },
  extraLargeItems: { icon: "barbell-outline", desc: "Pianos, hot tubs, 150+ lb items" },
  fragileItems: { icon: "wine-outline", desc: "Glass, electronics, artwork" },
  outdoorItems: { icon: "leaf-outline", desc: "Grills, patio sets, planters" },

  dolly: { icon: "cart-outline", desc: "Standard upright dolly" },
  handTruck: { icon: "construct-outline", desc: "Heavy duty, stair-climbing" },
  movingStraps: { icon: "link-outline", desc: "Shoulder/forearm straps" },
  heavyDutyGloves: { icon: "hand-left-outline", desc: "Cut-resistant work gloves" },
  furniturePads: { icon: "layers-outline", desc: "Blankets for scratch protection" },
  toolSet: { icon: "hammer-outline", desc: "Wrench, screwdriver, pliers" },
  rope: { icon: "git-merge-outline", desc: "Tie-downs and bungee cords" },
  tarp: { icon: "umbrella-outline", desc: "Weather protection covering" },

  truckBed: { icon: "car-sport-outline", desc: "Open bed pickup truck" },
  trailer: { icon: "trail-sign-outline", desc: "Attached or available trailer" },
  largeVan: { icon: "bus-outline", desc: "Cargo van or box truck" },
  suvSpace: { icon: "car-outline", desc: "SUV or large hatchback" },
  roofRack: { icon: "arrow-up-outline", desc: "Roof rails with crossbars" },

  weekends: { icon: "calendar-outline", desc: "Saturday and Sunday" },
  evenings: { icon: "moon-outline", desc: "6 PM - 10 PM shifts" },
  shortNotice: { icon: "flash-outline", desc: "Accept requests within 30 min" },
  longDistance: { icon: "navigate-outline", desc: "Hauls over 50 miles one-way" },

  willingToHelp: { icon: "hand-right-outline", desc: "Offer to help other drivers" },
  needsExtraHand: { icon: "person-add-outline", desc: "Request backup for heavy items" },
};

export const DRIVER_MODE_OPTIONS = [
  { value: "solo", label: "Solo", icon: "person-outline" },
  { value: "team", label: "Team", icon: "people-outline" },
  { value: "both", label: "Either", icon: "swap-horizontal-outline" },
];

export const DRIVER_PREFERENCE_TIPS = [
  "Mark only services you can handle safely.",
  "Enabling equipment can increase matching quality.",
  "Keep availability accurate for better request flow.",
];

export const DRIVER_PREFERENCE_SECTIONS = [
  {
    sectionKey: "pickupPreferences",
    title: "Pickup Types",
    subtitle: "Choose items you can safely move.",
    sectionIcon: "cube-outline",
    items: {
      smallItems: "Small Items (under 25 lbs)",
      mediumItems: "Medium Items (25-75 lbs)",
      largeItems: "Large Items (75-150 lbs)",
      extraLargeItems: "Extra Large Items (150+ lbs)",
      fragileItems: "Fragile/Delicate Items",
      outdoorItems: "Outdoor/Garden Items",
    },
  },
  {
    sectionKey: "equipment",
    title: "Equipment",
    subtitle: "Select equipment currently available in your vehicle.",
    sectionIcon: "construct-outline",
    items: {
      dolly: "Dolly/Hand Truck",
      handTruck: "Heavy Duty Hand Truck",
      movingStraps: "Moving Straps",
      heavyDutyGloves: "Heavy Duty Gloves",
      furniturePads: "Furniture Pads/Blankets",
      toolSet: "Basic Tool Set",
      rope: "Rope/Bungee Cords",
      tarp: "Tarp/Protective Covering",
    },
  },
  {
    sectionKey: "vehicleSpecs",
    title: "Vehicle Capabilities",
    subtitle: "Indicate available cargo options.",
    sectionIcon: "car-outline",
    items: {
      truckBed: "Pickup Truck Bed",
      trailer: "Trailer Available",
      largeVan: "Large Van/Box Truck",
      suvSpace: "SUV/Large Cargo Space",
      roofRack: "Roof Rack System",
    },
  },
  {
    sectionKey: "teamPreferences",
    title: "Team / Extra Help",
    subtitle: "Set your default driving mode and help preferences.",
    sectionIcon: "people-outline",
    items: {
      willingToHelp: "Willing to Help Others",
      needsExtraHand: "Request Extra Help on Large Jobs",
    },
    hasModePicker: true,
  },
  {
    sectionKey: "availability",
    title: "Availability",
    subtitle: "Define when you want to receive requests.",
    sectionIcon: "time-outline",
    items: {
      weekends: "Weekend Availability",
      evenings: "Evening Hours (6PM-10PM)",
      shortNotice: "Short Notice Pickups",
      longDistance: "Long Distance Hauls (50+ miles)",
    },
  },
];
