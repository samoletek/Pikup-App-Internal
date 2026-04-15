# PikUp

PikUp is a React Native/Expo application that connects users with drivers who have pickup trucks or SUVs, offering a faster, convenient, and affordable way to transport large or medium items — unlike dealing with the hassle of renting or high costs of traditional movers.

See [CHECKLIST.md](./CHECKLIST.md) for detailed task breakdown.

---

## Architecture Overview

### Tech Stack
- **Frontend:** React Native + Expo
- **Backend:** Supabase (migrating from Firebase)
- **Payments:** Stripe (Payments + Connect + Identity)
- **Maps:** Mapbox Navigation SDK
- **AI:** Google Gemini Vision API
- **Insurance:** Redkik API

---

## Features

### Customer Experience
1. **Photo Capture** → **AI Analysis** → **Address Selection** → **Vehicle Selection** → **Payment** → **Driver Matching**
2. **Real-time Tracking** via DeliveryTrackingScreen
3. **Multiple Items Support** with individual photos and descriptions
4. **New/Used Classification** with receipt upload for insurance
5. **In-app Messaging** with assigned driver
6. **Delivery Confirmation** with photos
7. **Rating System** and feedback

### Driver Experience
1. **Driver Onboarding** with Stripe Connect and identity verification
2. **Preferences Setup** (item sizes, equipment, availability)
3. **Order Notifications** with timer for accept/decline
4. **Smart Matching** based on distance and preferences
5. **GPS Navigation** to pickup/dropoff locations
6. **Earnings Dashboard** with realtime sync
7. **Gamification** - weekly milestones and bonuses

### Key Algorithms
- **Order Matching:** Wave-based radius expansion (`20→40→80→100` miles), 3-minute per-driver offer TTL, preference-aware filtering
- **Dynamic Pricing:** Based on distance, item type, time, and demand
- **Insurance Logic:** Auto-apply to new items only, require receipt verification

---

## Key Context Providers

### AuthContext (`contexts/AuthContext.js`)
**The heart of the application** - Manages:
- User authentication (registration, login, logout)
- Profile management (customer/driver roles)
- Pickup request lifecycle
- Driver earnings (70% of trip cost)
- All Supabase data operations

**Key Functions:**
- `registerUser()`, `loginUser()`, `logoutUser()`
- `createPickupRequest()`, `updateRequestStatus()`
- `setupStripeConnect()`, `processDriverPayout()`

### PaymentContext (`contexts/PaymentContext.js`)
Handles all Stripe operations:
- Payment intents and checkout
- Payment method management
- Error handling

---

## Screen Structure

### Customer Screens
| Screen | Purpose |
|--------|---------|
| CustomerHomeScreen | Create pickup requests |
| CustomerActivityScreen | View current/past requests |
| CustomerMessagesScreen | Chat with drivers |
| CustomerProfileScreen | Profile & settings |
| PhotoCaptureScreen | AI-powered item analysis |
| PickupDropoffScreen | Address selection |
| VehicleSelectionScreen | Choose vehicle type |
| PaymentScreen | Payment processing |
| DeliveryTrackingScreen | **Main tracking interface** |

### Driver Screens
| Screen | Purpose |
|--------|---------|
| DriverHomeScreen | Accept/decline requests |
| DriverEarningsScreen | Earnings & payouts |
| DriverMessagesScreen | Chat with customers |
| DriverProfileScreen | Profile & vehicle info |
| DriverOnboardingScreen | Stripe Connect setup |
| DriverNavigationScreen | GPS navigation |

---

## Development Setup

### Prerequisites
- Node.js 18+
- Expo CLI
- Xcode 17+ (for iOS)
- Android Studio (for Android)

### Environment Variables
Create `.env.local`:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_STRIPE_MERCHANT_ID=merchant.com.pikup
EXPO_PUBLIC_URL_SCHEME=pikup
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
REDKIK_CLIENT_ID=your-redkik-client-id
REDKIK_CLIENT_SECRET=your-redkik-client-secret

# Optional: Dispatch tuning (driver request pool)
# Wave expansion for pending requests (ASAP + Scheduled)
EXPO_PUBLIC_DISPATCH_ASAP_BATCH_RADII_MILES=20,40,80,100
EXPO_PUBLIC_DISPATCH_ASAP_BATCH_INTERVAL_SECONDS=60
EXPO_PUBLIC_DISPATCH_REQUEST_OFFER_TTL_SECONDS=180
EXPO_PUBLIC_DISPATCH_REQUEST_SEARCH_MAX_HOURS=10

# Additional scheduled constraints
EXPO_PUBLIC_DISPATCH_SCHEDULED_LOOKAHEAD_HOURS=72
EXPO_PUBLIC_DISPATCH_SCHEDULED_PAST_GRACE_MINUTES=5
```

For Supabase Edge Functions, you can also set the same values as project secrets
without the `EXPO_PUBLIC_` prefix (`DISPATCH_*`).

### Dispatch Smoke Check (No UI)
Use this script to validate request-pool behavior for two drivers.

```bash
npm run dispatch:smoke -- \
  --driverAEmail=driver1@example.com --driverAPassword='***' \
  --driverBEmail=driver2@example.com --driverBPassword='***' \
  --requestPool=asap
```

To validate disappearance after accept (mutates one trip):

```bash
npm run dispatch:smoke -- \
  --driverAEmail=driver1@example.com --driverAPassword='***' \
  --driverBEmail=driver2@example.com --driverBPassword='***' \
  --requestPool=asap --accept
```

If the trip is intentionally visible only to one driver (Preferences), add:
`--allowSingleDriver`

If there are no pending trips, the script can seed one using a customer account:

```bash
npm run dispatch:smoke -- \
  --driverAEmail=driver1@example.com --driverAPassword='***' \
  --driverBEmail=driver2@example.com --driverBPassword='***' \
  --customerEmail=customer@example.com --customerPassword='***' \
  --requestPool=asap --accept
```

### Installation
```bash
git pull origin Release_1_1_0
npm install
npx expo prebuild --clean --platform ios
npx expo run:ios
```

> **Important:** Use `npx expo run:ios` NOT `npx expo start --ios` (Mapbox needs native build)

### Build Commands
```bash
# Development
npx eas build --platform ios --profile development
npx eas build --platform android --profile development

# Production
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

---

## Critical Configuration

### Package Versions (DO NOT UPDATE)
```json
{
  "react": "19.1.0",
  "react-native": "^0.81.5",
  "react-native-screens": "^4.19.0",
  "@rnmapbox/maps": "10.2.10",
  "react-native-reanimated": "~3.17.4",
  "react-native-gesture-handler": "~2.24.0"
}
```

### Build Requirements
- **NO `expo-dev-client`** — causes Xcode 17 compile errors
- **NO `RNMapboxMapsImpl: "mapbox"`** — use default MapLibre
- Mapbox patch: `patches/@rnmapbox+maps+10.2.10.patch`

---

## External Services

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | Auth + Database + Realtime | Migrating |
| Stripe | Payments + Connect + Identity | Live keys |
| Mapbox | Navigation SDK | Configured |
| Google Gemini | AI item analysis | Working |
| Redkik | Insurance API | Blocked (wrong URL) |

### Backend
- **URL:** `https://pikup-server.onrender.com`
- **Known Issue:** Driver payout returns 500 error

---

## Milestones

### Milestone 1: Foundation & Backend
- Social login (Apple + Google)
- Account deletion
- Supabase migration
- Modal fixes
- Address autocomplete

### Milestone 2: Customer Flow Polish
- Apple HIG compliance
- Request flow navigation
- New/Used item selection
- Error handling
- Forgot password

### Milestone 3: Features & Driver Onboarding
- Messaging system
- Account screens rebuild
- Multiple items support
- Driver preferences UI
- Gamification
- Dynamic pricing

### Milestone 4: Driver Experience & Deployment
- Order matching algorithm
- Driver notifications with timer
- Earnings dashboard
- Stripe payments testing
- Cross-platform testing
- App Store submission

---

## Security Notes

- **API Keys:** Stored in `.env.local` (not committed)
- **Payments:** Stripe handles all sensitive data
- **Auth:** Supabase with RLS
- **Stripe keys are LIVE** — careful with payments

---

## 📞 Resources

- **Landing Page:** https://pikup-app.com/

---

**Last Updated:** January 25, 2026  
**Developer:** Andrew S. / Architeq
