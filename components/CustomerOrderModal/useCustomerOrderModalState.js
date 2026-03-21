import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import {
    MAX_RECENT_ADDRESSES,
    RECENT_ADDRESSES_KEY,
    createInitialOrderData,
} from './constants';
import { getItemValidationErrors, validateLocationDetails } from './utils/validation';
import { SCREEN_WIDTH } from './styles';
import {
    COMING_SOON_UNSUPPORTED_STATE_MESSAGE,
    SERVICE_AREA_UNRESOLVED_MESSAGE,
    SUPPORTED_ORDER_STATE_CODES,
} from '../../constants/orderAvailability';
import {
    evaluateOrderStateCoverage,
    isSupportedOrderStateCode,
    resolveLocationStateCode,
} from '../../utils/locationState';
import { ensureForegroundLocationAvailability } from '../../utils/locationPermissions';

export default function useCustomerOrderModalState({
    visible,
    paymentMethods,
    defaultPaymentMethod,
    userLocation,
}) {
    const [currentStep, setCurrentStep] = useState(1);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [orderData, setOrderData] = useState(createInitialOrderData);
    const [recentAddresses, setRecentAddresses] = useState([]);
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [itemErrors, setItemErrors] = useState({});

    const loadRecentAddresses = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
            if (stored) {
                setRecentAddresses(JSON.parse(stored));
            }
        } catch (error) {
            logger.warn('CustomerOrderModal', 'Failed to load recent addresses', error);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadRecentAddresses();
        }
    }, [loadRecentAddresses, visible]);

    useEffect(() => {
        if (!visible) return;

        const fallbackMethodId = defaultPaymentMethod?.id || paymentMethods?.[0]?.id || null;
        if (!fallbackMethodId) return;

        setOrderData((prev) => {
            if (prev.selectedPaymentMethodId) {
                const methodStillExists = paymentMethods?.some(
                    (method) => method.id === prev.selectedPaymentMethodId
                );
                if (methodStillExists) {
                    return prev;
                }
            }

            return { ...prev, selectedPaymentMethodId: fallbackMethodId };
        });
    }, [defaultPaymentMethod, paymentMethods, visible]);

    useEffect(() => {
        const pickupCoords = orderData.pickup?.coordinates;
        const dropoffCoords = orderData.dropoff?.coordinates;
        if (!pickupCoords || !dropoffCoords) {
            return;
        }

        let cancelled = false;

        const fetchRoute = async () => {
            try {
                const route = await MapboxLocationService.getRoute(pickupCoords, dropoffCoords);
                if (cancelled) {
                    return;
                }

                const miles = parseFloat((route.distance.value / 1609.34).toFixed(1));
                const minutes = Math.round(route.duration.value / 60);
                setOrderData((prev) => ({ ...prev, distance: miles, duration: minutes }));
            } catch (error) {
                logger.warn('CustomerOrderModal', 'Failed to calculate route', error);
            }
        };

        fetchRoute();

        return () => {
            cancelled = true;
        };
    }, [orderData.dropoff?.coordinates, orderData.pickup?.coordinates]);

    const saveToRecentAddresses = useCallback(async (place) => {
        try {
            const newRecent = [
                place,
                ...recentAddresses.filter((item) => item.id !== place.id),
            ].slice(0, MAX_RECENT_ADDRESSES);

            setRecentAddresses(newRecent);
            await AsyncStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(newRecent));
        } catch (error) {
            logger.warn('CustomerOrderModal', 'Failed to save recent address', error);
        }
    }, [recentAddresses]);

    const goToStep = useCallback((step, direction = 'forward') => {
        const toValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
        Animated.timing(slideAnim, {
            toValue,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setCurrentStep(step);
            slideAnim.setValue(-toValue);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });
    }, [slideAnim]);

    const handleBack = useCallback(() => {
        Keyboard.dismiss();
        if (currentStep > 1) {
            goToStep(currentStep - 1, 'backward');
        }
    }, [currentStep, goToStep]);

    const hasOrderChanges = useCallback(() => {
        return (
            orderData.pickup.address.trim() !== '' ||
            orderData.dropoff.address.trim() !== '' ||
            orderData.items.length > 0 ||
            orderData.selectedVehicle !== null
        );
    }, [orderData.dropoff.address, orderData.items.length, orderData.pickup.address, orderData.selectedVehicle]);

    const pendingItemAttentionCount = useMemo(() => {
        return orderData.items.reduce((count, item) => {
            const itemErrorsMap = getItemValidationErrors(item);
            return Object.keys(itemErrorsMap).length > 0 ? count + 1 : count;
        }, 0);
    }, [orderData.items]);

    const ensureLocationAvailability = useCallback(async () => {
        const availability = await ensureForegroundLocationAvailability({
            loggerScope: 'CustomerOrderModal',
            permissionDeniedMessage:
                'Please allow location access so we can confirm service availability in your area.',
            servicesDisabledMessage:
                'Please enable Location Services so we can confirm service availability in your area.',
            errorMessage:
                'We could not verify your current location. Please check Location permissions and try again.',
        });

        if (!availability.ok) {
            return false;
        }

        return true;
    }, []);

    const validateStep = useCallback(() => {
        switch (currentStep) {
            case 1: {
                const validateStepOne = async () => {
                    const hasLocationAccess = await ensureLocationAvailability();
                    if (!hasLocationAccess) {
                        return false;
                    }

                    const customerStateCode = resolveLocationStateCode(userLocation || null);
                    if (!customerStateCode) {
                        Alert.alert(
                            'Service Availability',
                            SERVICE_AREA_UNRESOLVED_MESSAGE
                        );
                        return false;
                    }

                    if (!isSupportedOrderStateCode(customerStateCode, SUPPORTED_ORDER_STATE_CODES)) {
                        Alert.alert('Coming Soon', COMING_SOON_UNSUPPORTED_STATE_MESSAGE);
                        return false;
                    }

                    if (!orderData.pickup.address.trim()) {
                        Alert.alert('Missing Info', 'Please enter a pickup address.');
                        return false;
                    }
                    if (!orderData.dropoff.address.trim()) {
                        Alert.alert('Missing Info', 'Please enter a dropoff address.');
                        return false;
                    }
                    if (
                        orderData.pickup.address.trim().toLowerCase() ===
                        orderData.dropoff.address.trim().toLowerCase()
                    ) {
                        Alert.alert('Same Address', 'Pickup and dropoff addresses cannot be the same.');
                        return false;
                    }

                    const stateCoverage = evaluateOrderStateCoverage({
                        pickup: orderData.pickup,
                        dropoff: orderData.dropoff,
                        supportedStateCodes: SUPPORTED_ORDER_STATE_CODES,
                        requireResolvedState: true,
                    });
                    if (!stateCoverage.isSupported) {
                        if (stateCoverage.reason === 'state_unresolved') {
                            Alert.alert(
                                'Address Required',
                                'Please select pickup and dropoff addresses from suggestions.'
                            );
                            return false;
                        }

                        Alert.alert('Coming Soon', COMING_SOON_UNSUPPORTED_STATE_MESSAGE);
                        return false;
                    }
                    return true;
                };

                return validateStepOne();
            }
            case 2: {
                if (orderData.items.length === 0) {
                    Alert.alert('Missing Info', 'Please add at least one item.');
                    return false;
                }

                const errors = {};
                let firstErrorItemId = null;

                orderData.items.forEach((item) => {
                    const itemErr = getItemValidationErrors(item);
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
                        Alert.alert(
                            'Missing Invoice',
                            'Please upload an invoice or receipt for insured items to verify their value.'
                        );
                    }
                    return false;
                }

                setItemErrors({});
                return true;
            }
            case 3: {
                const pickupError = validateLocationDetails(orderData.pickupDetails, 'pickup');
                if (pickupError) {
                    Alert.alert('Missing Info', pickupError);
                    return false;
                }
                return true;
            }
            case 4: {
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
                    Alert.alert(
                        'Payment Method Required',
                        'Please select a saved payment method to continue.'
                    );
                    return false;
                }
                return true;
            default:
                return true;
        }
    }, [currentStep, ensureLocationAvailability, orderData, userLocation]);

    const resetLocalState = useCallback(() => {
        setCurrentStep(1);
        setOrderData(createInitialOrderData());
        setExpandedItemId(null);
        setItemErrors({});
    }, []);

    return {
        currentStep,
        setCurrentStep,
        slideAnim,
        orderData,
        setOrderData,
        recentAddresses,
        saveToRecentAddresses,
        expandedItemId,
        setExpandedItemId,
        itemErrors,
        setItemErrors,
        pendingItemAttentionCount,
        goToStep,
        handleBack,
        hasOrderChanges,
        validateStep,
        resetLocalState,
    };
}
