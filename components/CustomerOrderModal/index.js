import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Keyboard, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseModal from '../BaseModal';
import LocationDetailsStep from '../order/LocationDetailsStep';
import { styles, SCREEN_WIDTH, SCREEN_HEIGHT } from './styles';
import { colors } from '../../styles/theme';
import { usePayment } from '../../contexts/PaymentContext';
import { calculatePrice, getVehicleRates } from '../../services/PricingService';
import MapboxLocationService from '../../services/MapboxLocationService';
import { recommendVehicleForItems } from '../../services/AIService';

// Step Components
import AddressSearchStep from './steps/AddressSearchStep';
import ItemsStep from './steps/ItemsStep';
import VehicleStep from './steps/VehicleStep';
import ReviewStep from './steps/ReviewStep';

// ============================================
// CONSTANTS
// ============================================
const RECENT_ADDRESSES_KEY = '@pikup_recent_addresses';
const MAX_RECENT_ADDRESSES = 5;

const STEPS = [
    { id: 1, title: 'Where to?' },
    { id: 2, title: 'What are you moving?' },
    { id: 3, title: 'Pickup Details' },
    { id: 4, title: 'Dropoff Details' },
    { id: 5, title: 'Select Vehicle' },
    { id: 6, title: 'Review & Confirm' }
];

const createLocationDetailsDefaults = () => ({
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

const createAiVehicleRecommendationDefaults = () => ({
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

const normalizeItemText = (value) => (value || '').trim().toLowerCase();

const buildItemsFingerprint = (items = []) => {
    const normalized = (items || []).map(item => ({
        name: normalizeItemText(item.name),
        description: normalizeItemText(item.description),
        condition: normalizeItemText(item.condition || 'used'),
        fragile: !!item.isFragile,
        insured: !!item.hasInsurance,
        weight: Number(item.weightEstimate) || 0,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    return JSON.stringify(normalized);
};

const buildItemsSummary = (items = []) => {
    const grouped = new Map();
    let totalWeight = 0;

    (items || []).forEach(item => {
        const name = (item.name || 'Unnamed item').trim();
        const description = (item.description || '').trim();
        const condition = (item.condition || 'used').trim();
        const fragile = !!item.isFragile;
        const insured = !!item.hasInsurance;
        const weight = Number(item.weightEstimate) || 0;
        totalWeight += weight;

        const key = `${name}|${description}|${condition}|${fragile}|${insured}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                name,
                description,
                condition,
                fragile,
                insured,
                count: 0,
                weight: 0,
            });
        }

        const entry = grouped.get(key);
        entry.count += 1;
        entry.weight += weight;
    });

    const lines = Array.from(grouped.values()).map((entry, index) => {
        const attributes = [
            `${entry.count}x`,
            entry.name,
            `condition: ${entry.condition}`,
            `fragile: ${entry.fragile ? 'yes' : 'no'}`,
            `insured: ${entry.insured ? 'yes' : 'no'}`,
            `est weight total: ${entry.weight} lbs`,
        ];

        if (entry.description) {
            attributes.push(`description: ${entry.description}`);
        }

        return `${index + 1}. ${attributes.join('; ')}`;
    });

    return [
        `Total distinct lines: ${grouped.size}`,
        `Total items count: ${items.length}`,
        `Estimated total weight: ${totalWeight} lbs`,
        'Items:',
        ...lines,
    ].join('\n');
};

// ============================================
// MAIN COMPONENT
// ============================================
const CustomerOrderModal = ({ visible, onClose, onConfirm, userLocation, renderPhoneVerification }) => {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(1);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { paymentMethods, defaultPaymentMethod } = usePayment();

    // Order Data State
    const [orderData, setOrderData] = useState({
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

    // Recent addresses (for Step 1)
    const [recentAddresses, setRecentAddresses] = useState([]);

    // Step 2 specific state
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [itemErrors, setItemErrors] = useState({});

    // Pricing preview for ReviewStep (step 6)
    const [previewPricing, setPreviewPricing] = useState(null);

    // ============================================
    // EFFECTS
    // ============================================
    useEffect(() => {
        if (visible) {
            loadRecentAddresses();
        }
    }, [visible]);

    const resetState = () => {
        setCurrentStep(1);
        setOrderData({
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
        setExpandedItemId(null);
        setItemErrors({});
        setPreviewPricing(null);
        setIsSubmitting(false);
    };

    useEffect(() => {
        if (!visible) return;

        const fallbackMethodId = defaultPaymentMethod?.id || paymentMethods?.[0]?.id || null;
        if (!fallbackMethodId) return;

        setOrderData(prev => {
            if (prev.selectedPaymentMethodId) {
                const methodStillExists = paymentMethods?.some(method => method.id === prev.selectedPaymentMethodId);
                if (methodStillExists) {
                    return prev;
                }
            }

            return { ...prev, selectedPaymentMethodId: fallbackMethodId };
        });
    }, [visible, paymentMethods, defaultPaymentMethod]);

    // ============================================
    // ROUTE CALCULATION
    // ============================================
    useEffect(() => {
        const pickupCoords = orderData.pickup?.coordinates;
        const dropoffCoords = orderData.dropoff?.coordinates;

        if (!pickupCoords || !dropoffCoords) return;

        let cancelled = false;

        const fetchRoute = async () => {
            try {
                const route = await MapboxLocationService.getRoute(pickupCoords, dropoffCoords);
                if (cancelled) return;

                const miles = parseFloat((route.distance.value / 1609.34).toFixed(1));
                const minutes = Math.round(route.duration.value / 60);

                setOrderData(prev => ({ ...prev, distance: miles, duration: minutes }));
            } catch (error) {
                console.error('Failed to calculate route:', error);
            }
        };

        fetchRoute();

        return () => { cancelled = true; };
    }, [orderData.pickup?.coordinates, orderData.dropoff?.coordinates]);

    // ============================================
    // RECENT ADDRESSES
    // ============================================
    const loadRecentAddresses = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
            if (stored) setRecentAddresses(JSON.parse(stored));
        } catch (error) {
            console.log('Failed to load recent addresses:', error);
        }
    };

    const saveToRecentAddresses = async (place) => {
        try {
            const newRecent = [
                place,
                ...recentAddresses.filter(item => item.id !== place.id)
            ].slice(0, MAX_RECENT_ADDRESSES);
            setRecentAddresses(newRecent);
            await AsyncStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(newRecent));
        } catch (error) {
            console.log('Failed to save recent address:', error);
        }
    };

    // ============================================
    // NAVIGATION
    // ============================================
    const goToStep = (step, direction = 'forward') => {
        const toValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
        Animated.timing(slideAnim, {
            toValue,
            duration: 200,
            useNativeDriver: true
        }).start(() => {
            setCurrentStep(step);
            slideAnim.setValue(-toValue);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
            }).start();
        });
    };

    const handleBack = () => {
        Keyboard.dismiss();
        if (currentStep > 1) goToStep(currentStep - 1, 'backward');
    };

    const hasOrderChanges = () => {
        return (
            orderData.pickup.address.trim() !== '' ||
            orderData.dropoff.address.trim() !== '' ||
            orderData.items.length > 0 ||
            orderData.selectedVehicle !== null
        );
    };

    const closeAndReset = () => {
        resetState();
        onClose();
    };

    const handleClose = () => {
        if (!hasOrderChanges()) {
            closeAndReset();
            return;
        }
        Alert.alert('Cancel Order?', 'Your progress will be lost.', [
            { text: 'Keep Editing', style: 'cancel' },
            {
                text: 'Cancel Order', style: 'destructive', onPress: () => {
                    closeAndReset();
                }
            }
        ]);
    };

    // ============================================
    // VALIDATION
    // ============================================
    const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');

    const parseFloorNumber = (value) => {
        const normalized = String(value ?? '').replace(/[^0-9]/g, '');
        if (!normalized) return null;

        const parsed = parseInt(normalized, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };

    const extractApartmentFloor = (locationDetails) => {
        const explicitFloor = parseFloorNumber(locationDetails?.floor);
        if (explicitFloor !== null) return explicitFloor;

        const unitText = trimValue(locationDetails?.unitNumber);
        const floorMatch = unitText.match(/(?:floor|fl\.?|flr\.?|lvl|level)\s*#?\s*(\d{1,3})/i);
        if (!floorMatch?.[1]) return null;

        return parseInt(floorMatch[1], 10);
    };

    const validateLocationDetails = (locationDetails, label) => {
        const rawLocationType = locationDetails.locationType || 'store';
        const locationType = rawLocationType === 'house_other' ? 'residential_other' : rawLocationType;

        if (locationType === 'store') {
            if (!trimValue(locationDetails.storeName)) {
                return `Please enter the store or business name for ${label}.`;
            }
            return null;
        }

        if (locationType === 'apartment') {
            if (!trimValue(locationDetails.buildingName)) {
                return `Please enter the building name/number for ${label}.`;
            }

            if (!trimValue(locationDetails.unitNumber)) {
                return `Please enter the unit/apartment number for ${label}.`;
            }

            if (trimValue(locationDetails.floor) && parseFloorNumber(locationDetails.floor) === null) {
                return `Please enter a valid floor number for ${label}.`;
            }

            const detectedFloor = extractApartmentFloor(locationDetails);
            if (
                detectedFloor &&
                detectedFloor > 1 &&
                locationDetails.hasElevator !== true &&
                locationDetails.hasElevator !== false
            ) {
                return `Please specify if there is a working elevator for ${label}.`;
            }

            return null;
        }

        if (locationType === 'residential_other') {
            return null;
        }

        return null;
    };

    const validateStep = () => {
        switch (currentStep) {
            case 1:
                if (!orderData.pickup.address.trim()) {
                    Alert.alert('Missing Info', 'Please enter a pickup address.');
                    return false;
                }
                if (!orderData.dropoff.address.trim()) {
                    Alert.alert('Missing Info', 'Please enter a dropoff address.');
                    return false;
                }
                if (orderData.pickup.address.trim().toLowerCase() === orderData.dropoff.address.trim().toLowerCase()) {
                    Alert.alert('Same Address', 'Pickup and dropoff addresses cannot be the same.');
                    return false;
                }
                return true;
            case 2: {
                if (orderData.items.length === 0) {
                    Alert.alert('Missing Info', 'Please add at least one item.');
                    return false;
                }

                const errors = {};
                let firstErrorItemId = null;

                orderData.items.forEach(item => {
                    const itemErr = {};
                    const normalizedCondition = String(item.condition || '').trim().toLowerCase();
                    const hasValidCondition = normalizedCondition === 'new' || normalizedCondition === 'used';
                    const insuranceEnabledForNew = normalizedCondition === 'new' && item.hasInsurance === true;

                    if (!item.name?.trim()) itemErr.name = true;
                    if (!Array.isArray(item.photos) || item.photos.length === 0) itemErr.photos = true;
                    if (!hasValidCondition) itemErr.condition = true;
                    if (normalizedCondition === 'new' && !String(item.value || '').trim()) itemErr.value = true;
                    if (insuranceEnabledForNew && !item.invoicePhoto) itemErr.invoice = true;

                    if (Object.keys(itemErr).length > 0) {
                        errors[item.id] = itemErr;
                        if (!firstErrorItemId) firstErrorItemId = item.id;
                    }
                });

                if (Object.keys(errors).length > 0) {
                    setItemErrors(errors);
                    setExpandedItemId(firstErrorItemId);

                    const firstErr = errors[firstErrorItemId];
                    if (firstErr.name) {
                        Alert.alert('Missing Info', 'Please enter a name for all items.');
                    } else if (firstErr.photos) {
                        Alert.alert('Missing Info', 'Please add at least one photo for every item.');
                    } else if (firstErr.condition) {
                        Alert.alert('Missing Info', 'Please select a condition (New or Used) for all items.');
                    } else if (firstErr.value) {
                        Alert.alert('Missing Info', 'Please enter a value for new items.');
                    } else if (firstErr.invoice) {
                        Alert.alert('Missing Invoice', 'Please upload an invoice for insured items to confirm they are new.');
                    }
                    return false;
                }

                const firstUnconfirmedItem = orderData.items.find(item => item.isConfirmed !== true);
                if (firstUnconfirmedItem) {
                    setExpandedItemId(firstUnconfirmedItem.id);
                    Alert.alert('Confirm Items', 'Please tap "Add" on every item card before continuing.');
                    return false;
                }

                setItemErrors({});
                return true;
            }
            case 3:
                {
                    const pickupError = validateLocationDetails(orderData.pickupDetails, 'pickup');
                    if (pickupError) {
                        Alert.alert('Missing Info', pickupError);
                        return false;
                    }
                    return true;
                }
            case 4:
                {
                    const dropoffError = validateLocationDetails(orderData.dropoffDetails, 'dropoff');
                    if (dropoffError) {
                        Alert.alert('Missing Info', dropoffError);
                        return false;
                    }
                    return true;
                }
            case 5:
                if (!orderData.selectedVehicle) {
                    Alert.alert('Missing Info', 'Please select a vehicle.');
                    return false;
                }
                return true;
            case 6:
                if (!orderData.selectedPaymentMethodId) {
                    Alert.alert('Payment Method Required', 'Please select a saved payment method to continue.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    const handleContinue = async () => {
        Keyboard.dismiss();
        if (isSubmitting) return;
        if (!validateStep()) return;

        const triggerVehicleRecommendation = async (itemsSnapshot) => {
            const validItems = (itemsSnapshot || []).filter(item => item?.name?.trim());
            if (validItems.length === 0) return;

            const requestFingerprint = buildItemsFingerprint(validItems);
            const summary = buildItemsSummary(validItems);

            setOrderData(prev => {
                const currentAi = prev.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
                if (
                    currentAi.requestFingerprint === requestFingerprint &&
                    (currentAi.status === 'loading' || currentAi.status === 'success')
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    aiVehicleRecommendation: {
                        ...currentAi,
                        status: 'loading',
                        requestFingerprint,
                        requestedAt: new Date().toISOString(),
                        completedAt: null,
                        summary,
                        loadingEstimate: '',
                        unloadingEstimate: '',
                        step6Description: '',
                        notes: '',
                        error: null,
                    },
                };
            });

            try {
                const vehicles = await getVehicleRates();
                const recommendation = await recommendVehicleForItems({
                    itemSummary: summary,
                    items: validItems,
                    vehicles,
                });

                setOrderData(prev => {
                    const currentAi = prev.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
                    if (currentAi.requestFingerprint !== requestFingerprint) {
                        return prev;
                    }

                    const selectedVehicleId = prev.selectedVehicle?.id;
                    const selectedIsTooSmall = selectedVehicleId
                        ? recommendation?.fitByVehicle?.[selectedVehicleId]?.fits === false
                        : false;

                    return {
                        ...prev,
                        selectedVehicle: selectedIsTooSmall ? null : prev.selectedVehicle,
                        aiVehicleRecommendation: {
                            ...currentAi,
                            status: 'success',
                            completedAt: new Date().toISOString(),
                            recommendedVehicleId: recommendation.recommendedVehicleId || null,
                            fitByVehicle: recommendation.fitByVehicle || {},
                            loadingEstimate: recommendation.loadingEstimate || '',
                            unloadingEstimate: recommendation.unloadingEstimate || '',
                            step6Description: recommendation.step6Description || '',
                            notes: recommendation.notes || recommendation.step6Description || '',
                            error: null,
                        },
                    };
                });
            } catch (error) {
                setOrderData(prev => {
                    const currentAi = prev.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
                    if (currentAi.requestFingerprint !== requestFingerprint) {
                        return prev;
                    }

                    return {
                        ...prev,
                        aiVehicleRecommendation: {
                            ...currentAi,
                            status: 'error',
                            completedAt: new Date().toISOString(),
                            error: error?.message || 'Vehicle recommendation failed',
                        },
                    };
                });
            }
        };

        const continueAfterStepTwo = () => {
            const itemsSnapshot = [...orderData.items];
            triggerVehicleRecommendation(itemsSnapshot);
            goToStep(currentStep + 1, 'forward');
        };

        // Show AI review prompt when leaving step 2 with AI-detected items
        if (currentStep === 2 && orderData.items.some(item => item.addedByAI)) {
            Alert.alert(
                'Review AI Results',
                'We recommend reviewing the items detected by AI before continuing.',
                [
                    {
                        text: 'Review',
                        style: 'cancel',
                    },
                    {
                        text: 'Continue',
                        onPress: continueAfterStepTwo,
                    }
                ]
            );
            return;
        }

        if (currentStep === 2) {
            continueAfterStepTwo();
            return;
        }

        if (currentStep < 6) {
            // Pre-compute pricing when entering Review step
            if (currentStep === 5) {
                calculatePricing().then(p => setPreviewPricing(p));
            }
            goToStep(currentStep + 1, 'forward');
        } else {
            const selectedPaymentMethod = paymentMethods?.find(method => method.id === orderData.selectedPaymentMethodId) || null;
            const pricing = await calculatePricing();
            const finalOrder = {
                ...orderData,
                pricing,
                selectedPaymentMethod,
            };

            try {
                setIsSubmitting(true);
                const result = await onConfirm(finalOrder);

                if (result?.success === false) {
                    Alert.alert('Payment Issue', result.error || 'Unable to complete payment. Please try again.');
                }
            } catch (error) {
                Alert.alert('Payment Issue', error?.message || 'Unable to complete payment. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // ============================================
    // PRICING CALCULATION
    // ============================================
    const calculatePricing = async () => {
        const vehicle = orderData.selectedVehicle;
        if (!vehicle) return null;

        const distance = orderData.distance || 10;
        const duration = orderData.duration || 0;

        return calculatePrice(vehicle, distance, duration, {
            items: orderData.items || [],
            laborOptions: {
                items: orderData.items || [],
                pickupDetails: orderData.pickupDetails || {},
                dropoffDetails: orderData.dropoffDetails || {},
            },
        });
    };

    // ============================================
    // RENDER CURRENT STEP
    // ============================================
    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <AddressSearchStep
                        orderData={orderData}
                        setOrderData={setOrderData}
                        userLocation={userLocation}
                        recentAddresses={recentAddresses}
                        saveToRecentAddresses={saveToRecentAddresses}
                    />
                );
            case 2:
                return (
                    <ItemsStep
                        orderData={orderData}
                        setOrderData={setOrderData}
                        expandedItemId={expandedItemId}
                        setExpandedItemId={setExpandedItemId}
                        itemErrors={itemErrors}
                        setItemErrors={setItemErrors}
                    />
                );
            case 3:
                return (
                    <LocationDetailsStep
                        address={orderData.pickup.address}
                        type="pickup"
                        details={orderData.pickupDetails}
                        onUpdate={(details) =>
                            setOrderData(prev => {
                                const normalizedHelpPreference =
                                    typeof details.driverHelpsLoading === 'boolean'
                                        ? details.driverHelpsLoading
                                        : typeof details.driverHelp === 'boolean'
                                            ? details.driverHelp
                                            : prev.pickupDetails?.driverHelpsLoading ?? false;

                                return {
                                    ...prev,
                                    pickupDetails: {
                                        ...details,
                                        driverHelpsLoading: normalizedHelpPreference,
                                    },
                                    dropoffDetails: {
                                        ...prev.dropoffDetails,
                                        driverHelpsUnloading: normalizedHelpPreference,
                                    },
                                };
                            })
                        }
                    />
                );
            case 4:
                return (
                    <LocationDetailsStep
                        address={orderData.dropoff.address}
                        type="dropoff"
                        details={orderData.dropoffDetails}
                        onUpdate={(details) => setOrderData(prev => ({ ...prev, dropoffDetails: details }))}
                    />
                );
            case 5:
                return (
                    <VehicleStep
                        orderData={orderData}
                        setOrderData={setOrderData}
                    />
                );
            case 6: {
                const selectedPaymentMethod = paymentMethods?.find(method => method.id === orderData.selectedPaymentMethodId) || null;
                return (
                    <ReviewStep
                        orderData={orderData}
                        pricing={previewPricing}
                        onNavigateToStep={setCurrentStep}
                        paymentMethods={paymentMethods || []}
                        selectedPaymentMethod={selectedPaymentMethod}
                        defaultPaymentMethodId={defaultPaymentMethod?.id || null}
                        onSelectPaymentMethod={(method) =>
                            setOrderData(prev => ({ ...prev, selectedPaymentMethodId: method?.id || null }))
                        }
                    />
                );
            }
            default:
                return null;
        }
    };

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <BaseModal
            visible={visible}
            onClose={closeAndReset}
            onBackdropPress={handleClose}
            height={SCREEN_HEIGHT * 0.9}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={false}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    {currentStep > 1 ? (
                        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerBtn} />
                    )}

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{STEPS[currentStep - 1].title}</Text>
                        <Text style={styles.headerStep}>Step {currentStep} of {STEPS.length}</Text>
                    </View>

                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                        <Ionicons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>
            )}
        >
            <View style={styles.container}>
                {/* Progress Bar */}
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(currentStep / STEPS.length) * 100}%` }]} />
                </View>

                {/* Step Content with Animation */}
                <Animated.View style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
                    {renderCurrentStep()}
                </Animated.View>

                {/* Continue Button */}
                <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : 12 }]}>
                    <TouchableOpacity
                        style={[
                            styles.continueBtn,
                            currentStep === 6 && { backgroundColor: colors.success },
                            isSubmitting && styles.continueBtnDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={isSubmitting}
                    >
                        <Text style={[styles.continueBtnText, currentStep === 6 && { marginRight: 0 }, isSubmitting && styles.continueBtnTextDisabled]}>
                            {isSubmitting ? 'Processing...' : currentStep === 6 ? 'Confirm & Pay' : 'Continue'}
                        </Text>
                        {currentStep !== 6 && <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />}
                    </TouchableOpacity>
                </View>
            </View>
            {renderPhoneVerification && renderPhoneVerification()}
        </BaseModal>
    );
};

export default CustomerOrderModal;
