# PikUp App - Project Checklist

## Project Overview

**Total: 85 tasks, 8-10 weeks**

---

## Milestone 1: Foundation & Backend

**Timeline:** 2-3 weeks  
**Focus:** Backend migration, authentication, core fixes

### Global / Critical
- [ ] #1 Safe Area - extend content to screen edges like modern apps - Erema
- [x] #2 Sign in with Apple (App Store requirement) - Andrei
- [x] #3 Sign in with Google (Play Store requirement) - Andrei
- [x] #4 Account deletion feature (required by both stores) - Andrei
- [ ] #5 Terms/Privacy - links to pikup-app.com - Drew

### Customer Flow - Step 1: Pickup & Dropoff
- [x] #21 Address autocomplete (Mapbox API) - Andrei
- [x] #22 Remove "Popular Places" section - not relevant for moving - Erema
- [ ] #23 Add "Use current location" option - Erema

### Customer Flow - Step 3: Vehicle Selection
- [ ] #31 Fix Modal maxHeight - content gets cut off - Drew
- [ ] #32 Add back/collapse navigation to modals - Drew
- [x] #33 Remove hardcoded "AI Recommended" badge - Erema
- [ ] #34 Audit and fix price calculations - Drew
- [ ] #35 Show vehicles as scrollable list, not buttons - Drew

### Backend / Infrastructure
- [ ] #71 Supabase migration (auth + DB + realtime) - Andrei: очистить приложение от связи со старым бэком. Разметить полностью бэк под супабейс, все эндпойнты, таблицы новые. Какие именно таблицы должны быть и какие в них должны быть поля - это все должен подсказать файл readme.

### Insurance API
- [ ] #80 Redkik API authentication - **BLOCKED: waiting for correct base URL**

### Milestone 1 Deliverables
- [ ] Working social authentication (Apple + Google)
- [ ] Account deletion functionality
- [ ] Supabase backend configured and migrated
- [ ] Fixed modal system with proper navigation
- [ ] Address autocomplete working
- [ ] Price calculation audit complete

---

## Milestone 2: Customer Flow Polish

**Timeline:** 2-3 weeks  
**Focus:** Complete customer experience, UI/UX consistency

### Global
- [ ] #6 Apple HIG compliance (navigation, buttons, modals)
- [ ] #7 Device consistency across screen sizes

### Authentication Screens
- [ ] #8 Forgot Password flow
- [ ] #9 Loading states (spinners, disabled buttons)
- [ ] #10 Error handling on all failures
- [ ] #11 Back button on Sign Up screen

### Customer Flow - Home Screen
- [ ] #12 Logo positioning fix
- [ ] #13 Search field - fix touch area (only 30% clickable)
- [ ] #14 UX fix - search opens A/B modal confusion
- [ ] #15 Remove duplicate buttons (Request Pickup vs search)

### Customer Flow - Request Flow (Multi-Step Modal)
- [ ] #16 Add back navigation between request steps
- [ ] #17 Fixed bottom button on all steps
- [ ] #18 Unified modal component across steps
- [ ] #19 Fix black screen flash when closing modals
- [ ] #20 Prevent progress reset on tap outside modal

### Customer Flow - Step 2: Item Details
- [ ] #24 Remove address display (already confirmed in Step 1)
- [ ] #25 Remove duplicate photo area
- [ ] #26 Fix photo delete button overflow
- [ ] #27 Add New/Used selection toggle
- [ ] #28 Insurance logic: New = auto-insured, Used = disclaimer
- [ ] #29 Remove AI analysis feature (only fills one field)
- [ ] #30 Enlarge Description field

### Customer Flow - Step 4: Summary
- [ ] #36 Tap on summary item jumps to that step
- [ ] #37 Fix button container overflow
- [ ] #38 Handle unavailable insurance state
- [ ] #39 Audit all price calculations

### Milestone 2 Deliverables
- [ ] Complete customer request flow with proper navigation
- [ ] Consistent UI/UX across all customer screens
- [ ] Apple HIG compliant interface
- [ ] Working authentication with password reset
- [ ] New/Used item selection with insurance logic

---

## Milestone 3: Features & Driver Onboarding

**Timeline:** 2-3 weeks  
**Focus:** Messaging, account screens, driver onboarding, new features

### Customer Flow - Messages Screen
- [ ] #43 Fix messaging - currently not functional
- [ ] #44 Auto-create chat room per trip
- [ ] #45 Move Support messages to Account > Help
- [ ] #46 Center "No messages" empty state

### Customer Flow - Account Screen
- [ ] #47 Account deletion (App Store requirement)
- [ ] #48 Remove Driver toggle - separate accounts
- [ ] #49 Remove Wallet for customer - direct payment
- [ ] #50 Remove duplicate buttons (already in tab bar)
- [ ] #51 Move Promo banner to Home screen
- [ ] #52 Terms/Privacy as website links
- [ ] #53 Full Account UI rebuild
- [ ] #54 Separate Settings from profile editing
- [ ] #55 Data Usage/Download - implement or remove
- [ ] #56 Remove Clear app data option

### Driver Flow - Onboarding
- [ ] #58 Phone verification (SMS) - prevent fake numbers
- [ ] #59 Driver address autocomplete
- [ ] #60 Cascading vehicle picker: Make > Model > Year (trucks/SUVs only)
- [ ] #61 Convert to multi-step onboarding form

### Backend / Infrastructure
- [ ] #70 Dynamic pricing algorithm

### New Features (from Jan 24 call)
- [ ] #72 Multiple items - grid for adding items
- [ ] #73 Each item: photo + frame + AI description + new/used
- [ ] #74 Receipt photo for new items (insurance)
- [ ] #75 Confirmation dialog: verify description and count
- [ ] #76 Driver preferences UI (size, equipment, extra help)
- [ ] #77 Gamification - weekly milestones, bonuses, progress
- [ ] #78 AI - adjustable frame for photo selection
- [ ] #79 AI - simplify system prompt for concise descriptions

### Milestone 3 Deliverables
- [ ] Working messaging system
- [ ] Rebuilt Account screens (Customer + Driver)
- [ ] Complete driver onboarding with verification
- [ ] Multiple items support with receipts
- [ ] Driver preferences and gamification UI
- [ ] Dynamic pricing implemented

---

## Milestone 4: Driver Experience & Deployment

**Timeline:** 2-3 weeks  
**Focus:** Driver screens, matching algorithm, payments, deployment

### Customer Flow - Activity Screen
- [ ] #40 Fix Filter button - currently non-functional
- [ ] #41 Center "No trips Found" text
- [ ] #42 Verify Recent/All filters work

### Customer Flow - Account Screen
- [ ] #57 Referral program with deep links

### Driver Flow - Home Screen
- [ ] #62 Large buttons for driver (use while driving)
- [ ] #63 Evaluate Map + Online toggle for scheduled moving
- [ ] #64 Add button to open recent trips modal

### Driver Flow - Earnings Screen
- [ ] #65 Fix non-functional Earnings screen buttons
- [ ] #66 Realtime sync with Supabase

### Driver Flow - Order Notification
- [ ] #67 Popup modal for incoming orders with timer
- [ ] #68 Show: pickup location, earnings, accept/decline time

### Backend / Infrastructure
- [ ] #69 Order matching algorithm (nearest driver + preferences)

### Insurance API
- [ ] #81 Verify Redkik quote flow - **BLOCKED: waiting for API access**
- [ ] #82 Test insurance logic end-to-end - **BLOCKED: waiting for API access**

### Stripe Payments
- [ ] #83 Customer payment flow testing
- [ ] #84 Driver payout (Stripe Connect) - **Backend currently returns 500 error**
- [ ] #85 70% earnings calculation verification

### Milestone 4 Deliverables
- [ ] Complete driver home screen with order notifications
- [ ] Order matching algorithm (distance + preferences)
- [ ] Working earnings dashboard with realtime sync
- [ ] Stripe payments tested (customer + driver)
- [ ] Insurance integration (pending Redkik API access)
- [ ] Full cross-platform testing (iOS + Android)
- [ ] App Store + Play Store submission

---

## Completed Work (Original Contract)

### Mapbox SDK Build
- [x] Debug iOS build failures with Mapbox
- [x] Confirm `MAPBOX_DOWNLOAD_TOKEN` is picked up during build
- [x] Verify `withMapboxNavigation.js` plugin works in EAS Cloud Build
- [x] Test Mapbox Navigation SDK initialization on physical device

### Stripe Identity Verification
- [x] Uncomment `useStripeIdentity` import in `DriverOnboardingScreen.js`
- [x] Uncomment `useStripeIdentity` hook
- [x] Uncomment verification status useEffect
- [x] Uncomment loading indicator
- [x] Replace placeholder alert with actual `present()` flow
- [x] Test full driver identity verification flow

### Document Picker (Claims Screen)
- [x] Uncomment document picker import in `CustomerClaimsScreen.js`
- [x] Fix the error that caused it to be disabled
- [x] Test document upload for insurance claims

### Environment Variables
- [x] Confirm `.env.local` loads correctly in Expo
- [x] Test all Firebase operations (auth, Firestore, Storage)
- [x] Fixed `pass-word` typo in AuthScreen.js

### Feedback After Delivery
- [x] Create feedback UI component (star rating + comments)
- [x] Trigger feedback modal after `status === 'completed'`
- [x] Create `feedback` collection in Firebase
- [x] Store: `requestId`, `rating`, `comment`, `timestamp`
- [x] Show feedback in driver profile/stats

### Testing
- [x] iOS Simulator testing

### Blocking Fixes (Beyond Original Scope)
- [x] Fix iOS build for Xcode 17 beta - updated dependencies, removed `expo-dev-client`
- [x] Fix driver onboarding navigation - new drivers now redirected to onboarding screen
- [x] Fix `pass-word` typo in AuthScreen.js that broke registration
- [x] Fix dateOfBirth parsing (NaN error) - handle both MMDDYYYY and MM/DD/YYYY formats
- [x] Fix terms acceptance screen skipping - reordered race condition in signup
- [x] Fix Driver Onboarding UX (14 items total)

---

## Technical Notes

### Working iOS Build Configuration

**Key Package Versions:**
```json
{
  "react": "19.1.0",
  "react-native": "^0.81.5",
  "react-native-screens": "^4.19.0",
  "@react-native-community/cli": "^20.0.2",
  "@rnmapbox/maps": "10.2.10"
}
```

**Critical Configuration:**
- NO `expo-dev-client` - causes compile errors with Xcode 17 beta
- NO `RNMapboxMapsImpl: "mapbox"` in app.config.js - use default MapLibre
- Mapbox patch applied: `patches/@rnmapbox+maps+10.2.10.patch`

> **⚠️ DO NOT UPDATE these packages** — will break iOS build:
> - `react-native-reanimated` — keep at `~3.17.4` (v4+ requires New Architecture)
> - `react-native-gesture-handler` — keep at `~2.24.0`
> - `expo-dev-client` — **DO NOT ADD** (causes Xcode 17 compile errors)

### New Developer Setup
```bash
git pull origin Release_1_1_0
npm install
npx expo prebuild --clean --platform ios
npx expo run:ios
```

### Important
- Use `npx expo run:ios` NOT `npx expo start --ios` (Mapbox needs native build)
- Branch: `Release_1_1_0`
- Backend: `https://pikup-server.onrender.com`
- Stripe keys are LIVE (not test) - be careful with payments

---