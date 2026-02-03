import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Dimensions,
    Alert,
    ActivityIndicator,
    Animated,
    Keyboard,
    Image,
    Platform,
    Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxLocationService from '../services/MapboxLocationService';
import BaseModal from './BaseModal';
import OrderItemCard from './order/OrderItemCard';
import LocationDetailsStep from './order/LocationDetailsStep';
import VehicleCard, { VEHICLES } from './order/VehicleCard';
import { colors, borderRadius, spacing, typography, shadows } from '../styles/theme';

const RECENT_ADDRESSES_KEY = '@pikup_recent_addresses';
const MAX_RECENT_ADDRESSES = 5;
const MAX_SUGGESTIONS = 10;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STEPS = [
    { id: 1, title: 'Where to?' },
    { id: 2, title: 'What are you moving?' },
    { id: 3, title: 'Pickup Details' },
    { id: 4, title: 'Dropoff Details' },
    { id: 5, title: 'Select Vehicle' },
    { id: 6, title: 'Review & Confirm' }
];

const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const CustomerOrderModal = ({ visible, onClose, onConfirm, userLocation }) => {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(1);
    const slideAnim = useRef(new Animated.Value(0)).current;

    // ============================================
    // ORDER DATA STATE
    // ============================================
    const [orderData, setOrderData] = useState({
        pickup: { address: '', coordinates: null },
        dropoff: { address: '', coordinates: null },
        scheduleType: 'asap',
        scheduledDateTime: null,
        items: [],
        pickupDetails: { floor: '', hasElevator: false, driverHelpsLoading: false, notes: '' },
        dropoffDetails: { floor: '', hasElevator: false, driverHelpsUnloading: false, notes: '' },
        selectedVehicle: null,
        distance: null,
        duration: null,
        pricing: null
    });

    // Step 1 specific state
    const [pickupSuggestions, setPickupSuggestions] = useState([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
    const [activeField, setActiveField] = useState(null);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);
    const [recentAddresses, setRecentAddresses] = useState([]);
    const searchTimeoutRef = useRef(null);

    // Load recent addresses from storage
    const loadRecentAddresses = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
            if (stored) {
                setRecentAddresses(JSON.parse(stored));
            }
        } catch (error) {
            console.log('Failed to load recent addresses:', error);
        }
    };

    // Save address to recent
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

    // Step 2 specific state
    const [expandedItemId, setExpandedItemId] = useState(null);

    // Date/Time picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('date'); // 'date' or 'time'

    // Reset when modal closes, load recent when opens
    useEffect(() => {
        if (visible) {
            loadRecentAddresses();
        } else {
            setCurrentStep(1);
            setOrderData({
                pickup: { address: '', coordinates: null },
                dropoff: { address: '', coordinates: null },
                scheduleType: 'asap',
                scheduledDateTime: null,
                items: [],
                pickupDetails: { floor: '', hasElevator: false, driverHelpsLoading: false, notes: '' },
                dropoffDetails: { floor: '', hasElevator: false, driverHelpsUnloading: false, notes: '' },
                selectedVehicle: null,
                distance: null,
                duration: null,
                pricing: null
            });
            setPickupSuggestions([]);
            setDropoffSuggestions([]);
            setActiveField(null);
            setExpandedItemId(null);
        }
    }, [visible]);

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
        if (currentStep > 1) {
            goToStep(currentStep - 1, 'backward');
        }
    };

    // Check if order has any user input
    const hasOrderChanges = () => {
        return (
            orderData.pickup.address.trim() !== '' ||
            orderData.dropoff.address.trim() !== '' ||
            orderData.items.length > 0 ||
            orderData.selectedVehicle !== null
        );
    };

    const handleClose = () => {
        // Skip confirmation if no changes made
        if (!hasOrderChanges()) {
            onClose();
            return;
        }

        Alert.alert(
            'Cancel Order?',
            'Your progress will be lost.',
            [
                { text: 'Keep Editing', style: 'cancel' },
                { text: 'Cancel Order', style: 'destructive', onPress: onClose }
            ]
        );
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
                // Check insurance items have invoice
                const insuranceNoInvoice = orderData.items.find(item => item.hasInsurance && !item.invoicePhoto);
                if (insuranceNoInvoice) {
                    Alert.alert('Missing Invoice', 'Please upload an invoice for insured items to confirm they are new.');
                    return false;
                }
                return true;
            case 3:
                if (!orderData.pickupDetails.buildingName?.trim()) {
                    Alert.alert('Missing Info', 'Please enter the Store or Building Name.');
                    return false;
                }
                if (!orderData.pickupDetails.unitNumber?.trim()) {
                    Alert.alert('Missing Info', 'Please enter the Unit or Floor number.');
                    return false;
                }
                return true;
            case 4:
                if (!orderData.dropoffDetails.buildingName?.trim()) {
                    Alert.alert('Missing Info', 'Please enter the Store or Building Name.');
                    return false;
                }
                if (!orderData.dropoffDetails.unitNumber?.trim()) {
                    Alert.alert('Missing Info', 'Please enter the Unit or Floor number.');
                    return false;
                }
                return true;
            case 5:
                if (!orderData.selectedVehicle) {
                    Alert.alert('Missing Info', 'Please select a vehicle.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    const handleContinue = () => {
        Keyboard.dismiss();
        if (!validateStep()) return;

        if (currentStep < 6) {
            goToStep(currentStep + 1, 'forward');
        } else {
            // Calculate final pricing
            const finalOrder = {
                ...orderData,
                pricing: calculatePricing()
            };
            onConfirm(finalOrder);
        }
    };

    // ============================================
    // PRICING CALCULATION
    // ============================================
    const calculatePricing = () => {
        const vehicle = orderData.selectedVehicle;
        if (!vehicle) return null;

        const distance = orderData.distance || 10; // Default 10 miles if not calculated
        const baseFare = vehicle.basePrice;
        const perMileFee = distance * vehicle.perMile;

        // Loading/unloading fee
        let loadingFee = 0;
        if (orderData.pickupDetails.driverHelpsLoading) loadingFee += 25;
        if (orderData.dropoffDetails.driverHelpsUnloading) loadingFee += 25;

        // Insurance fee
        const insuredItems = orderData.items.filter(item => item.hasInsurance);
        const insuranceFee = insuredItems.length * 15; // $15 per insured item

        const total = baseFare + perMileFee + loadingFee + insuranceFee;

        return {
            baseFare,
            perMileFee,
            loadingFee,
            insuranceFee,
            total,
            distance
        };
    };

    // ============================================
    // STEP 1: ADDRESS SEARCH
    // ============================================
    const searchPlaces = (query, fieldType) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (!query || query.length < 2) {
            if (fieldType === 'pickup') setPickupSuggestions([]);
            if (fieldType === 'dropoff') setDropoffSuggestions([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                setIsLoadingSuggestions(true);
                const accessToken = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;

                let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `access_token=${accessToken}&country=us&types=address,place,poi&limit=7&autocomplete=true&fuzzy_match=true`;

                if (userLocation) {
                    url += `&proximity=${userLocation.longitude},${userLocation.latitude}`;
                }

                const response = await fetch(url);
                const data = await response.json();

                if (data.features?.length > 0) {
                    const formattedSuggestions = data.features.map(feature => ({
                        id: feature.id,
                        name: feature.text,
                        address: feature.place_name.replace(feature.text + ', ', ''),
                        full_description: feature.place_name,
                        coordinates: { latitude: feature.center[1], longitude: feature.center[0] }
                    }));

                    if (fieldType === 'pickup') setPickupSuggestions(formattedSuggestions);
                    else setDropoffSuggestions(formattedSuggestions);
                } else {
                    if (fieldType === 'pickup') setPickupSuggestions([]);
                    else setDropoffSuggestions([]);
                }
            } catch (error) {
                console.error('Geocoding error:', error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300);
    };

    const handlePlaceSelection = (place, fieldType) => {
        Keyboard.dismiss();

        const locationData = {
            address: place.full_description,
            coordinates: place.coordinates
        };

        setOrderData(prev => ({
            ...prev,
            [fieldType]: locationData
        }));

        if (fieldType === 'pickup') setPickupSuggestions([]);
        else setDropoffSuggestions([]);
        setActiveField(null);

        // Save to recent addresses
        saveToRecentAddresses(place);
    };

    const handleUseCurrentLocation = async (fieldType = 'pickup') => {
        Keyboard.dismiss();
        try {
            setIsLoadingCurrentLocation(true);
            const location = await MapboxLocationService.getCurrentLocation();

            if (location) {
                const coordinates = { latitude: location.latitude, longitude: location.longitude };
                let addressText = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

                try {
                    const addressData = await MapboxLocationService.reverseGeocode(location.latitude, location.longitude);
                    if (addressData?.address) addressText = addressData.address;
                } catch (err) {
                    console.log('Reverse geocoding failed', err);
                }

                setOrderData(prev => ({
                    ...prev,
                    [fieldType]: { address: addressText, coordinates }
                }));

                if (fieldType === 'pickup') setPickupSuggestions([]);
                else setDropoffSuggestions([]);
                setActiveField(null);
            }
        } catch (error) {
            Alert.alert('Location Error', 'Unable to get current location.');
        } finally {
            setIsLoadingCurrentLocation(false);
        }
    };

    // ============================================
    // STEP 2: ITEMS MANAGEMENT
    // ============================================
    const handleAddItem = () => {
        const newItem = {
            id: generateItemId(),
            name: '',
            description: '',
            photos: [],
            isFragile: false,
            condition: 'used', // Default to used
            hasInsurance: false,
            invoicePhoto: null
        };

        setOrderData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setExpandedItemId(newItem.id);
    };

    const handleUpdateItem = (updatedItem) => {
        setOrderData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === updatedItem.id ? updatedItem : item
            )
        }));
    };

    const handleDeleteItem = (itemId) => {
        Alert.alert(
            'Delete Item?',
            'This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        setOrderData(prev => ({
                            ...prev,
                            items: prev.items.filter(item => item.id !== itemId)
                        }));
                        if (expandedItemId === itemId) setExpandedItemId(null);
                    }
                }
            ]
        );
    };

    // ============================================
    // RENDER STEPS
    // ============================================
    const renderStep1 = () => {
        const renderAddressInput = (type) => {
            const isPickup = type === 'pickup';
            const value = isPickup ? orderData.pickup.address : orderData.dropoff.address;
            const suggestions = isPickup ? pickupSuggestions : dropoffSuggestions;
            const hasSearchQuery = value.length >= 2;

            return (
                <View style={{ marginBottom: 16, zIndex: activeField === type ? 10 : 1 }}>
                    <View style={styles.inputWrapper}>
                        <View style={[styles.addressMarker, isPickup ? styles.pickupMarker : styles.dropoffMarker]}>
                            <Text style={styles.addressMarkerText}>{isPickup ? 'A' : 'B'}</Text>
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder={isPickup ? "Pickup Address" : "Dropoff Address"}
                            placeholderTextColor="#666"
                            value={value}
                            onChangeText={(text) => {
                                setOrderData(prev => ({
                                    ...prev,
                                    [type]: { address: text, coordinates: null }
                                }));
                                setActiveField(type);
                                searchPlaces(text, type);
                            }}
                            onFocus={() => setActiveField(type)}
                        />
                        {value.length > 0 && (
                            <TouchableOpacity onPress={() => {
                                setOrderData(prev => ({
                                    ...prev,
                                    [type]: { address: '', coordinates: null }
                                }));
                                if (isPickup) setPickupSuggestions([]); else setDropoffSuggestions([]);
                            }}>
                                <Ionicons name="close-circle" size={18} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Suggestions dropdown - show on focus */}
                    {activeField === type && (
                        <View style={styles.suggestionsContainer}>
                            {/* Use current location */}
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleUseCurrentLocation(type)}
                            >
                                <View style={[styles.suggestionIcon, { backgroundColor: colors.primary }]}>
                                    {isLoadingCurrentLocation ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Ionicons name="compass" size={20} color="#FFF" />
                                    )}
                                </View>
                                <Text style={styles.suggestionTitle}>Use current location</Text>
                            </TouchableOpacity>

                            {/* Recent addresses */}
                            {!hasSearchQuery && recentAddresses.length > 0 && (
                                <>
                                    <View style={styles.sectionLabelRow}>
                                        <View style={styles.sectionLine} />
                                        <Text style={styles.sectionLabelText}>Recent</Text>
                                        <View style={styles.sectionLine} />
                                    </View>
                                    {recentAddresses.map((item, index) => (
                                        <TouchableOpacity
                                            key={`recent-${item.id}-${index}`}
                                            style={styles.suggestionItem}
                                            onPress={() => handlePlaceSelection(item, type)}
                                        >
                                            <View style={styles.suggestionIcon}>
                                                <Ionicons name="time-outline" size={20} color="#FFF" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}

                            {/* Loading */}
                            {isLoadingSuggestions && (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color={colors.primary} size="small" />
                                </View>
                            )}

                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <>
                                    <View style={styles.sectionLabelRow}>
                                        <View style={styles.sectionLine} />
                                        <Text style={styles.sectionLabelText}>Suggestions</Text>
                                        <View style={styles.sectionLine} />
                                    </View>
                                    {suggestions.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.suggestionItem}
                                            onPress={() => handlePlaceSelection(item, type)}
                                        >
                                            <View style={styles.suggestionIcon}>
                                                <Ionicons name="location-outline" size={20} color="#FFF" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    )}
                </View>
            );
        };

        // Close suggestions when tapping outside
        const handleOutsideTap = () => {
            if (activeField) {
                setActiveField(null);
                Keyboard.dismiss();
            }
        };

        return (
            <TouchableWithoutFeedback onPress={handleOutsideTap}>
                <ScrollView style={styles.stepContent} keyboardShouldPersistTaps="handled">
                    {renderAddressInput('pickup')}
                    {renderAddressInput('dropoff')}

                    {/* Schedule Toggle */}
                <View style={styles.scheduleSection}>
                    <Text style={styles.sectionLabel}>When?</Text>
                    <View style={styles.scheduleToggle}>
                        <TouchableOpacity
                            style={[styles.scheduleOption, orderData.scheduleType === 'asap' && styles.scheduleOptionActive]}
                            onPress={() => setOrderData(prev => ({ ...prev, scheduleType: 'asap', scheduledDateTime: null }))}
                        >
                            <Ionicons name="flash" size={18} color={orderData.scheduleType === 'asap' ? '#FFF' : '#888'} />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'asap' && styles.scheduleOptionTextActive]}>ASAP</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.scheduleOption, orderData.scheduleType === 'scheduled' && styles.scheduleOptionActive]}
                            onPress={() => setOrderData(prev => ({ ...prev, scheduleType: 'scheduled' }))}
                        >
                            <Ionicons name="calendar" size={18} color={orderData.scheduleType === 'scheduled' ? '#FFF' : '#888'} />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'scheduled' && styles.scheduleOptionTextActive]}>Schedule</Text>
                        </TouchableOpacity>
                    </View>

                    {orderData.scheduleType === 'scheduled' && (
                        <View style={styles.dateTimeSection}>
                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => {
                                    setDatePickerMode('date');
                                    setShowDatePicker(true);
                                }}
                            >
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        })
                                        : 'Select date'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => {
                                    setDatePickerMode('time');
                                    setShowDatePicker(true);
                                }}
                            >
                                <Ionicons name="time-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })
                                        : 'Select time'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            {Platform.OS === 'ios' ? (
                                <Modal
                                    visible={showDatePicker}
                                    transparent={true}
                                    animationType="fade"
                                    onRequestClose={() => setShowDatePicker(false)}
                                >
                                    <View style={styles.datePickerModal}>
                                        <View style={styles.datePickerModalContent}>
                                            <View style={styles.datePickerModalHeader}>
                                                <Text style={styles.datePickerModalTitle}>
                                                    {datePickerMode === 'date' ? 'Select Date' : 'Select Time'}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => setShowDatePicker(false)}
                                                >
                                                    <Text style={styles.datePickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={orderData.scheduledDateTime ? new Date(orderData.scheduledDateTime) : new Date()}
                                                mode={datePickerMode}
                                                display="spinner"
                                                minimumDate={new Date()}
                                                onChange={(event, selectedDate) => {
                                                    if (selectedDate) {
                                                        const currentDate = orderData.scheduledDateTime
                                                            ? new Date(orderData.scheduledDateTime)
                                                            : new Date();

                                                        if (datePickerMode === 'date') {
                                                            currentDate.setFullYear(selectedDate.getFullYear());
                                                            currentDate.setMonth(selectedDate.getMonth());
                                                            currentDate.setDate(selectedDate.getDate());
                                                        } else {
                                                            currentDate.setHours(selectedDate.getHours());
                                                            currentDate.setMinutes(selectedDate.getMinutes());
                                                        }

                                                        setOrderData(prev => ({
                                                            ...prev,
                                                            scheduledDateTime: currentDate.toISOString()
                                                        }));
                                                    }
                                                }}
                                                themeVariant="dark"
                                                style={styles.datePickerSpinner}
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                showDatePicker && (
                                    <DateTimePicker
                                        value={orderData.scheduledDateTime ? new Date(orderData.scheduledDateTime) : new Date()}
                                        mode={datePickerMode}
                                        display="default"
                                        minimumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(false);
                                            if (selectedDate) {
                                                const currentDate = orderData.scheduledDateTime
                                                    ? new Date(orderData.scheduledDateTime)
                                                    : new Date();

                                                if (datePickerMode === 'date') {
                                                    currentDate.setFullYear(selectedDate.getFullYear());
                                                    currentDate.setMonth(selectedDate.getMonth());
                                                    currentDate.setDate(selectedDate.getDate());
                                                } else {
                                                    currentDate.setHours(selectedDate.getHours());
                                                    currentDate.setMinutes(selectedDate.getMinutes());
                                                }

                                                setOrderData(prev => ({
                                                    ...prev,
                                                    scheduledDateTime: currentDate.toISOString()
                                                }));
                                            }
                                        }}
                                        themeVariant="dark"
                                    />
                                )
                            )}
                        </View>
                    )}
                </View>
                </ScrollView>
            </TouchableWithoutFeedback>
        );
    };

    const renderStep2 = () => (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            {orderData.items.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="cube-outline" size={64} color="#444" />
                    <Text style={styles.emptyStateText}>No items added yet</Text>
                    <Text style={styles.emptyStateSubtext}>Tap below to add your first item</Text>
                </View>
            ) : (
                orderData.items.map(item => (
                    <OrderItemCard
                        key={item.id}
                        item={item}
                        isExpanded={expandedItemId === item.id}
                        onToggleExpand={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                        onUpdate={handleUpdateItem}
                        onDelete={() => handleDeleteItem(item.id)}
                    />
                ))
            )}

            <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                <Ionicons name="add-circle" size={24} color="#A77BFF" />
                <Text style={styles.addItemBtnText}>Add Item</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView>
    );

    const renderStep3 = () => (
        <LocationDetailsStep
            address={orderData.pickup.address}
            type="pickup"
            details={orderData.pickupDetails}
            onUpdate={(details) => setOrderData(prev => ({ ...prev, pickupDetails: details }))}
        />
    );

    const renderStep4 = () => (
        <LocationDetailsStep
            address={orderData.dropoff.address}
            type="dropoff"
            details={orderData.dropoffDetails}
            onUpdate={(details) => setOrderData(prev => ({ ...prev, dropoffDetails: details }))}
        />
    );

    const renderStep5 = () => (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.vehicleHint}>Choose the vehicle that fits your items</Text>

            {VEHICLES.map(vehicle => (
                <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={orderData.selectedVehicle?.id === vehicle.id}
                    onSelect={(v) => setOrderData(prev => ({ ...prev, selectedVehicle: v }))}
                    distance={orderData.distance || 10}
                />
            ))}

            {/* What fits section */}
            {orderData.selectedVehicle && (
                <View style={styles.whatFitsSection}>
                    <Text style={styles.whatFitsTitle}>What fits in a {orderData.selectedVehicle.type}:</Text>
                    {orderData.selectedVehicle.items.map((item, index) => (
                        <View key={index} style={styles.whatFitsItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#00D4AA" />
                            <Text style={styles.whatFitsText}>{item}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={{ height: 100 }} />
        </ScrollView>
    );

    const renderStep6 = () => {
        const pricing = calculatePricing();

        return (
            <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
                {/* Route Summary */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => setCurrentStep(1)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Route</Text>
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: '#A77BFF' }]} />
                        <Text style={styles.routeAddress} numberOfLines={1}>{orderData.pickup.address}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <View style={[styles.routeDot, { backgroundColor: '#00D4AA' }]} />
                        <Text style={styles.routeAddress} numberOfLines={1}>{orderData.dropoff.address}</Text>
                    </View>
                </TouchableOpacity>

                {/* Items Summary */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => setCurrentStep(2)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Items ({orderData.items.length})</Text>
                    {orderData.items.map(item => (
                        <View key={item.id} style={styles.itemSummaryRow}>
                            <Text style={styles.itemSummaryName}>{item.name}</Text>
                            <View style={styles.itemSummaryBadges}>
                                {item.isFragile && <Text style={styles.fragileTag}>Fragile</Text>}
                                {item.hasInsurance && <Text style={styles.insuredTag}>Insured</Text>}
                            </View>
                        </View>
                    ))}
                </TouchableOpacity>

                {/* Vehicle */}
                <TouchableOpacity style={styles.summaryCard} onPress={() => setCurrentStep(5)} activeOpacity={0.7}>
                    <Text style={styles.summaryCardTitle}>Vehicle</Text>
                    <View style={styles.vehicleSummary}>
                        <Image source={orderData.selectedVehicle?.image} style={styles.vehicleSummaryImg} />
                        <Text style={styles.vehicleSummaryName}>{orderData.selectedVehicle?.type}</Text>
                    </View>
                </TouchableOpacity>

                {/* Price Breakdown */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Price Breakdown</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Base Fare</Text>
                        <Text style={styles.priceValue}>${pricing?.baseFare?.toFixed(2) || '0.00'}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Distance ({pricing?.distance || 0} mi × ${orderData.selectedVehicle?.perMile?.toFixed(2) || '0.00'})</Text>
                        <Text style={styles.priceValue}>${pricing?.perMileFee?.toFixed(2) || '0.00'}</Text>
                    </View>

                    {pricing?.loadingFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Loading/Unloading Help</Text>
                            <Text style={styles.priceValue}>${pricing.loadingFee.toFixed(2)}</Text>
                        </View>
                    )}

                    {pricing?.insuranceFee > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Insurance ({orderData.items.filter(i => i.hasInsurance).length} items)</Text>
                            <Text style={styles.priceValue}>${pricing.insuranceFee.toFixed(2)}</Text>
                        </View>
                    )}

                    <View style={styles.priceDivider} />

                    <View style={styles.priceRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>${pricing?.total?.toFixed(2) || '0.00'}</Text>
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return renderStep3();
            case 4: return renderStep4();
            case 5: return renderStep5();
            case 6: return renderStep6();
            default: return null;
        }
    };

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            onBackdropPress={handleClose}
            height={SCREEN_HEIGHT * 0.9}
            backgroundColor="#141426"
            avoidKeyboard={true}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    {currentStep > 1 ? (
                        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerBtn} />
                    )}

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{STEPS[currentStep - 1].title}</Text>
                        <Text style={styles.headerStep}>Step {currentStep} of {STEPS.length}</Text>
                    </View>

                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                        <Ionicons name="close" size={24} color="#FFF" />
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
                <View style={[styles.footer, { paddingBottom: 16 }]}>
                    <TouchableOpacity
                        style={[
                            styles.continueBtn,
                            currentStep === 6 && { backgroundColor: '#00D4AA' }
                        ]}
                        onPress={handleContinue}
                    >
                        <Text style={[
                            styles.continueBtnText,
                            currentStep === 6 && { marginRight: 0 } // Center text when no icon
                        ]}>
                            {currentStep === 6 ? 'Confirm & Pay' : 'Continue'}
                        </Text>
                        {currentStep !== 6 && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
                    </TouchableOpacity>
                </View>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        height: 56
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
    headerStep: { fontSize: typography.fontSize.sm, color: colors.text.muted, marginTop: 2 },
    progressBar: { height: 3, backgroundColor: colors.border.default, marginHorizontal: spacing.lg },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: borderRadius.xs },
    stepContainer: { flex: 1 },
    stepContent: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.base, borderTopWidth: 1, borderTopColor: colors.background.input },
    continueBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: borderRadius.full
    },
    continueBtnText: { color: colors.white, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, marginRight: spacing.sm },

    // Step 1 Styles
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.full, // Match button!
        borderWidth: 1,
        borderColor: colors.border.default,
        height: 56,
        paddingHorizontal: spacing.base
    },
    input: { flex: 1, color: colors.text.primary, marginLeft: spacing.md, fontSize: typography.fontSize.md, height: '100%' },
    addressMarker: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pickupMarker: { backgroundColor: colors.primary },
    dropoffMarker: { backgroundColor: colors.success },
    addressMarkerText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
    suggestionsContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        maxHeight: 350,
        zIndex: 100,
        overflow: 'hidden'
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.base
    },
    suggestionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md
    },
    suggestionTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: 2 },
    suggestionAddr: { color: colors.text.secondary, fontSize: typography.fontSize.sm },
    sectionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        marginTop: spacing.xs
    },
    sectionLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border.default,
        marginHorizontal: spacing.md
    },
    sectionLabelText: {
        color: colors.text.muted,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: spacing.sm
    },
    loadingRow: {
        paddingVertical: spacing.sm,
        alignItems: 'center'
    },
    currentLocBtn: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, padding: spacing.md },
    currentLocText: { color: colors.text.link, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.md, fontSize: typography.fontSize.md },
    scheduleSection: { marginTop: spacing.xl },
    sectionLabel: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md },
    scheduleToggle: { flexDirection: 'row', backgroundColor: colors.background.input, borderRadius: borderRadius.full, padding: spacing.xs },
    scheduleOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.xl
    },
    scheduleOptionActive: { backgroundColor: colors.primary },
    scheduleOptionText: { color: colors.text.muted, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },
    scheduleOptionTextActive: { color: colors.white },
    dateTimeSection: { marginTop: spacing.md },
    datePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.input,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.default
    },
    datePickerText: { color: colors.text.primary, marginLeft: spacing.md, fontSize: typography.fontSize.md, flex: 1 },
    datePickerDoneBtn: {
        alignSelf: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        marginTop: spacing.md
    },
    datePickerDoneText: { color: colors.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    datePickerModal: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    datePickerModalContent: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        width: '85%',
        maxWidth: 340,
        overflow: 'hidden'
    },
    datePickerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    datePickerModalTitle: {
        color: colors.text.primary,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold
    },
    datePickerSpinner: {
        height: 200,
        backgroundColor: colors.background.secondary
    },

    // Step 2 Styles
    aiPhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing.md
    },
    aiPhotoIconContainer: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md
    },
    aiPhotoTextContainer: { flex: 1 },
    aiPhotoTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    aiPhotoSubtitle: { color: colors.text.secondary, fontSize: typography.fontSize.xs, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border.default, marginBottom: spacing.md },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyStateText: { color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, marginTop: spacing.base },
    emptyStateSubtext: { color: colors.text.placeholder, fontSize: typography.fontSize.base, marginTop: spacing.sm },
    addItemBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        padding: spacing.lg,
        marginTop: spacing.sm
    },
    addItemBtnText: { color: colors.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },

    // Step 5 Styles
    vehicleHint: { color: colors.text.muted, fontSize: typography.fontSize.base, marginBottom: spacing.base, textAlign: 'center' },
    whatFitsSection: { backgroundColor: colors.background.tertiary, borderRadius: borderRadius.lg, padding: spacing.base, marginTop: spacing.base },
    whatFitsTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md },
    whatFitsItem: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    whatFitsText: { color: colors.text.secondary, fontSize: typography.fontSize.base, marginLeft: spacing.sm },

    // Step 6 Styles
    summaryCard: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.base,
        marginBottom: spacing.base
    },
    summaryCardTitle: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, marginBottom: spacing.md },
    routeRow: { flexDirection: 'row', alignItems: 'center' },
    routeDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
    routeLine: { width: 2, height: 20, backgroundColor: colors.border.default, marginLeft: spacing.xs, marginVertical: spacing.xs },
    routeAddress: { color: colors.text.secondary, fontSize: typography.fontSize.base, flex: 1 },
    itemSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    itemSummaryName: { color: colors.text.primary, fontSize: typography.fontSize.base },
    itemSummaryBadges: { flexDirection: 'row' },
    fragileTag: { backgroundColor: colors.secondaryLight, color: colors.secondary, fontSize: typography.fontSize.xs, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.xs, marginLeft: 6 },
    insuredTag: { backgroundColor: colors.primaryLight, color: colors.primary, fontSize: typography.fontSize.xs, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.xs, marginLeft: 6 },
    vehicleSummary: { flexDirection: 'row', alignItems: 'center' },
    vehicleSummaryImg: { width: 60, height: 35, resizeMode: 'contain', marginRight: spacing.md },
    vehicleSummaryName: { color: colors.text.primary, fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    priceLabel: { color: colors.text.muted, fontSize: typography.fontSize.base },
    priceValue: { color: colors.text.primary, fontSize: typography.fontSize.base },
    priceDivider: { height: 1, backgroundColor: colors.border.default, marginVertical: spacing.md },
    totalLabel: { color: colors.text.primary, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
    totalValue: { color: colors.primary, fontSize: typography.fontSize.xxl, fontWeight: typography.fontWeight.bold }
});

export default CustomerOrderModal;
