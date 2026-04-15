// TODO(before production): Remove temporary Bali region whitelist used for internal testing.
const TEMP_INTERNAL_SUPPORTED_REGION_CODES = Object.freeze(["ID-BA"]);
// TODO(before production): Remove temporary Indonesia support used for internal Bali testing.
const TEMP_INTERNAL_SUPPORTED_COUNTRY_CODES = Object.freeze(["id"]);

export const SUPPORTED_ORDER_STATE_CODES = Object.freeze([
  "GA",
  ...TEMP_INTERNAL_SUPPORTED_REGION_CODES,
]);
export const SUPPORTED_ORDER_COUNTRY_CODES = Object.freeze([
  "us",
  ...TEMP_INTERNAL_SUPPORTED_COUNTRY_CODES,
]);
export const SUPPORTED_ORDER_COUNTRY_QUERY = SUPPORTED_ORDER_COUNTRY_CODES.join(",");

export const COMING_SOON_UNSUPPORTED_STATE_MESSAGE =
  "Pikup is currently available only in Georgia, USA. We are expanding to new areas soon.";

export const SERVICE_AREA_UNRESOLVED_MESSAGE =
  "Pikup is currently available only in Georgia, USA. We could not verify your current state yet. If you are in Georgia, enable Precise Location and try again.";

export const CUSTOMER_LOCATION_REQUIRED_MESSAGE =
  "Location access is required to check service availability in your area.";

export const DRIVER_AVAILABILITY_COMING_SOON_TITLE = "Coming Soon";

export const DRIVER_AVAILABILITY_COMING_SOON_MESSAGE =
  "Driver mode is currently available only in Georgia, USA.";
