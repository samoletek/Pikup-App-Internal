export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "your-expo-stripe-publishable-key-here";
export const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "your-stripe-secret-key-here"; // Keep this secure!

// For development - you'll need a backend for production
export const STRIPE_CONFIG = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  merchantId: process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID || "your_merchant_id", // Optional
  urlScheme: process.env.EXPO_PUBLIC_URL_SCHEME || "your-app-scheme", // For redirects
};
