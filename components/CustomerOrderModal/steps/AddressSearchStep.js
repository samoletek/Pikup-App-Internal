import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Alert,
    ActivityIndicator,
    Keyboard,
    Platform,
    Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapboxLocationService from '../../../services/MapboxLocationService';
import { colors } from '../../../styles/theme';
import { styles } from '../styles';

const AddressSearchStep = ({
    orderData,
    setOrderData,
    userLocation,
    recentAddresses,
    saveToRecentAddresses
}) => {
    const [pickupSuggestions, setPickupSuggestions] = useState([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
    const [activeField, setActiveField] = useState(null);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerMode, setDatePickerMode] = useState('date');
    const searchTimeoutRef = useRef(null);

    // ============================================
    // ADDRESS SEARCH
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
        const locationData = { address: place.full_description, coordinates: place.coordinates };
        setOrderData(prev => ({ ...prev, [fieldType]: locationData }));
        if (fieldType === 'pickup') setPickupSuggestions([]);
        else setDropoffSuggestions([]);
        setActiveField(null);
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

                setOrderData(prev => ({ ...prev, [fieldType]: { address: addressText, coordinates } }));
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
    // ADDRESS INPUT RENDER
    // ============================================
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
                        placeholderTextColor={colors.text.placeholder}
                        value={value}
                        onChangeText={(text) => {
                            setOrderData(prev => ({ ...prev, [type]: { address: text, coordinates: null } }));
                            setActiveField(type);
                            searchPlaces(text, type);
                        }}
                        onFocus={() => setActiveField(type)}
                    />
                    {value.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setOrderData(prev => ({ ...prev, [type]: { address: '', coordinates: null } }));
                            if (isPickup) setPickupSuggestions([]); else setDropoffSuggestions([]);
                        }}>
                            <Ionicons name="close-circle" size={18} color={colors.text.placeholder} />
                        </TouchableOpacity>
                    )}
                </View>

                {activeField === type && (
                    <View style={styles.suggestionsContainer}>
                        <TouchableOpacity style={styles.suggestionItem} onPress={() => handleUseCurrentLocation(type)}>
                            <View style={[styles.suggestionIcon, { backgroundColor: colors.primary }]}>
                                {isLoadingCurrentLocation ? (
                                    <ActivityIndicator color={colors.text.primary} size="small" />
                                ) : (
                                    <Ionicons name="compass" size={20} color={colors.text.primary} />
                                )}
                            </View>
                            <Text style={styles.suggestionTitle}>Use current location</Text>
                        </TouchableOpacity>

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
                                            <Ionicons name="time-outline" size={20} color={colors.text.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}

                        {isLoadingSuggestions && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator color={colors.primary} size="small" />
                            </View>
                        )}

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
                                            <Ionicons name="location-outline" size={20} color={colors.text.primary} />
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

    // ============================================
    // DATE/TIME HANDLING
    // ============================================
    const handleDateChange = (event, selectedDate) => {
        if (selectedDate) {
            const currentDate = orderData.scheduledDateTime ? new Date(orderData.scheduledDateTime) : new Date();
            if (datePickerMode === 'date') {
                currentDate.setFullYear(selectedDate.getFullYear());
                currentDate.setMonth(selectedDate.getMonth());
                currentDate.setDate(selectedDate.getDate());
            } else {
                currentDate.setHours(selectedDate.getHours());
                currentDate.setMinutes(selectedDate.getMinutes());
            }
            setOrderData(prev => ({ ...prev, scheduledDateTime: currentDate.toISOString() }));
        }
    };

    const handleOutsideTap = () => {
        if (activeField) {
            setActiveField(null);
            Keyboard.dismiss();
        }
    };

    // ============================================
    // MAIN RENDER
    // ============================================
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
                            <Ionicons
                                name="flash"
                                size={18}
                                color={orderData.scheduleType === 'asap' ? colors.text.primary : colors.text.muted}
                            />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'asap' && styles.scheduleOptionTextActive]}>ASAP</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.scheduleOption, orderData.scheduleType === 'scheduled' && styles.scheduleOptionActive]}
                            onPress={() => setOrderData(prev => ({ ...prev, scheduleType: 'scheduled' }))}
                        >
                            <Ionicons
                                name="calendar"
                                size={18}
                                color={orderData.scheduleType === 'scheduled' ? colors.text.primary : colors.text.muted}
                            />
                            <Text style={[styles.scheduleOptionText, orderData.scheduleType === 'scheduled' && styles.scheduleOptionTextActive]}>Schedule</Text>
                        </TouchableOpacity>
                    </View>

                    {orderData.scheduleType === 'scheduled' && (
                        <View style={styles.dateTimeSection}>
                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => { setDatePickerMode('date'); setShowDatePicker(true); }}
                            >
                                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                        : 'Select date'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => { setDatePickerMode('time'); setShowDatePicker(true); }}
                            >
                                <Ionicons name="time-outline" size={20} color={colors.primary} />
                                <Text style={styles.datePickerText}>
                                    {orderData.scheduledDateTime
                                        ? new Date(orderData.scheduledDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                        : 'Select time'}
                                </Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            {Platform.OS === 'ios' ? (
                                <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                                    <View style={styles.datePickerModal}>
                                        <View style={styles.datePickerModalContent}>
                                            <View style={styles.datePickerModalHeader}>
                                                <Text style={styles.datePickerModalTitle}>{datePickerMode === 'date' ? 'Select Date' : 'Select Time'}</Text>
                                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                                    <Text style={styles.datePickerDoneText}>Done</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={orderData.scheduledDateTime ? new Date(orderData.scheduledDateTime) : new Date()}
                                                mode={datePickerMode}
                                                display="spinner"
                                                minimumDate={new Date()}
                                                onChange={handleDateChange}
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
                                            handleDateChange(event, selectedDate);
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

export default AddressSearchStep;
