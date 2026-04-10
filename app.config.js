// Dynamic Expo config so dev client is only included for development builds
// and your Preview/Production builds run standalone. Slug changed to "pikup".

const profile = process.env.EAS_BUILD_PROFILE ?? "development";
const isDev = profile === "development";

module.exports = {
  expo: {
    name: "pikup",
    slug: "pikup-app",
    version: "1.0.30",
    scheme: "pikup",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],

    ios: {
      buildNumber: "32",
      supportsTablet: true,
      usesAppleSignIn: true,
      appleTeamId: "99LU49ANLX",
      bundleIdentifier: "io.architeq.pikup",
      googleServicesFile: "./GoogleService-Info.plist",
      associatedDomains: ["applinks:pikup-app.com", "applinks:www.pikup-app.com"],
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
      },
      infoPlist: {
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Pikup needs location access to match you with nearby drivers and track deliveries.",
        NSLocationWhenInUseUsageDescription:
          "Pikup needs location access to show nearby pickup and delivery options.",
        NSCameraUsageDescription:
          "Pikup needs camera access to verify your identity and capture photos of items for pickup.",
        NSPhotoLibraryUsageDescription:
          "Pikup needs photo library access to select photos of items.",
        ITSAppUsesNonExemptEncryption: false,
        MBXAccessToken: "$(EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN)",
        ...(isDev ? {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
            NSAllowsLocalNetworking: true,
            NSExceptionDomains: {
              "localhost": {
                NSExceptionAllowsInsecureHTTPLoads: true,
                NSIncludesSubdomains: true
              },
              "127.0.0.1": {
                NSExceptionAllowsInsecureHTTPLoads: true,
                NSIncludesSubdomains: true
              }
            }
          }
        } : {}),
      },
    },

    android: {
      versionCode: 32,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      softwareKeyboardLayoutMode: "pan",
      package: "com.pikup.main",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "WAKE_LOCK",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
      ],
      googleServicesFile: "./google-services.json",
      newArchEnabled: true,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
              {
                scheme: "https",
                host: "pikup-app.com",
                pathPrefix: "/invite",
              },
              {
                scheme: "https",
                host: "www.pikup-app.com",
                pathPrefix: "/invite",
              },
              {
                scheme: "https",
                host: "pikup-app.com",
                pathPrefix: "/reset-password",
              },
              {
                scheme: "https",
                host: "www.pikup-app.com",
                pathPrefix: "/reset-password",
              },
            ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
        mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
      }
    },
    "extra": {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      EXPO_PUBLIC_STRIPE_MERCHANT_ID: process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID,
      EXPO_PUBLIC_URL_SCHEME: process.env.EXPO_PUBLIC_URL_SCHEME,
      EXPO_PUBLIC_STRIPE_IDENTITY_BRAND_LOGO_URL:
        process.env.EXPO_PUBLIC_STRIPE_IDENTITY_BRAND_LOGO_URL,
      EXPO_PUBLIC_STRIPE_ONBOARDING_REFRESH_URL:
        process.env.EXPO_PUBLIC_STRIPE_ONBOARDING_REFRESH_URL,
      EXPO_PUBLIC_STRIPE_ONBOARDING_RETURN_URL:
        process.env.EXPO_PUBLIC_STRIPE_ONBOARDING_RETURN_URL,
      EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      EXPO_PUBLIC_PAYMENT_SERVICE_URL: process.env.EXPO_PUBLIC_PAYMENT_SERVICE_URL,
      EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_ASAP_MILES:
        process.env.EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_ASAP_MILES,
      EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES:
        process.env.EXPO_PUBLIC_DISPATCH_MAX_DISTANCE_SCHEDULED_MILES,
      EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS:
        process.env.EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS,
      EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES:
        process.env.EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES,
      EXPO_PUBLIC_DISPATCH_OVERLAP_MIN_DURATION_MINUTES:
        process.env.EXPO_PUBLIC_DISPATCH_OVERLAP_MIN_DURATION_MINUTES,
      EXPO_PUBLIC_DISPATCH_OVERLAP_BASE_SERVICE_MINUTES:
        process.env.EXPO_PUBLIC_DISPATCH_OVERLAP_BASE_SERVICE_MINUTES,
      EXPO_PUBLIC_DISPATCH_OVERLAP_AVERAGE_SPEED_MPH:
        process.env.EXPO_PUBLIC_DISPATCH_OVERLAP_AVERAGE_SPEED_MPH,
      EXPO_PUBLIC_DISPATCH_OVERLAP_INTER_TRIP_BUFFER_MINUTES:
        process.env.EXPO_PUBLIC_DISPATCH_OVERLAP_INTER_TRIP_BUFFER_MINUTES,
      EXPO_PUBLIC_DRIVER_READINESS_BYPASS_EMAILS:
        process.env.EXPO_PUBLIC_DRIVER_READINESS_BYPASS_EMAILS,
      EXPO_PUBLIC_DRIVER_READINESS_BYPASS_USER_IDS:
        process.env.EXPO_PUBLIC_DRIVER_READINESS_BYPASS_USER_IDS,
      EXPO_PUBLIC_ENABLE_DEV_MOCK_DATA: process.env.EXPO_PUBLIC_ENABLE_DEV_MOCK_DATA,
      "eas": {
        "projectId": "b8028c4b-62e3-4bfd-a81a-526bf93b3190"
      },
      "google": {
        "iosClientId": process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        "androidClientId": process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        "webClientId": process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
      }
    },
    owner: "pikup-app",
    web: { favicon: "./assets/favicon.png" },

    // Include dev client only for development builds
    plugins: [
      [
        "@rnmapbox/maps",
        { RNMapboxMapsVersion: "11.12.0" },
      ],
      [
        "./plugins/withMapboxNavigation",
        { ios: true, android: true },
      ],
      "./plugins/withStripeIdentityMaterialTheme",
      ["expo-build-properties", { ios: { useFrameworks: "static" } }],
      [
        "expo-camera",
        {
          cameraPermission:
            "Pikup needs camera access to verify your identity and capture photos of items.",
        },
      ],
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID || "merchant.com.pikup",
        },
      ],
      "expo-font",
    ],
  },
};
