import React, { useState, useRef, useEffect, forwardRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Alert,
    ActivityIndicator,
    Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapboxLocationService from '../services/MapboxLocationService';
import BaseModal from './BaseModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CustomerSearchModal = forwardRef(({ visible, onClose, onConfirm, userLocation }, ref) => {
    const [pickup, setPickup] = useState('');
    const [dropoff, setDropoff] = useState('');
    const [pickupSuggestions, setPickupSuggestions] = useState([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
    const [activeField, setActiveField] = useState(null);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [pickupCoordinates, setPickupCoordinates] = useState(null);
    const [dropoffCoordinates, setDropoffCoordinates] = useState(null);
    const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);

    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        if (!visible) {
            setPickup('');
            setDropoff('');
            setPickupSuggestions([]);
            setDropoffSuggestions([]);
            setActiveField(null);
            setPickupCoordinates(null);
            setDropoffCoordinates(null);
        }
    }, [visible]);

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
                    `access_token=${accessToken}&country=us&types=address,place,poi&limit=5&autocomplete=true&fuzzy_match=true`;

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
                console.error('Mapbox geocoding error:', error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300);
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

                if (fieldType === 'pickup') {
                    setPickup(addressText);
                    setPickupCoordinates(coordinates);
                    setPickupSuggestions([]);
                } else {
                    setDropoff(addressText);
                    setDropoffCoordinates(coordinates);
                    setDropoffSuggestions([]);
                }
                setActiveField(null);
            }
        } catch (error) {
            Alert.alert('Location Error', 'Unable to get current location.');
        } finally {
            setIsLoadingCurrentLocation(false);
        }
    };

    const handlePlaceSelection = (place, fieldType) => {
        Keyboard.dismiss();
        const coords = { latitude: place.coordinates.latitude, longitude: place.coordinates.longitude };
        if (fieldType === 'pickup') {
            setPickup(place.full_description);
            setPickupCoordinates(coords);
            setPickupSuggestions([]);
        } else {
            setDropoff(place.full_description);
            setDropoffCoordinates(coords);
            setDropoffSuggestions([]);
        }
        setActiveField(null);
    };

    const handleConfirm = async () => {
        if (!pickup.trim() || !dropoff.trim()) {
            Alert.alert('Missing Information', 'Please enter both pickup and dropoff locations.');
            return;
        }

        const locationData = {
            pickup: { address: pickup, coordinates: pickupCoordinates },
            dropoff: { address: dropoff, coordinates: dropoffCoordinates },
            isScheduled: false,
            scheduledDateTime: null
        };

        onConfirm(locationData);
    };

    const renderInput = (type) => {
        const isPickup = type === 'pickup';
        const value = isPickup ? pickup : dropoff;
        const setValue = isPickup ? setPickup : setDropoff;

        return (
            <View style={styles.inputWrapper}>
                <Ionicons
                    name={isPickup ? "location" : "navigate"}
                    size={20}
                    color={isPickup ? "#A77BFF" : "#FF7B7B"}
                    style={styles.inputIcon}
                />
                <TextInput
                    style={styles.input}
                    placeholder={isPickup ? "Pickup Location" : "Where to?"}
                    placeholderTextColor="#666"
                    value={value}
                    onChangeText={(text) => {
                        setValue(text);
                        setActiveField(type);
                        searchPlaces(text, type);
                        if (isPickup) setPickupCoordinates(null);
                        else setDropoffCoordinates(null);
                    }}
                    onFocus={() => setActiveField(type)}
                />
                {value.length > 0 && (
                    <TouchableOpacity onPress={() => {
                        setValue('');
                        if (isPickup) setPickupSuggestions([]); else setDropoffSuggestions([]);
                    }}>
                        <Ionicons name="close-circle" size={18} color="#666" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderSuggestions = () => {
        if (!activeField) return null;

        const suggestions = activeField === 'pickup' ? pickupSuggestions : dropoffSuggestions;

        return (
            <ScrollView
                style={styles.suggestionsScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Use current location - always first */}
                <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleUseCurrentLocation(activeField)}
                >
                    <View style={[styles.suggestionIcon, { backgroundColor: '#A77BFF' }]}>
                        {isLoadingCurrentLocation ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Ionicons name="navigate" size={18} color="#FFF" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionTitle}>Use current location</Text>
                    </View>
                </TouchableOpacity>

                {/* Loading indicator */}
                {isLoadingSuggestions && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color="#A77BFF" size="small" />
                    </View>
                )}

                {/* Mapbox suggestions */}
                {suggestions.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={styles.suggestionItem}
                        onPress={() => handlePlaceSelection(item, activeField)}
                    >
                        <View style={styles.suggestionIcon}>
                            <Ionicons name="location-outline" size={18} color="#FFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionTitle} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.suggestionAddr} numberOfLines={1}>{item.address}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            height={SCREEN_HEIGHT * 0.85}
            backgroundColor="#141426"
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    <View style={{ width: 40 }} />
                    <Text style={styles.headerTitle}>Plan your ride</Text>
                    <TouchableOpacity onPress={animateClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}
        >
            <View style={styles.content}>
                {/* Input fields */}
                <View style={styles.inputsContainer}>
                    {renderInput('pickup')}
                    {renderInput('dropoff')}
                </View>

                {/* Suggestions area - takes remaining space */}
                {renderSuggestions()}

                {/* Confirm button - stays at bottom */}
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                    <Text style={styles.confirmBtnText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
});

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 16,
        height: 50,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
        textAlign: 'center',
    },
    closeButton: {
        width: 40,
        alignItems: 'flex-end'
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    inputsContainer: {
        gap: 12,
        marginBottom: 16,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222233',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        height: 56,
        paddingHorizontal: 16
    },
    input: {
        flex: 1,
        color: '#FFF',
        marginLeft: 12,
        fontSize: 16,
        height: '100%'
    },
    inputIcon: {
        marginRight: 4
    },
    suggestionsScroll: {
        flex: 1,
        marginBottom: 12,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A3B'
    },
    suggestionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14
    },
    suggestionTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2
    },
    suggestionAddr: {
        color: '#888',
        fontSize: 13
    },
    loadingRow: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    confirmBtn: {
        backgroundColor: '#A77BFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 28,
        marginBottom: 20
    },
    confirmBtnText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8
    }
});

export default CustomerSearchModal;
