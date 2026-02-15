# PikUp App - Project Checklist

## Project Overview

**Total: 118 tasks, 8-10 weeks**

**Legend:**
- `*` = Added during calls 
- `[-]` = In progress / partially done

---

## Milestone 1: Foundation & Backend

**Timeline:** 2-3 weeks  
**Focus:** Backend migration, authentication, core fixes

### Global / Critical
- [x] #1 Safe Area - extend content to screen edges like modern apps
- [x] #2 Sign in with Apple (App Store requirement)
- [x] #3 Sign in with Google (Play Store requirement)
- [x] #4 Account deletion feature (required by both stores)
- [x] #5 Terms/Privacy - links to pikup-app.com (need to create)

### Customer Flow - Step 1: Pickup & Dropoff
- [x] #21 Address autocomplete (Mapbox API)
- [x] #22 Remove "Popular Places" section - not relevant for moving
- [x] #23 Add "Use current location" option

### Customer Flow - Step 3: Vehicle Selection
- [x] #31 Fix Modal maxHeight - content gets cut off
- [x] #32 Add back/collapse navigation to modals
- [x] #33 Remove hardcoded "AI Recommended" badge
- [x] #34 Audit and fix price calculations in pricesummary
- [x] #35 Show vehicles as scrollable list, not buttons

### Backend / Infrastructure
- [x] #71 Supabase migration (auth + DB + realtime)

### Insurance API
- [x] #80 Redkik API authentication 

---

## Milestone 2: Customer Flow Polish

**Timeline:** 2-3 weeks  
**Focus:** Complete customer experience, UI/UX consistency

### Global
- [x] #6 Apple HIG compliance (navigation, buttons, modals)
- [x] #7 Device consistency across screen sizes
- [x] #99 Components refactoring

### Authentication Screens
- [x] #8 Forgot Password flow (UI only)
- [x] #9 Loading states (spinners, disabled buttons)
- [x] #10 Error handling on all failures
- [x] #11 Back button on Sign Up screen
- [ ] #8.1 Forgot Password - Supabase integration (UI - Done)

### Customer Flow - Home Screen
- [x] #12 Logo positioning fix
- [x] #13 Search field - fix touch area (only 30% clickable)
- [x] #14 UX fix - search opens A/B modal confusion
- [x] #15 Remove duplicate buttons (Request Pickup vs search)

### Customer Flow - Request Flow (Multi-Step Modal)
- [x] #16 Add back navigation between request steps
- [x] #17 Fixed bottom button on all steps
- [x] #18 Unified modal component across steps
- [x] #19 Fix black screen flash when closing modals
- [x] #20 Prevent progress reset on tap outside modal

### Customer Flow - Step 2: Item Details
- [x] #24 Remove address display (already confirmed in Step 1)
- [x] #25 Remove duplicate photo area
- [x] #26 Fix photo delete button overflow
- [x] #27 Add New/Used selection toggle
- [x] #28 Insurance logic: New = auto-insured, Used = disclaimer
- [x] #30 Enlarge Description field
- [x] #36 Tap on summary item jumps to that step
- [x] #37 Fix button container overflow
- [x] #38 Handle unavailable insurance state

---

## Milestone 3: Features & Driver Onboarding

**Timeline:** 2-3 weeks  
**Focus:** AI features, messaging, account screens, driver onboarding

### Customer Flow - Schedule Booking *
- [x] #86 DatePicker limit: max +30 days from current date

### Customer Flow - Step 3/4: Pickup/Dropoff Details *
- [x] #87 Cascading questions by location type (Store/Apartment/House/Other)
- [x] #88 Remove "Order Confirmation Number" field
- [x] #107 Store vs Marketplace selection (optional, not critical)
- [ ] #108 Global "Driver help" question (applies to both pickup & dropoff) *

### Customer Flow - Step 6: Review & Payment (REDESIGN) *
- [x] #89 Remove intermediate summary screen
- [x] #90 Create single full-screen Review + Payment + Confirm
- [x] #91 Add "Edit" buttons to return to any step

### Customer Flow - Step 2: Item Details (AI Flow) *
- [x] #92 Value field: show only if item = New, hide for Used
- [x] #93 AI analysis: trigger ONCE after "Confirm" (not per photo) - adrei
- [x] #94 Auto-create separate item cards from AI analysis - adrei
- [x] #95 Add explicit hint: "You can upload multiple photos/items"
- [x] #96 Fix photo picker: allow selecting up to 3 photos at once
- [x] #97 Add "Powered by AI" visual indicator

### Customer Flow - Driver Help *
- [x] #98 Add reminder: "Be at location 5 min before driver arrival" (for self-handling)

### Customer Flow - Step 5: Vehicle Selection (REDESIGN) *
- [ ] #100 Simplify to 4 broad vehicle categories (Midsize SUV, Full-Size Pickup Truck, Full-Size Truck, Cargo Truck) + change the icons (need to found) - khan
- [x] #101 Show size/capacity ranges in cards
- [ ] #102 Change price format to "starting at $X" - khan
- [ ] #103 Make vehicles expandable cards (like items) - khan
- [ ] #104 AI recommendation badge on best vehicle - khan

### AI Features *
- [ ] #29 Add AI analysis feature (all items, summary, vehicle - reimplement) - adrei
- [ ] #73 Each item: photo + frame + AI description + new/used - adrei
- [x] #74 Receipt photo for new items (insurance)
- [ ] #75 Confirmation dialog: verify description and count - adrei
- [ ] #78 AI - adjustable frame for photo selection - adrei
- [ ] #79 AI - simplify system prompt for concise descriptions - adrei

### Authentication Flow Improvements *
- [x] #105 Email flow: check if exists → show password OR signup form
- [x] #106 Account type detection: "Switch to Driver account?" dialog

### Customer Flow - Messages Screen
- [x] #43 Fix messaging - currently not functional - adrei
- [x] #44 Auto-create chat room per trip - adrei
- [x] #45 Move Support messages to Account > Help
- [x] #46 Center "No messages" empty state

### Customer Flow - Account Screen - erema
- [x] #47 Account deletion (App Store requirement)
- [x] #48 Remove Driver toggle - separate accounts
- [ ] #49 Remove Wallet for customer - direct payment (only loyalty program, bonuses)
- [ ] #50 Remove duplicate buttons in account screen (already in tab bar)
- [ ] #51 Move Promo banner to Home screen (if exists)
- [x] #52 Terms/Privacy as website links
- [ ] #53 Full Account UI rebuild (cascade menu)
- [ ] #54 Separate Settings from profile editing
- [ ] #55 Data Usage/Download - implement or remove
- [x] #56 Remove Clear app data option

### Customer Flow - Activity Screen
- [x] #40 Fix Filter button - currently non-functional
- [x] #41 Center "No trips Found" text
- [x] #42 Verify Recent/All filters work

### Driver Preferences UI *
- [x] #109 Group options by sections (Items / Equipment / Team)
- [x] #110 Fix grid/layout bugs
- [ ] #76 Driver preferences UI (size, equipment, extra help) - erema

### Driver Flow - Onboarding
- [x] #58 Phone verification (SMS) - prevent fake numbers
- [x] #59 Driver address autocomplete
- [ ] #60 Cascading vehicle picker [CHANGED: AI car analysis] - khan
- [x] #61 Convert to multi-step onboarding form
- [ ] #111 Auto-detect vehicle category via AI/API (VIN/license/photo) * - khan
- [ ] #112 [DISCUSSION] Vehicle age limit (15 vs 30 years - postponed) *

### Driver UI Enhancements *
- [x] #113 Weekly Milestones display (progress bars, bonuses)
- [ ] #114 Badges system UI (Fast Loader, Fragile Handler, etc.) - adrei
- [x] #115 "Go Online" flow: ask "Solo or Team today?" - adrei
- [ ] #116 Order notification card: full design with photos, timer - khan
- [ ] #77 Gamification - weekly milestones, bonuses, progress - khan

### Backend / Infrastructure
- [x] #70 Dynamic pricing algorithm
- [x] #39 Audit all price calculations

### New Features *
- [x] #72 Multiple items - grid for adding items

### Milestone 3 Deliverables
- [ ] Complete AI-powered item analysis flow
- [ ] Simplified vehicle selection (4 categories)
- [ ] Working messaging system
- [ ] Rebuilt Account screens (Customer + Driver)
- [ ] Complete driver onboarding with AI vehicle detection
- [ ] Driver preferences and gamification UI
- [ ] Dynamic pricing implemented

---

## Milestone 4: Driver Experience & Deployment

**Timeline:** 2-3 weeks  
**Focus:** Driver screens, matching algorithm, payments, deployment

### Customer Flow - Account Screen
- [ ] #57 Referral program with deep links

### Driver Flow - Home Screen
- [ ] #62 Large buttons for driver (use while driving) - khan
- [ ] #63 Evaluate Map + Online toggle for scheduled moving - TBD
- [ ] #64 Add button to open recent trips modal - erema

### Driver Flow - Earnings Screen
- [ ] #65 Fix non-functional Earnings screen buttons - erema
- [ ] #66 Realtime sync with Supabase - erema

### Driver Flow - Order Notification
- [ ] #67 Popup modal for incoming orders with timer - khan
- [ ] #68 Show: pickup location, earnings, accept/decline time - khan

### Backend / Infrastructure
- [ ] #69 Order matching algorithm (nearest driver + preferences) - adrei and drew

### Summary Screen (Labor Time) *
- [ ] #117 Add Labor Time calculation display - khan
- [ ] #118 Show breakdown: "15 min @ $0.50/min = $7.50 (includes 10 min buffer)" - khan

### Insurance API
- [ ] #81 Verify Redkik quote flow - erema
- [ ] #82 Test insurance logic end-to-end - erema

### Stripe Payments
- [ ] #83 Customer payment flow testing - drew
- [ ] #84 Driver payout (Stripe Connect) - drew
- [ ] #85 70% earnings calculation verification - drew

### Milestone 4 Deliverables
- [ ] Complete driver home screen with order notifications
- [ ] Order matching algorithm (distance + preferences)
- [ ] Working earnings dashboard with realtime sync
- [ ] Stripe payments tested (customer + driver)
- [ ] Insurance integration (pending Redkik API access)
- [ ] Full cross-platform testing (iOS + Android)
- [ ] App Store + Play Store submission

---

## Phase 2: Post-Launch Features

**Timeline:** TBD  
**Focus:** Advanced features post-launch

### Team & Helper Features
- [ ] Team option for drivers (display "Truck + Team")
- [ ] Team mode pricing adjustments

### Advanced AI Features
- [ ] Adjustable frame for AI photo analysis

### Communication
- [ ] Voice calls (Customer ↔ Driver)

### Booking Enhancements
- [ ] Multiple pickup/dropoff points
- [ ] Scheduled recurring deliveries

### Business Features
- [ ] Corporate accounts

### Financial Features
- [ ] In-app wallet system

### Analytics & Growth
- [ ] Advanced analytics dashboard for drivers
- [ ] Referral program (enhanced)

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

### Startup & Auth Optimizations (Completed)
- [x] **Auth Persistence**: Fix logout on restart (AsyncStorage implementation)
- [x] **Startup Speed**: Optimize map loading (immediate rendering from cache)
- [x] **Splash Screen**: Custom dark purple splash + smooth transition
- [x] **Login Flicker**: Fix login screen flashing on startup

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