# Apple HIG Audit Matrix

This document tracks the current UI alignment with Apple HIG principles by screen group.

Legend:
- `Aligned`: current implementation follows the app's modernized iOS pattern (safe area, hierarchy, spacing, interactive affordances).
- `Partial`: mostly usable, but still has legacy/hardcoded UI patterns.
- `Needs Pass`: legacy layout/header/spacing and should be refactored in next iteration.

## Customer Screens

| Screen | Status | Notes |
|---|---|---|
| `CustomerHomeScreen` | Aligned | Simplified to clean map + tracker + order trigger flow with responsive layout and theme-token consistency. |
| `CustomerActivityScreen` | Aligned | Uses collapsible top pattern and empty-state behavior. |
| `CustomerMessagesScreen` | Aligned | Uses collapsible top pattern and updated conversation list behavior. |
| `CustomerProfileScreen` | Aligned | Uses collapsible top pattern and account search/menu structure. |
| `CustomerPersonalInfoScreen` | Aligned | Updated with responsive max-width column, grouped section hierarchy, and tokenized spacing across forms and account controls. |
| `CustomerSettingsScreen` | Aligned | Uses shared header, responsive max-width column, and consistent grouped settings layout aligned with iOS account patterns. |
| `CustomerWalletScreen` | Aligned | Updated with responsive max-width grouping and consistent card/list hierarchy for payment methods and activity. |
| `CustomerClaimsScreen` | Aligned | Updated with shared header, responsive max-width sections/lists, and tokenized spacing for cards/modal/forms. |
| `CustomerHelpScreen` | Aligned | Migrated to shared HIG placeholder template. |
| `CustomerSafetyScreen` | Aligned | Migrated to shared HIG placeholder template. |
| `PaymentMethodsScreen` | Aligned | Migrated to shared HIG placeholder template. |
| `DeliveryTrackingScreen` | Aligned | Migrated to shared HIG placeholder template. |
| `OrderSummaryScreen` | Aligned | Uses shared header, responsive max-width layout, and consistent bottom CTA behavior across device sizes. |

## Driver Screens

| Screen | Status | Notes |
|---|---|---|
| `DriverHomeScreen` | Partial | Overlay visuals/token usage and responsive bottom panel improved; final micro-interaction polish remains. |
| `DriverEarningsScreen` | Aligned | Updated to collapsible top pattern; visual consistency improved. |
| `DriverMessagesScreen` | Aligned | Updated to collapsible top pattern and cleaned top content. |
| `DriverProfileScreen` | Aligned | Updated to collapsible top pattern and account search/menu structure. |
| `DriverPreferencesScreen` | Aligned | Rebuilt into grouped iOS-style settings sections with immediate persistence and responsive max-width layout. |
| `DriverPaymentSettingsScreen` | Aligned | Migrated to shared header and theme-token visual system with consistent payment cards/actions. |
| `DriverOnboardingScreen` | Partial | Added keyboard-safe layout, responsive header/bottom constraints, and picker token cleanup; final micro polish remains. |
| `DriverOnboardingCompleteScreen` | Aligned | Migrated to shared header, tokenized spacing/typography, and cleaned completion flow visuals. |
| `RouteConfirmationScreen` | Aligned | Updated with responsive max-width layout, card hierarchy cleanup, and tokenized CTA/form spacing. |
| `EnRouteToPickupScreen` | Partial | Tokenized overlays/buttons and spacing cleanup completed; still needs deeper iOS motion polish for transitions. |
| `GpsNavigationScreen` | Partial | Extended tokenization/spacing cleanup and responsive bottom overlays; still needs deeper navigation-specific interaction polish. |
| `DeliveryNavigationScreen` | Partial | Extended tokenization/spacing cleanup and responsive bottom overlays; still needs deeper navigation-specific interaction polish. |
| `PickupConfirmationScreen` | Aligned | Updated to responsive confirmation layout with centered max-width content and consistent bottom action behavior. |
| `DeliveryConfirmationScreen` | Aligned | Updated to responsive confirmation layout with normalized hierarchy, tokenized spacing, and unified bottom CTA pattern. |

## Shared Screens

| Screen | Status | Notes |
|---|---|---|
| `WelcomeScreen` | Aligned | Responsive brand entry screen with consistent CTA sizing, spacing hierarchy, and safe-area behavior. |
| `AuthScreen` | Aligned | Responsive auth form with max-width constraints, cleaner hierarchy, and consistent control states. |
| `MessageScreen` | Aligned | Updated with safe keyboard behavior, responsive max-width column, and consistent input composer spacing. |
| `DeliveryFeedbackScreen` | Aligned | Updated with responsive max-width form layout, normalized card/bottom action spacing, and tokenized typography sizing. |

## Next Priority Order

1. Driver onboarding flow: `DriverOnboardingScreen`
2. Navigation execution screens: `EnRouteToPickupScreen`, `GpsNavigationScreen`, `DeliveryNavigationScreen`
3. Driver home/dashboard interaction polish: `DriverHomeScreen`
4. Shared flow edge-cases: regression sweep across feedback/chat states
