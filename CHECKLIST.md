# Pikup App - Final 20% Checklist

## Critical Fixes

### Mapbox SDK Build
- [x] Debug iOS build failures with Mapbox - *Fixed: removed `RNMapboxMapsImpl`, updated deps*
- [x] Confirm `MAPBOX_DOWNLOAD_TOKEN` is picked up during build
- [ ] Verify `withMapboxNavigation.js` plugin works in EAS Cloud Build
- [ ] Test Mapbox Navigation SDK initialization on physical device

### Stripe Identity Verification
- [x] Uncomment `useStripeIdentity` import in `DriverOnboardingScreen.js`
- [x] Uncomment `useStripeIdentity` hook (line ~90)
- [x] Uncomment verification status useEffect (lines ~93-107)
- [x] Uncomment loading indicator (lines ~406-411)
- [x] Replace placeholder alert with actual `present()` flow
- [x] Test full driver identity verification flow

### Document Picker (Claims Screen)
- [x] Uncomment document picker import in `CustomerClaimsScreen.js`
- [x] Fix the error that caused it to be disabled
- [x] Test document upload for insurance claims

## API Verification

### Insurance API (Redkik)
- [ ] Test authentication with `REDKIK_CLIENT_ID` and `REDKIK_CLIENT_SECRET`
- [ ] Verify insurance quote flow for new items
- [ ] Test insurance logic: apply only to new items (per job description)
- [ ] Confirm insurance data saves to Firebase

### Stripe Payments
- [ ] Test customer payment flow end-to-end
- [/] Test driver payout via Stripe Connect - *Frontend ready, backend returns 500 error*
- [ ] Verify 70% driver earnings calculation works correctly

### Environment Variables
- [x] Confirm `.env.local` loads correctly in Expo
- [x] Test all Firebase operations (auth, Firestore, Storage) - [x] Fixed `pass-word` typo in AuthScreen.js

## New Features

### Feedback After Delivery
- [x] Create feedback UI component (star rating + comments)
- [x] Trigger feedback modal after `status === 'completed'`
- [x] Create `feedback` collection in Firebase
- [x] Store: `requestId`, `rating`, `comment`, `timestamp`
- [x] Show feedback in driver profile/stats

## Testing

### Functional Testing
- [ ] Customer flow: photo capture -> AI analysis -> address -> vehicle -> payment -> tracking
- [ ] Driver flow: onboarding -> accept request -> navigation -> pickup confirm -> delivery confirm
- [ ] Messaging between customer and driver
- [ ] Claims submission flow

### Cross-Platform
- [x] iOS Simulator testing
- [ ] iOS physical device testing
- [ ] Android Emulator testing
- [ ] Android physical device testing

## Deployment

### Pre-Submission
- [ ] Update `app.config.js` version number
- [ ] Remove any dev/debug logs
- [ ] Set `NODE_ENV=production` for server

### App Store (iOS)
- [ ] Create production EAS build
- [ ] Prepare App Store screenshots
- [ ] Write app description and keywords
- [ ] Submit for App Store Review

### Play Store (Android)
- [ ] Create production EAS build (AAB)
- [ ] Prepare Play Store screenshots
- [ ] Write app description
- [ ] Submit for Play Store Review

## Working iOS Build Configuration

### Key Package Versions
```json
{
  "react": "19.1.0",
  "react-native": "^0.81.5",
  "react-native-screens": "^4.19.0",
  "@react-native-community/cli": "^20.0.2",
  "@rnmapbox/maps": "10.2.10"
}
```

### Critical Configuration
- **NO `expo-dev-client`** - causes compile errors with Xcode 17 beta
- **NO `RNMapboxMapsImpl: "mapbox"`** in app.config.js - use default MapLibre
- Mapbox patch applied: `patches/@rnmapbox+maps+10.2.10.patch`

> [!CAUTION]
> **DO NOT UPDATE these packages** — will break iOS build:
> - `react-native-reanimated` — keep at `~3.17.4` (v4+ requires New Architecture)
> - `react-native-gesture-handler` — keep at `~2.24.0`
> - `expo-dev-client` — **DO NOT ADD** (causes Xcode 17 compile errors)
> 
> If you need to update dependencies, run `npm install` only. Never run `npm update`.

### New Developer Setup
```bash

git pull origin Release_1_1_0
npm install
npx expo prebuild --clean --platform ios
npx expo run:ios
```

### Important Notes
- Use `npx expo run:ios` NOT `npx expo start --ios` (Mapbox needs native build)
- Branch: `Release_1_1_0`

---

## Notes

- Branch: `Release_1_0_0`
- Backend: `https://pikup-server.onrender.com`
- Stripe keys are LIVE (not test) - be careful with payments

---

## Blocking Fixes (Outside Original Scope)

These fixes were required to unblock progress

- [x] Fix iOS build for Xcode 17 beta - updated dependencies, removed `expo-dev-client`
- [x] Fix driver onboarding navigation - new drivers now redirected to onboarding screen
- [x] Fix `pass-word` typo in AuthScreen.js that broke registration
- [x] Fix dateOfBirth parsing (NaN error) - handle both MMDDYYYY and MM/DD/YYYY formats
- [x] Fix terms acceptance screen skipping - reordered race condition in signup
- [x] Fix Driver Onboarding UX (6 items)
  - [x] Remove top car icon on welcome screen
  - [x] Fix verification button loading state (show in button, not above)
  - [x] Add input masks: phone `(XXX) XXX-XXXX`, DOB `MM/DD/YYYY`, name (no digits, min 2 chars)
  - [x] Add state picker dropdown with all US states
  - [x] Add masks: ZIP (5 digits), Year (4 digits), License Plate (uppercase, 2-8 chars)
  - [x] Remove top card icon on payment setup screen
  - [x] Consolidate verification button (3 states: default, loading inside button, success green checkmark)
  - [x] Add DOB validation (month 01-12, day 01-31, year 1900-2008)
  - [x] Clean up texts: move descriptions to headers, remove redundant titles (Welcome, Payment Setup)
  - [x] Fix consistent spacing: add top padding/margin (20px) to content in all steps
  - [x] Fix input sizing: remove width constraints from License Plate and ZIP (now 100% width)
  - [x] Match State Picker style exactly to text inputs (height, border, colors)
  - [x] Remove "(2-8 characters)" hint from License Plate label

---

## Out of Scope (Probably for Phase 2)

### UI/UX Improvements
- Fix layout (top/bottom blocks that content scrolls behind - content should go behind device edges like in popular apps)
- Scroll on auth screen - unclear why it's needed - (Replace with KeyboardAvoidingView. Please review)
- Logo positioning above search field
- Auth field validation (password can be 6 identical digits) - (done)
- Full onboarding redesign:
  - Add dropdown/autocomplete for address (with validation)
  - Add dynamic pickers for vehicle make, model, year, and color
  - Add input masks for phone number and date of birth
- Existing email still allows onboarding (signup with already registered email should show error, not proceed)

### Design System (Code Consistency)
> Currently all colors/fonts/spacing are hardcoded across 370+ files.

- Refactor components to use design tokens (remove hardcoded values)

### Reusable Components
- Create shared `Button` component with variants (primary, secondary, outlined)
- Create shared `Card` component with consistent styling
- Create shared `ModalBase` component with unified animations
- Create shared `Input` component with validation states

### Responsive Design
- Add `utils/responsive.js` with `scale()` / `fontScale()` utilities
- Apply responsive scaling to key UI elements for tablet support and different screen sizes

