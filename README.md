# Pikup 

Pikup is a React Native/Expo application. The app features dual interfaces for customers and drivers, with real-time tracking, payment processing, and AI-powered item analysis.

## 🏗️ Architecture Overview

### Core Structure
```
├── App.js                     # Main app entry point with provider setup
├── Navigation.js              # Stack navigation configuration
├── contexts/                  # React context providers for state management
├── screens/                   # All application screens
├── components/                # Reusable UI components and modals
├── services/                  # Business logic services
└── navigation/                # Tab navigator configurations
```

## Key Context Providers

### AuthContext (`contexts/AuthContext.js`)
**The heart of the application** - Manages all core functionality including:

- **Authentication**: User registration, login, logout using Firebase REST API
- **User Management**: Profile creation, updates, driver/customer role handling
- **Firebase Operations**: All Firestore data operations (users, pickupRequests, drivers)
- **Driver Earnings**: Calculation (80% of trip cost, $5 minimum), tracking, payout management
- **Request Management**: Creating, updating, and tracking pickup requests
- **Location Services**: Integration with location tracking and geocoding
- **Data Transformation**: `toFirestoreFormat()` and `fromFirestoreFormat()` helpers

**Key Functions:**
- `registerUser()`, `loginUser()`, `logoutUser()`
- `createPickupRequest()`, `updateRequestStatus()`
- `setupStripeConnect()`, `processDriverPayout()`
- `uploadUserData()`, `fetchUserProfile()`

### PaymentContext (`contexts/PaymentContext.js`)
Handles all customer payment processing:

- **Stripe Integration**: Payment methods, payment intents, checkout flow
- **Payment Processing**: Secure payment handling for pickup requests
- **Payment Methods**: Adding, removing, and managing customer payment methods
- **Error Handling**: Payment failures, network issues, validation

**Key Functions:**
- `createPaymentIntent()`, `confirmPayment()`
- `addPaymentMethod()`, `removePaymentMethod()`
- `processPayment()`, `handlePaymentError()`

### DemoContext (`contexts/DemoContext.js`)
Provides demo data and navigation utilities:

- **Mock Data**: Demo users, requests, and navigation helpers
- **Development Support**: Fallback data when services are unavailable
- **Navigation Utilities**: Helper functions for demo flows

**Note**: For new features, always modify **AuthContext**, not DemoContext, unless explicitly stated otherwise.

## 📱 Screen Structure

### Customer Screens (`screens/Customer*`)

#### CustomerTabNavigator
- **CustomerHomeScreen**: Main interface for creating pickup requests
- **CustomerActivityScreen**: View current and past pickup requests
- **CustomerMessagesScreen**: Chat interface with drivers
- **CustomerProfileScreen**: Profile management and settings

#### Key Customer Screens
- **PhotoCaptureScreen**: AI-powered item analysis using camera
- **PickupDropoffScreen**: Address selection and confirmation
- **VehicleSelectionScreen**: Choose appropriate vehicle type
- **PaymentScreen**: Payment method selection and processing
- **DeliveryTrackingScreen**: **THE MAIN TRACKING INTERFACE**

### Driver Screens (`screens/Driver*`)

#### DriverTabNavigator
- **DriverHomeScreen**: Accept/decline requests, navigation
- **DriverEarningsScreen**: Earnings tracking and payout management
- **DriverMessagesScreen**: Chat interface with customers
- **DriverProfileScreen**: Profile and vehicle information

#### Key Driver Screens
- **DriverOnboardingScreen**: Stripe Connect setup and vehicle registration
- **DriverRequestScreen**: View and accept available requests
- **DriverNavigationScreen**: GPS navigation to pickup/dropoff locations

### Shared Screens
- **MessagingScreen**: Real-time chat between customers and drivers
- **PaymentMethodsScreen**: Manage payment methods

### Unused/Deprecated Screens
The following screens exist but are not actively used:
- **TestDataScreen**: Development testing interface (deprecated)
- **RouteConfirmationScreen**: Route planning (functionality moved to other screens)
- **firebasefirestore file**: Deprecated Firebase operations (all moved to AuthContext)

## DeliveryTrackingScreen - The Customer Tracking Hub

**File**: `screens/DeliveryTrackingScreen.js`

This is the **primary tracking interface** for customers and handles all real-time tracking functionality:

### Core Functionality
- **Real-time Driver Tracking**: Updates driver location every 5 seconds
- **Order Status Management**: Displays current status (accepted, inProgress, arrivedAtPickup, etc.)
- **Interactive Map**: Shows customer location, driver location, and route
- **Status Updates**: Real-time notifications as order progresses
- **Communication**: Direct messaging with assigned driver
- **Delivery Confirmation**: Photo verification and completion handling

### Status Flow Tracking
```
pending → accepted → inProgress → arrivedAtPickup → pickedUp → enRouteToDropoff → completed
```

### Key Features
- **Live Location Updates**: Customer can see exactly where their driver is
- **ETA Calculations**: Real-time estimated arrival times
- **Photo Confirmations**: Displays pickup and delivery confirmation photos
- **Status Notifications**: Clear visual indicators of order progress
- **Driver Contact**: Call or message driver directly from the screen
- **Order Details**: Shows item information, addresses, and pricing

### Integration Points
- **AuthContext**: Fetches request data and driver information
- **LocationService**: Real-time location tracking
- **MessagingScreen**: Direct chat with driver
- **PaymentContext**: Final payment processing

## Services

### LocationService (`services/LocationService.js`)
- **Position Tracking**: Current location, background tracking
- **Geocoding**: Address to coordinates conversion
- **Route Calculation**: Google Maps integration
- **Permission Handling**: Location access permissions

### AIImageService (`services/AIImageService.js`)
- **Google Gemini Vision API**: Analyzes photos of items to be picked up
- **Weight Estimation**: Automatic weight calculation
- **Help Requirements**: Determines if additional help is needed
- **Item Categorization**: For pricing and vehicle selection

## Navigation Structure

### Navigation.js
- **Stack Navigator**: Main app navigation structure
- **Route Definitions**: All screen imports and routing
- **Navigation Types**: TypeScript navigation types (if applicable)

### Tab Navigators
- **CustomerTabNavigator** (`navigation/CustomerTabNavigator.js`): Customer interface tabs
- **DriverTabNavigator** (`navigation/DriverTabNavigator.js`): Driver interface tabs

## Firebase Integration

### Collections
- **users**: Customer and driver profiles
- **pickupRequests**: All pickup/delivery requests
- **drivers**: Driver-specific information and earnings

### Data Flow
- All Firebase operations go through **AuthContext**
- Data transformation via `toFirestoreFormat()` and `fromFirestoreFormat()`
- Authentication state handled in all operations
- Real-time listeners for live updates

## Payment System

### Customer Payments
- **Stripe Integration**: Secure payment processing
- **Payment Methods**: Credit/debit card management
- **Payment Intents**: Secure payment confirmation

### Driver Payouts
- **Stripe Connect**: Direct payouts to driver accounts
- **Earnings Calculation**: 80% of trip cost with $5 minimum
- **Payout Management**: Real-time earnings tracking

### Payment Flow
1. Customer selects payment method
2. Payment intent created via PaymentContext
3. Payment processed securely through Stripe
4. Driver earnings calculated and tracked
5. Automatic payout processing

## AI Integration

### Google Gemini Vision API
- **Item Analysis**: Analyzes photos to determine item details
- **Weight Estimation**: Automatic weight calculation for pricing
- **Help Requirements**: Determines if lifting assistance is needed
- **Pricing Support**: Helps determine appropriate vehicle and pricing

## 📱 Platform Configuration

### Environment Variables
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_STRIPE_MERCHANT_ID=merchant.com.pikup
EXPO_PUBLIC_URL_SCHEME=pikup
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

### Platform-Specific Handling
- **Android**: Uses `10.0.2.2` for localhost connections from emulator
- **iOS**: Uses `localhost` for simulator connections
- **Payment Service**: Platform-specific URLs in AuthContext

## 🚀 Development Commands

### Start Development
```bash
npm start              # Start Expo development server
npm run android        # Run on Android emulator/device
npm run ios            # Run on iOS simulator/device
npm run web            # Run in web browser
```

### Build Commands
```bash
# Development build
npx eas build --platform android --profile development
npx eas build --platform ios --profile development

# Production build
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

## 🧪 Testing

- **No test framework currently configured**
- **Mock Data**: Uses demo data when services unavailable
- **Payment Testing**: Stripe test environment for development
- **Platform Testing**: Android emulator and iOS simulator support

##  Key Files Reference

### Essential Files
- **App.js**: Main entry point with all providers
- **Navigation.js**: Complete navigation structure
- **contexts/AuthContext.js**: Core business logic and Firebase operations
- **contexts/PaymentContext.js**: Payment processing
- **screens/DeliveryTrackingScreen.js**: Main customer tracking interface

### Component Structure
- **components/**: Reusable UI components and modals
- **screens/Customer***: Customer-facing screens
- **screens/Driver***: Driver-facing screens
- **services/**: Business logic services

### Configuration
- **app.json**: Expo configuration
- **eas.json**: Build configuration
- **.env**: Environment variables (contains API keys)

##  Security Notes

- **API Keys**: Stored in .env file (needs security review for production)
- **Payment Security**: Stripe handles all sensitive payment data
- **Firebase Security**: Uses Firebase security rules
- **Authentication**: Secure token-based authentication


## Issues and also Next Steps
- Mapbox sdk needs to be properly configured, currently has issues with the cloud building and the sourcing in the soruce files at build time
- Insurance needs to be tested along with driver side once insurance is in and mapbox
- Stripe identity needs to be reimplemented since its commented out while server isnt running
- Put back in the document picker module for the claims screen since it was giving a error si i cmmented out for now

## Services / API's Needed
- Firebase database
- Render server with env variables needed
- Stripe Keys
- Google Map Key
- Google Gemini Key
- Mapbox Download and Public Key


## 📱 Screen Photos

### Customer Screens
<div align="center">
  <img src="assets/homescreen.png" alt="Home Screen" width="200"/>
  <img src="assets/details.png" alt="Order Details" width="200"/>
  <img src="assets/location.png" alt="Location Tracking" width="200"/>
</div>

<div align="center">
  <img src="assets/price.png" alt="Pricing" width="200"/>
  <img src="assets/vehicle.png" alt="Vehicle Selection" width="200"/>
</div>

### Driver Screens
<div align="center">
  <img src="assets/driverhome.png" alt="Driver Home" width="200"/>
  <img src="assets/driverprofile.png" alt="Driver Profile" width="200"/>
  <img src="assets/earnings.png" alt="Driver Earnings" width="200"/>
</div>

### Authentication & Setup
<div align="center">
  <img src="assets/login.png" alt="Login Screen" width="200"/>
  <img src="assets/login2.png" alt="Login Screen 2" width="200"/>
  <img src="assets/roleselect.png" alt="Role Selection" width="200"/>
</div>

<div align="center">
  <img src="assets/offline.png" alt="Offline Mode" width="200"/>
</div>

##  Key Features

### Customer Experience
1. **Photo Capture** → **AI Analysis** → **Address Selection** → **Vehicle Selection** → **Payment** → **Driver Matching**
2. **Real-time Tracking** via DeliveryTrackingScreen
3. **Delivery Confirmation** with photos
4. **Rating System** and feedback

### Driver Experience
1. **Driver Onboarding** with Stripe Connect setup
2. **Request Acceptance** and navigation
3. **Pickup/Delivery Confirmation** with photos
4. **Earnings Tracking** and payout management
