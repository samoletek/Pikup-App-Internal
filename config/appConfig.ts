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

const toCsvSet = (value: string) =>
  new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );

const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;

const defaultBypassEmails = isDev ? "drew@architeq.io" : "";

export const appConfig = {
  env: {
    isDev,
  },
  stripe: {
    publishableKey: readEnv("EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    merchantId: readEnv("EXPO_PUBLIC_STRIPE_MERCHANT_ID", "merchant.com.pikup"),
    urlScheme: readEnv("EXPO_PUBLIC_URL_SCHEME", "pikup"),
    onboardingRefreshUrl: readEnv(
      "EXPO_PUBLIC_STRIPE_ONBOARDING_REFRESH_URL",
      "https://pikup-app.com/driver-onboarding"
    ),
    onboardingReturnUrl: readEnv(
      "EXPO_PUBLIC_STRIPE_ONBOARDING_RETURN_URL",
      "https://pikup-app.com/driver-onboarding-complete"
    ),
  },
  mapbox: {
    publicToken: readEnv("EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN"),
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
