export const RECENT_ADDRESSES_KEY = '@pikup_recent_addresses';
export const MAX_RECENT_ADDRESSES = 5;

export const STEPS = [
    { id: 1, title: 'Where to?' },
    { id: 2, title: 'What are you moving?' },
    { id: 3, title: 'Pickup Details' },
    { id: 4, title: 'Dropoff Details' },
    { id: 5, title: 'Select Vehicle' },
    { id: 6, title: 'Review & Confirm' }
];

export const createLocationDetailsDefaults = () => ({
    locationType: 'store',
    storeName: '',
    orderConfirmationNumber: '',
    buildingName: '',
    unitNumber: '',
    floor: '',
    hasElevator: null,
    numberOfStairs: 1,
    driverHelpsLoading: false,
    driverHelpsUnloading: false,
    notes: '',
});

export const createAiVehicleRecommendationDefaults = () => ({
    status: 'idle',
    requestFingerprint: null,
    requestedAt: null,
    completedAt: null,
    summary: '',
    recommendedVehicleId: null,
    fitByVehicle: {},
    loadingEstimate: '',
    unloadingEstimate: '',
    step6Description: '',
    notes: '',
    error: null,
});

export const createInitialOrderData = () => ({
    pickup: { address: '', coordinates: null },
    dropoff: { address: '', coordinates: null },
    scheduleType: 'asap',
    scheduledDateTime: null,
    items: [],
    pickupDetails: createLocationDetailsDefaults(),
    dropoffDetails: { ...createLocationDetailsDefaults(), locationType: 'apartment' },
    selectedVehicle: null,
    selectedPaymentMethodId: null,
    distance: null,
    duration: null,
    pricing: null,
    aiVehicleRecommendation: createAiVehicleRecommendationDefaults(),
});
