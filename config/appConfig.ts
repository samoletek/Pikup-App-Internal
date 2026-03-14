const readEnv = (key: string, fallback = ""): string => {
  const envBag = (process?.env || {}) as Record<string, string | undefined>;
  const value = envBag[key];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
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
  },
  mapbox: {
    publicToken: readEnv("EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN"),
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
