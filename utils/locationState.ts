import { SUPPORTED_ORDER_STATE_CODES } from "../constants/orderAvailability";

type AnyRecord = Record<string, unknown>;

const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

// TODO(before production): Remove temporary Bali normalization used for internal testing.
const TEMP_INTERNAL_REGION_ALIASES: Record<string, string> = {
  "ID-BA": "ID-BA",
  BA: "ID-BA",
  BALI: "ID-BA",
};

const STATE_NAME_TO_CODE: Record<string, string> = {
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
};

const toRecord = (value: unknown): AnyRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AnyRecord;
  }
  return {};
};

export const normalizeStateCode = (value: unknown): string | null => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return null;
  }

  const normalizedAlias = TEMP_INTERNAL_REGION_ALIASES[raw];
  if (normalizedAlias) {
    return normalizedAlias;
  }

  const normalized = raw.startsWith("US-") ? raw.slice(3) : raw;

  const normalizedCodeAlias = TEMP_INTERNAL_REGION_ALIASES[normalized];
  if (normalizedCodeAlias) {
    return normalizedCodeAlias;
  }

  if (!normalized || normalized.length !== 2) {
    return null;
  }

  return US_STATE_CODES.has(normalized) ? normalized : null;
};

export const isSupportedOrderStateCode = (
  stateCode: unknown,
  supportedStateCodes: readonly string[] = SUPPORTED_ORDER_STATE_CODES
): boolean => {
  const normalized = normalizeStateCode(stateCode);
  if (!normalized) {
    return false;
  }

  const supportedSet = new Set(
    supportedStateCodes
      .map((code) => normalizeStateCode(code))
      .filter(Boolean) as string[]
  );

  return supportedSet.has(normalized);
};

export const extractStateCodeFromMapboxContext = (context: unknown): string | null => {
  if (!Array.isArray(context)) {
    return null;
  }

  const regionEntry = context.find((entry) => {
    const record = toRecord(entry);
    const id = String(record.id || "");
    return id.startsWith("region");
  });

  if (!regionEntry) {
    return null;
  }

  const regionRecord = toRecord(regionEntry);
  return normalizeStateCode(regionRecord.short_code || regionRecord.text || null);
};

export const extractStateCodeFromAddress = (address: unknown): string | null => {
  const text = String(address || "").trim();
  if (!text) {
    return null;
  }

  const upper = text.toUpperCase();

  if (upper.includes("BALI")) {
    // TODO(before production): Remove temporary Bali matching used for internal testing.
    return "ID-BA";
  }

  const usZipPattern = /,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?(?:\s*,?\s*(?:USA|UNITED STATES))?\s*$/;
  const zipMatch = upper.match(usZipPattern);
  if (zipMatch?.[1]) {
    return normalizeStateCode(zipMatch[1]);
  }

  const stateTokenPattern = /,\s*([A-Z]{2})(?:\s*,|\s*$)/;
  const stateTokenMatch = upper.match(stateTokenPattern);
  if (stateTokenMatch?.[1]) {
    return normalizeStateCode(stateTokenMatch[1]);
  }

  const stateNameWithZipMatch = upper.match(
    /,\s*([A-Z ]+?)\s+\d{5}(?:-\d{4})?(?:\s*,|\s*$)/
  );
  if (stateNameWithZipMatch?.[1]) {
    const normalizedStateName = stateNameWithZipMatch[1].replace(/\s+/g, " ").trim();
    const stateFromName = STATE_NAME_TO_CODE[normalizedStateName];
    if (stateFromName) {
      return stateFromName;
    }
  }

  return null;
};

export const resolveLocationStateCode = (location: unknown): string | null => {
  const locationRecord = toRecord(location);
  const directState = normalizeStateCode(
    locationRecord.stateCode ||
      locationRecord.state ||
      locationRecord.region ||
      locationRecord.regionCode
  );
  if (directState) {
    return directState;
  }

  const contextState = extractStateCodeFromMapboxContext(locationRecord.context);
  if (contextState) {
    return contextState;
  }

  return extractStateCodeFromAddress(
    locationRecord.address || locationRecord.formatted_address || locationRecord.formattedAddress || ""
  );
};

export const evaluateOrderStateCoverage = ({
  pickup,
  dropoff,
  supportedStateCodes = SUPPORTED_ORDER_STATE_CODES,
  requireResolvedState = true,
}: {
  pickup: unknown;
  dropoff: unknown;
  supportedStateCodes?: readonly string[];
  requireResolvedState?: boolean;
}) => {
  const pickupStateCode = resolveLocationStateCode(pickup);
  const dropoffStateCode = resolveLocationStateCode(dropoff);

  if (requireResolvedState && (!pickupStateCode || !dropoffStateCode)) {
    return {
      isSupported: false,
      reason: "state_unresolved" as const,
      pickupStateCode,
      dropoffStateCode,
    };
  }

  if (
    (pickupStateCode && !isSupportedOrderStateCode(pickupStateCode, supportedStateCodes)) ||
    (dropoffStateCode && !isSupportedOrderStateCode(dropoffStateCode, supportedStateCodes))
  ) {
    return {
      isSupported: false,
      reason: "unsupported_state" as const,
      pickupStateCode,
      dropoffStateCode,
    };
  }

  return {
    isSupported: true,
    reason: null,
    pickupStateCode,
    dropoffStateCode,
  };
};

export const resolveDriverStateCodeFromProfile = (driverProfile: unknown): string | null => {
  const profile = toRecord(driverProfile);
  const metadata = toRecord(profile.metadata);
  const onboardingDraft = toRecord(metadata.onboardingDraft);
  const draftFormData = toRecord(onboardingDraft.formData);
  const draftAddress = toRecord(draftFormData.address);
  const metadataAddress = toRecord(metadata.address);
  const profileAddress = toRecord(profile.address);

  const directState = normalizeStateCode(profile.state || profile.state_code);
  if (directState) {
    return directState;
  }

  return (
    normalizeStateCode(
      draftAddress.state ||
        metadataAddress.state ||
        profileAddress.state ||
        metadata.state
    ) || null
  );
};

export const isTripWithinSupportedStates = (
  trip: unknown,
  supportedStateCodes: readonly string[] = SUPPORTED_ORDER_STATE_CODES
): boolean => {
  const tripRecord = toRecord(trip);
  const pickup = toRecord(tripRecord.pickup);
  const dropoff = toRecord(tripRecord.dropoff);
  const pickupStateCode = resolveLocationStateCode(pickup);
  const dropoffStateCode = resolveLocationStateCode(dropoff);

  if (!pickupStateCode || !dropoffStateCode) {
    return false;
  }

  return (
    isSupportedOrderStateCode(pickupStateCode, supportedStateCodes) &&
    isSupportedOrderStateCode(dropoffStateCode, supportedStateCodes)
  );
};
