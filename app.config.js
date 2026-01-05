// Dynamic Expo config so dev client is only included for development builds
// and your Preview/Production builds run standalone. Slug changed to "pikup".

const profile = process.env.EAS_BUILD_PROFILE ?? "development";
const isDev = profile === "development";

module.exports = {
  expo: {
    name: "Pikup",
    slug: "Pikup", 
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pikup.main",
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
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
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
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
        mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
      },
    },

    web: { favicon: "./assets/favicon.png" },

    extra: {
      eas: { projectId: "7624093e-e57c-43be-a90a-63748fcfcbfe" },
    },

    owner: "sperez22",

    // Include dev client only for development builds
    plugins: [
      ...(profile === "development" ? ["expo-dev-client"] : []),
      [
        "@rnmapbox/maps",
        { RNMapboxMapsImpl: "mapbox", RNMapboxMapsVersion: "10.19.0" },
      ],
      [
        "./plugins/withMapboxNavigation",
        { ios: true, android: false},
      ],
      ["expo-build-properties", { ios: { useFrameworks: "static" } }],
      [
        "expo-camera",
        {
          cameraPermission:
            "Pikup needs camera access to verify your identity and capture photos of items.",
        },
      ],
    ],
  },
};
