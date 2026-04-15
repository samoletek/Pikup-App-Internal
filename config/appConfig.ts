import Constants from "expo-constants";

const normalizeEnvValue = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
};

const readExtraConfig = (key: string): string => {
  const expoConfigExtra =
    (Constants?.expoConfig?.extra as Record<string, unknown> | undefined) || {};
  const manifestExtra =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } })?.manifest?.extra || {};
  const manifest2Extra =
    (
      Constants as unknown as {
        manifest2?: { extra?: Record<string, unknown> };
      }
    )?.manifest2?.extra || {};

  return (
    normalizeEnvValue(expoConfigExtra[key]) ||
    normalizeEnvValue(manifestExtra[key]) ||
    normalizeEnvValue(manifest2Extra[key])
  );
};

const readEnv = (key: string, fallback = ""): string => {
  const envBag = (process?.env || {}) as Record<string, string | undefined>;
  const valueFromProcessEnv = normalizeEnvValue(envBag[key]);
  if (valueFromProcessEnv) {
    return valueFromProcessEnv;
  }

  const valueFromExtra = readExtraConfig(key);
  if (valueFromExtra) {
    return valueFromExtra;
  }

  return fallback;
};

const readEnvBoolean = (key: string, fallback = false): boolean => {
  const rawValue = readEnv(key, fallback ? "1" : "0").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(rawValue);
};

const toCsvSet = (value: string) =>
  new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );

const mergeCsvSets = (...values: string[]) => {
  const merged = new Set<string>();
  values.forEach((value) => {
    toCsvSet(value).forEach((entry) => merged.add(entry));
  });
  return merged;
};

const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;

const defaultBypassEmails = isDev ? "drew@architeq.io" : "";
// Temporary production/build-safe override for driver phone verification gate.
// TODO(remove on request): drew@architeq.io should no longer bypass phone verification.
const defaultPhoneVerificationBypassEmails = "drew@architeq.io";

export const appConfig = {
  env: {
    isDev,
  },
  stripe: {
    publishableKey: readEnv("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    merchantId: readEnv("EXPO_PUBLIC_STRIPE_MERCHANT_ID", "merchant.com.pikup"),
    urlScheme: readEnv("EXPO_PUBLIC_URL_SCHEME", "pikup"),
    identityBrandLogoUrl: readEnv(
      "EXPO_PUBLIC_STRIPE_IDENTITY_BRAND_LOGO_URL",
      "https://pikup-app.com/favicon.png"
    ),
    onboardingRefreshUrl: readEnv(
      "EXPO_PUBLIC_STRIPE_ONBOARDING_REFRESH_URL",
      "https://pikup-app.com"
    ),
    onboardingReturnUrl: readEnv(
      "EXPO_PUBLIC_STRIPE_ONBOARDING_RETURN_URL",
      "https://pikup-app.com"
    ),
  },
  mapbox: {
    publicToken: readEnv("EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN"),
  },
  navigation: {
    // Dev-only by design. Production defaults to real GPS navigation.
    mapboxSimulationEnabled: isDev && readEnvBoolean("EXPO_PUBLIC_MAPBOX_NAV_SIMULATE", true),
  },
  supabase: {
    url: readEnv("EXPO_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  },
  ai: {
    geminiApiKey: readEnv("EXPO_PUBLIC_GEMINI_API_KEY"),
  },
  paymentService: {
    baseUrl: readEnv("EXPO_PUBLIC_PAYMENT_SERVICE_URL", "https://api.pikup.app"),
  },
  dispatch: {
    maxDistanceAsapMiles: readEnv("EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_ASAP_MILES", "15"),
    maxDistanceScheduledMiles: readEnv("EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES", "35"),
    asapBatchRadiiMiles: readEnv("EXPO_PUBLIC_DISPATCH_ASAP_BATCH_RADII_MILES", "20,40,80,100"),
    asapBatchIntervalSeconds: readEnv("EXPO_PUBLIC_DISPATCH_ASAP_BATCH_INTERVAL_SECONDS", "60"),
    requestOfferTtlSeconds: readEnv("EXPO_PUBLIC_DISPATCH_REQUEST_OFFER_TTL_SECONDS", "180"),
    requestSearchMaxHours: readEnv("EXPO_PUBLIC_DISPATCH_REQUEST_SEARCH_MAX_HOURS", "10"),
    scheduledLookaheadHours: readEnv("EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS", "72"),
    scheduledPastGraceMinutes: readEnv("EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES", "5"),
    overlapMinDurationMinutes: readEnv("EXPO_PUBLIC_DISPATCH_OVERLAP_MIN_DURATION_MINUTES", "25"),
    overlapBaseServiceMinutes: readEnv("EXPO_PUBLIC_DISPATCH_OVERLAP_BASE_SERVICE_MINUTES", "15"),
    overlapAverageSpeedMph: readEnv("EXPO_PUBLIC_DISPATCH_OVERLAP_AVERAGE_SPEED_MPH", "22"),
    overlapInterTripBufferMinutes: readEnv("EXPO_PUBLIC_DISPATCH_OVERLAP_INTER_TRIP_BUFFER_MINUTES", "10"),
  },
  driverReadinessBypass: {
    // TODO(remove before production): keep only temporary dev bypass.
    emails: toCsvSet(
      readEnv("EXPO_PUBLIC_DRIVER_READINESS_BYPASS_EMAILS", defaultBypassEmails)
    ),
    userIds: toCsvSet(readEnv("EXPO_PUBLIC_DRIVER_READINESS_BYPASS_USER_IDS", "")),
  },
  driverPhoneVerificationBypass: {
    emails: mergeCsvSets(
      defaultPhoneVerificationBypassEmails,
      readEnv("EXPO_PUBLIC_DRIVER_PHONE_BYPASS_EMAILS", "")
    ),
    userIds: toCsvSet(readEnv("EXPO_PUBLIC_DRIVER_PHONE_BYPASS_USER_IDS", "")),
  },
  devMocks: {
    enabled: isDev && readEnv("EXPO_PUBLIC_ENABLE_DEV_MOCK_DATA", "0") === "1",
  },
};

export const isDriverReadinessBypassEnabled = (user?: { uid?: string; id?: string; email?: string }) => {
  if (!appConfig.env.isDev) {
    return false;
  }

  const userId = String(user?.uid || user?.id || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();

  return (
    (userId && appConfig.driverReadinessBypass.userIds.has(userId)) ||
    (email && appConfig.driverReadinessBypass.emails.has(email))
  );
};

export const isDriverPhoneVerificationBypassEnabled = (
  user?: { uid?: string; id?: string; email?: string }
) => {
  const userId = String(user?.uid || user?.id || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();

  return (
    (userId && appConfig.driverPhoneVerificationBypass.userIds.has(userId)) ||
    (email && appConfig.driverPhoneVerificationBypass.emails.has(email))
  );
};
