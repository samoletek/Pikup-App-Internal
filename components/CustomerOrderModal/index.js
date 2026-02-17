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
import { calculatePrice } from '../../services/PricingService';
import MapboxLocationService from '../../services/MapboxLocationService';

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
    unitFloor: '',
    unitNumber: '',
    hasElevator: null,
    driverHelpsLoading: false,
    driverHelpsUnloading: false,
    notes: '',
});

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
        dropoffDetails: createLocationDetailsDefaults(),
        selectedVehicle: null,
        selectedPaymentMethodId: null,
        distance: null,
        duration: null,
        pricing: null
    });

    // Recent addresses (for Step 1)
    const [recentAddresses, setRecentAddresses] = useState([]);

    // Step 2 specific state
    const [expandedItemId, setExpandedItemId] = useState(null);

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
            dropoffDetails: createLocationDetailsDefaults(),
            selectedVehicle: null,
            selectedPaymentMethodId: null,
            distance: null,
            duration: null,
            pricing: null
        });
        setExpandedItemId(null);
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

    const handleClose = () => {
        if (!hasOrderChanges()) {
            resetState();
            onClose();
            return;
        }
        Alert.alert('Cancel Order?', 'Your progress will be lost.', [
            { text: 'Keep Editing', style: 'cancel' },
            { text: 'Cancel Order', style: 'destructive', onPress: () => {
                resetState();
                onClose();
            }}
        ]);
    };

    // ============================================
    // VALIDATION
    // ============================================
    const validateLocationDetails = (locationDetails, label) => {
        const rawLocationType = locationDetails.locationType || 'store';
        const locationType = rawLocationType === 'house_other' ? 'residential_other' : rawLocationType;

        if (locationType === 'store') {
            if (!locationDetails.storeName?.trim()) {
                return `Please enter the store name for ${label}.`;
            }
            return null;
        }

        if (locationType === 'apartment') {
            if (!locationDetails.buildingName?.trim()) {
                return `Please enter the building name/number for ${label}.`;
            }

            const unitFloor = locationDetails.unitFloor ?? locationDetails.unitNumber;
            if (!unitFloor?.trim()) {
                return `Please enter the unit/floor for ${label}.`;
            }

            if (locationDetails.hasElevator !== true && locationDetails.hasElevator !== false) {
                return `Please specify if there is a working elevator for ${label}.`;
            }
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
            case 2:
                if (orderData.items.length === 0) {
                    Alert.alert('Missing Info', 'Please add at least one item.');
                    return false;
                }
                const invalidItem = orderData.items.find(item => !item.name.trim());
                if (invalidItem) {
                    Alert.alert('Missing Info', 'Please enter a name for all items.');
                    return false;
                }
                const insuranceNoInvoice = orderData.items.find(item => item.hasInsurance && !item.invoicePhoto);
                if (insuranceNoInvoice) {
                    Alert.alert('Missing Invoice', 'Please upload an invoice for insured items to confirm they are new.');
                    return false;
                }
                return true;
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

        return calculatePrice(vehicle, distance, duration);
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
                    />
                );
            case 3:
                return (
                    <LocationDetailsStep
                        address={orderData.pickup.address}
                        type="pickup"
                        details={orderData.pickupDetails}
                        onUpdate={(details) => setOrderData(prev => ({ ...prev, pickupDetails: details }))}
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
            onClose={onClose}
            onBackdropPress={onClose}
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
