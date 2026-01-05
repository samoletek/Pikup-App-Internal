# Temporary Code Comments

## Summary
Temporarily commented out problematic imports to prevent build errors during development.

## Changes Made

### CustomerClaimsScreen
- **File**: `screens/CustomerClaimsScreen.js`
- **Change**: Commented out document picker functionality
- **Reason**: Preventing build issues during development

### DriverOnboardingScreen  
- **File**: `screens/DriverOnboardingScreen.js`
- **Changes**: 
  - Commented out Stripe Identity import: `import { useStripeIdentity } from '@stripe/stripe-identity-react-native';`
  - Commented out `useStripeIdentity` hook usage (line 90)
  - Commented out verification status useEffect that depended on `status` (lines 93-107)
  - Commented out loading indicator that used `identityLoading` (lines 406-411)
  - Updated verify button to remove `present()` and `identityLoading` dependencies
  - Added placeholder alert "Will be back when server is running again!" instead of actual verification flow
- **Reason**: Preventing "Property 'useStripeIdentity' doesn't exist" runtime errors

## Next Steps
- Uncomment and properly implement document picker when needed
- Uncomment and properly implement Stripe Identity when ready for driver verification
- Remove this file once the temporary comments are resolved