import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapboxLocationService from '../services/MapboxLocationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.95;
const MODAL_HEIGHT_SCHEDULED = SCREEN_HEIGHT * 0.98; // Nearly full screen when scheduling
const COLLAPSED_HEIGHT = 80;

const CustomerSearchModal = forwardRef(({ visible, onClose, onConfirm }, ref) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Places API states
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null); // 'pickup' or 'dropoff'
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Store coordinates from selected places
  const [pickupCoordinates, setPickupCoordinates] = useState(null);
  const [dropoffCoordinates, setDropoffCoordinates] = useState(null);

  // Loading state for current location
  const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);

  // Animation states for enhanced UX
  const [rotationAnim] = useState(new Animated.Value(0));
  const [showLocationSuccess, setShowLocationSuccess] = useState(false);

  const translateY = useRef(new Animated.Value(MODAL_HEIGHT)).current;

  // Mapbox Geocoding API for autocomplete
  const searchPlaces = async (query, fieldType) => {
    if (!query || query.length < 2) {
      if (fieldType === 'pickup') setPickupSuggestions([]);
      if (fieldType === 'dropoff') setDropoffSuggestions([]);
      return;
    }

    try {
      setIsLoadingSuggestions(true);

      // Get user location for proximity bias (optional)
      let proximityParam = '';
      try {
        const userLocation = await MapboxLocationService.getCurrentLocation();
        if (userLocation) {
          // Mapbox uses proximity parameter: longitude,latitude (note the order!)
          proximityParam = `&proximity=${userLocation.longitude},${userLocation.latitude}`;
        }
      } catch (locationError) {
        console.log('Could not get user location for proximity bias');
      }

      const accessToken = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;

      // Mapbox Geocoding API endpoint
      // Limit to US addresses, autocomplete mode, limit 5 results
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${accessToken}` +
        `&country=us` + // Limit to US
        `&types=address,poi` + // Address and points of interest
        `&limit=5` + // Max 5 results
        `&autocomplete=true` + // Enable autocomplete
        proximityParam
      );

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const formattedSuggestions = data.features.map(feature => ({
          id: feature.id,
          name: feature.text, // Main text (e.g., "Main Street")
          address: feature.place_name.replace(feature.text + ', ', ''), // Secondary text
          full_description: feature.place_name, // Full formatted address
          coordinates: {
            latitude: feature.center[1], // Mapbox returns [lng, lat]
            longitude: feature.center[0]
          }
        }));

        if (fieldType === 'pickup') {
          setPickupSuggestions(formattedSuggestions);
        } else if (fieldType === 'dropoff') {
          setDropoffSuggestions(formattedSuggestions);
        }
      } else {
        console.log('Mapbox Geocoding: No results found');
        if (fieldType === 'pickup') setPickupSuggestions([]);
        if (fieldType === 'dropoff') setDropoffSuggestions([]);
      }
    } catch (error) {
      console.error('Mapbox geocoding error:', error);
      if (fieldType === 'pickup') setPickupSuggestions([]);
      if (fieldType === 'dropoff') setDropoffSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Animation helper functions
  const startLocationLoading = () => {
    setIsLoadingCurrentLocation(true);

    // Reset and start continuous rotation
    rotationAnim.setValue(0);
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopLocationLoading = () => {
    setIsLoadingCurrentLocation(false);
    rotationAnim.stopAnimation();
    rotationAnim.setValue(0);
  };

  const showSuccessAnimation = () => {
    setShowLocationSuccess(true);
    setTimeout(() => setShowLocationSuccess(false), 1500);
  };

  // Get current location for pickup or dropoff field
  const handleUseCurrentLocation = async (fieldType = 'pickup') => {
    try {
      startLocationLoading();

      const location = await MapboxLocationService.getCurrentLocation();

      if (location) {
        const coordinates = {
          latitude: location.latitude,
          longitude: location.longitude
        };

        let addressText = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

        try {
          const addressData = await MapboxLocationService.reverseGeocode(
            location.latitude,
            location.longitude
          );

          if (addressData && addressData.address) {
            addressText = addressData.address;
          }
        } catch (geocodeError) {
          console.log('Reverse geocoding failed, using coordinates:', geocodeError);
        }

        // Set the appropriate field based on fieldType
        if (fieldType === 'pickup') {
          setPickup(addressText);
          setPickupCoordinates(coordinates);
          setPickupSuggestions([]);
        } else {
          setDropoff(addressText);
          setDropoffCoordinates(coordinates);
          setDropoffSuggestions([]);
        }

        showSuccessAnimation();
        setActiveField(null);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please check your location permissions and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      stopLocationLoading();
    }
  };

  // Generate next 7 days
  const getNextWeekDates = () => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date,
        dayName: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        fullDate: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      });
    }
    return dates;
  };

  // Generate time slots
  const getTimeSlots = () => {
    const slots = [];
    const currentTime = new Date();
    const selectedDateObj = selectedDate?.date || new Date();
    const isToday = selectedDateObj.toDateString() === currentTime.toDateString();

    // Start from current time + 1 hour if today, otherwise from 8 AM
    let startHour = isToday ? Math.max(currentTime.getHours() + 1, 8) : 8;
    const endHour = 22; // 10 PM

    for (let hour = startHour; hour <= endHour; hour++) {
      // Add :00 and :30 slots
      for (let minute of [0, 30]) {
        if (hour === endHour && minute === 30) break; // Don't add 10:30 PM

        const time = new Date();
        time.setHours(hour, minute, 0, 0);

        slots.push({
          time: time,
          display: time.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          value: `${hour}:${minute.toString().padStart(2, '0')}`
        });
      }
    }
    return slots;
  };

  // Reset animation values when modal opens/closes
  useEffect(() => {
    if (visible) {
      console.log('CustomerSearchModal is now visible');
      translateY.setValue(SCREEN_HEIGHT - COLLAPSED_HEIGHT);
      setIsExpanded(false);
      // Location is now set only by user request via "Use current location" option
    } else {
      // Reset form data when modal closes
      console.log('CustomerSearchModal is now hidden, resetting form');
      setPickup('');
      setDropoff('');
      setIsExpanded(false);
      setIsScheduled(false);
      setSelectedDate(null);
      setSelectedTime(null);
      // Reset Places API states
      setPickupSuggestions([]);
      setDropoffSuggestions([]);
      setActiveField(null);
      setPickupCoordinates(null);
      setDropoffCoordinates(null);
    }
  }, [visible]);

  // Improved pan responder with better gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        translateY.setOffset(translateY._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = gestureState.dy;
        if (newValue >= -(SCREEN_HEIGHT - COLLAPSED_HEIGHT - 60)) {
          translateY.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();

        const currentY = translateY._value;
        const velocity = gestureState.vy;

        let finalY;
        let shouldExpand;
        let shouldClose = false;

        if (velocity > 1.5) {
          if (currentY > SCREEN_HEIGHT - COLLAPSED_HEIGHT - 100) {
            finalY = MODAL_HEIGHT;
            shouldClose = true;
          } else {
            finalY = SCREEN_HEIGHT - COLLAPSED_HEIGHT;
            shouldExpand = false;
          }
        } else if (velocity < -1.5) {
          finalY = 100;
          shouldExpand = true;
        } else {
          const expandedThreshold = (100 + SCREEN_HEIGHT - COLLAPSED_HEIGHT) / 2;
          const closeThreshold = SCREEN_HEIGHT - COLLAPSED_HEIGHT + 50;

          if (currentY < expandedThreshold) {
            finalY = 100;
            shouldExpand = true;
          } else if (currentY > closeThreshold) {
            finalY = MODAL_HEIGHT;
            shouldClose = true;
          } else {
            finalY = SCREEN_HEIGHT - COLLAPSED_HEIGHT;
            shouldExpand = false;
          }
        }

        if (shouldClose) {
          Animated.spring(translateY, {
            toValue: finalY,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start(() => {
            translateY.setValue(MODAL_HEIGHT);
            onClose();
          });
        } else {
          setIsExpanded(shouldExpand);
          Animated.spring(translateY, {
            toValue: finalY,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  useImperativeHandle(ref, () => ({
    openExpanded: () => {
      setIsExpanded(true);
      const targetHeight = isScheduled ? 50 : 100;
      Animated.spring(translateY, {
        toValue: targetHeight,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    },
    openCollapsed: () => {
      setIsExpanded(false);
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - COLLAPSED_HEIGHT,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    }
  }));

  const expandModal = () => {
    setIsExpanded(true);
    const targetHeight = isScheduled ? 50 : 100; // Higher when scheduling to show more content
    Animated.spring(translateY, {
      toValue: targetHeight,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.spring(translateY, {
      toValue: MODAL_HEIGHT,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start(() => {
      translateY.setValue(MODAL_HEIGHT);
      onClose();
    });
  };

  const handleConfirm = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      Alert.alert('Missing Information', 'Please enter both pickup and dropoff locations.');
      return;
    }

    // Check if scheduling is enabled but date/time not selected
    if (isScheduled && (!selectedDate || !selectedTime)) {
      if (!selectedDate) {
        Alert.alert('Date Required', 'Please select a date for your scheduled pickup.');
        setShowDatePicker(true);
      } else if (!selectedTime) {
        Alert.alert('Time Required', 'Please select a time for your scheduled pickup.');
        setShowTimePicker(true);
      }
      return;
    }

    try {
      // Use stored coordinates if available from Places API, otherwise geocode
      console.log('Validating addresses...');

      let pickupValidation, dropoffValidation;

      // Check if we have coordinates from Places API selection
      if (pickupCoordinates) {
        pickupValidation = {
          latitude: pickupCoordinates.latitude,
          longitude: pickupCoordinates.longitude
        };
        console.log('Using stored pickup coordinates from Places API');
      } else {
        pickupValidation = await MapboxLocationService.geocodeAddress(pickup.trim()).catch(err => ({ error: err.message }));
        console.log('Geocoding pickup address with Mapbox');
      }

      if (dropoffCoordinates) {
        dropoffValidation = {
          latitude: dropoffCoordinates.latitude,
          longitude: dropoffCoordinates.longitude
        };
        console.log('Using stored dropoff coordinates from Places API');
      } else {
        dropoffValidation = await MapboxLocationService.geocodeAddress(dropoff.trim()).catch(err => ({ error: err.message }));
        console.log('Geocoding dropoff address with Mapbox');
      }

      // Check for validation errors
      if (pickupValidation.error) {
        Alert.alert(
          'Invalid Pickup Address',
          'Please enter a valid pickup address. We couldn\'t find the location you specified.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (dropoffValidation.error) {
        Alert.alert(
          'Invalid Dropoff Address',
          'Please enter a valid dropoff address. We couldn\'t find the location you specified.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if addresses are too close (less than 0.5 miles)
      const distance = MapboxLocationService.calculateDistance(
        pickupValidation.latitude, pickupValidation.longitude,
        dropoffValidation.latitude, dropoffValidation.longitude
      );

      if (distance < 0.5) {
        Alert.alert(
          'Locations Too Close',
          'Pickup and dropoff locations must be at least 0.5 miles apart for delivery service.',
          [{ text: 'OK' }]
        );
        return;
      }

      const locationData = {
        pickup: {
          address: pickup.trim(),
          coordinates: {
            latitude: pickupValidation.latitude,
            longitude: pickupValidation.longitude
          }
        },
        dropoff: {
          address: dropoff.trim(),
          coordinates: {
            latitude: dropoffValidation.latitude,
            longitude: dropoffValidation.longitude
          }
        },
        isScheduled,
        scheduledDateTime: isScheduled && selectedDate && selectedTime ? {
          date: selectedDate.fullDate,
          time: selectedTime.display,
          dateTime: new Date(
            selectedDate.date.getFullYear(),
            selectedDate.date.getMonth(),
            selectedDate.date.getDate(),
            parseInt(selectedTime.value.split(':')[0]),
            parseInt(selectedTime.value.split(':')[1])
          )
        } : null
      };

      console.log('Confirming with validated location data:', JSON.stringify(locationData, null, 2));
      onConfirm(locationData);
      closeModal();

    } catch (error) {
      console.error('Error validating addresses:', error);
      Alert.alert(
        'Validation Error',
        'Unable to validate addresses. Please check your internet connection and try again.',
        [
          { text: 'Cancel' },
          {
            text: 'Continue Anyway',
            style: 'destructive',
            onPress: () => {
              // Fallback to original behavior without validation
              const locationData = {
                pickup: {
                  address: pickup.trim(),
                  coordinates: null // No coordinates available in fallback
                },
                dropoff: {
                  address: dropoff.trim(),
                  coordinates: null // No coordinates available in fallback
                },
                isScheduled,
                scheduledDateTime: isScheduled && selectedDate && selectedTime ? {
                  date: selectedDate.fullDate,
                  time: selectedTime.display,
                  dateTime: new Date(
                    selectedDate.date.getFullYear(),
                    selectedDate.date.getMonth(),
                    selectedDate.date.getDate(),
                    parseInt(selectedTime.value.split(':')[0]),
                    parseInt(selectedTime.value.split(':')[1])
                  )
                } : null
              };
              onConfirm(locationData);
              closeModal();
            }
          }
        ]
      );
    }
  };

  // Handle Mapbox suggestion selection
  const handlePlaceSelection = async (place, fieldType) => {
    try {
      // Mapbox autocomplete already includes coordinates, no need for second API call
      if (fieldType === 'pickup') {
        setPickup(place.full_description);
        setPickupSuggestions([]);
        setActiveField(null);
        // Store coordinates directly from the suggestion
        setPickupCoordinates({
          latitude: place.coordinates.latitude,
          longitude: place.coordinates.longitude
        });
        console.log('Pickup selected:', place.full_description);
        console.log('Pickup coordinates:', place.coordinates);
      } else if (fieldType === 'dropoff') {
        setDropoff(place.full_description);
        setDropoffSuggestions([]);
        setActiveField(null);
        // Store coordinates directly from the suggestion
        setDropoffCoordinates({
          latitude: place.coordinates.latitude,
          longitude: place.coordinates.longitude
        });
        console.log('Dropoff selected:', place.full_description);
        console.log('Dropoff coordinates:', place.coordinates);
      }
    } catch (error) {
      console.error('Error selecting place:', error);
      // Fallback: just set the text without coordinates
      if (fieldType === 'pickup') {
        setPickup(place.full_description);
        setPickupSuggestions([]);
        setActiveField(null);
        setPickupCoordinates(null);
      } else if (fieldType === 'dropoff') {
        setDropoff(place.full_description);
        setDropoffSuggestions([]);
        setActiveField(null);
        setDropoffCoordinates(null);
      }
    }
  };

  // Handle text input changes with API calls
  const handlePickupChange = (text) => {
    setPickup(text);
    setActiveField('pickup');
    searchPlaces(text, 'pickup');
    // Clear stored coordinates when user types manually
    setPickupCoordinates(null);
    if (text.length === 0) {
      setPickupSuggestions([]);
      setActiveField(null);
    }
  };

  const handleDropoffChange = (text) => {
    setDropoff(text);
    setActiveField('dropoff');
    searchPlaces(text, 'dropoff');
    // Clear stored coordinates when user types manually
    setDropoffCoordinates(null);
    if (text.length === 0) {
      setDropoffSuggestions([]);
      setActiveField(null);
    }
  };

  const toggleScheduling = () => {
    setIsScheduled(!isScheduled);
    if (isScheduled) {
      setSelectedDate(null);
      setSelectedTime(null);
      // Make modal smaller when turning off scheduling
      if (isExpanded) {
        Animated.spring(translateY, {
          toValue: 100,
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
      }
    } else {
      // Make modal larger when turning on scheduling
      if (isExpanded) {
        Animated.spring(translateY, {
          toValue: 50, // Nearly full screen
          useNativeDriver: false,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  };

  const handleDateSelect = (date) => {
    console.log('Date selected:', date);
    setSelectedDate(date);
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleTimeSelect = (time) => {
    console.log('Time selected:', time);
    setSelectedTime(time);
    setShowTimePicker(false);
  };

  const getScheduleButtonText = () => {
    if (!isScheduled) return 'Pickup Now';
    if (isScheduled && !selectedDate) return 'Schedule for Later';
    if (selectedDate && !selectedTime) return `${selectedDate.dayName}, ${selectedDate.monthName} ${selectedDate.dayNumber}`;
    if (selectedDate && selectedTime) return `${selectedDate.dayName}, ${selectedTime.display}`;
    return 'Schedule for Later';
  };

  useEffect(() => {
    return () => {
      translateY.removeAllListeners();
      translateY.stopAnimation();
      rotationAnim.stopAnimation();
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={closeModal}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: translateY.interpolate({
                inputRange: [100, SCREEN_HEIGHT - COLLAPSED_HEIGHT],
                outputRange: [0.5, 0],
                extrapolate: 'clamp',
              }),
            }
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Modal */}
      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Draggable Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Collapsed Header */}
        {!isExpanded && (
          <TouchableOpacity
            style={styles.collapsedHeader}
            onPress={expandModal}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <Text style={styles.collapsedText}>Where do you want to go?</Text>
          </TouchableOpacity>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <KeyboardAvoidingView
            style={styles.expandedContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView
                style={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContentContainer}
              >
                {/* Header */}
                <View style={styles.header}>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.title}>Select Pickup and Drop</Text>
                  <View style={{ width: 24 }} />
                </View>

                {/* Pickup Time Button */}
                <TouchableOpacity style={styles.pickupNowButton} onPress={toggleScheduling}>
                  <Ionicons
                    name={isScheduled ? "calendar-outline" : "time-outline"}
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.pickupNowText}>{getScheduleButtonText()}</Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>

                {/* Scheduling Options */}
                {isScheduled && (
                  <View style={styles.schedulingContainer}>
                    <TouchableOpacity
                      style={styles.dateTimeButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#A77BFF" />
                      <Text style={styles.dateTimeButtonText}>
                        {selectedDate ? selectedDate.fullDate : 'Select Date'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#999" />
                    </TouchableOpacity>

                    {selectedDate && (
                      <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={18} color="#A77BFF" />
                        <Text style={styles.dateTimeButtonText}>
                          {selectedTime ? selectedTime.display : 'Select Time'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Input Section */}
                <View style={styles.inputBox}>
                  <View style={styles.inputRowStyled}>
                    <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#00D4AA" />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Choose pick up point"
                      placeholderTextColor="#888"
                      value={pickup}
                      onChangeText={handlePickupChange}
                      onFocus={() => setActiveField('pickup')}
                      autoFocus={false}
                    />
                    {pickup.trim() && (
                      <TouchableOpacity onPress={() => {
                        setPickup('');
                        setPickupSuggestions([]);
                        setActiveField(null);
                        setPickupCoordinates(null);
                      }}>
                        <Ionicons name="close-circle" size={18} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.dotLine}>
                    {[...Array(8)].map((_, i) => (
                      <View key={i} style={styles.dot} />
                    ))}
                  </View>

                  <View style={styles.inputRowStyled}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#A77BFF" />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Choose your destination"
                      placeholderTextColor="#888"
                      value={dropoff}
                      onChangeText={handleDropoffChange}
                      onFocus={() => setActiveField('dropoff')}
                    />
                    {dropoff.trim() && (
                      <TouchableOpacity onPress={() => {
                        setDropoff('');
                        setDropoffSuggestions([]);
                        setActiveField(null);
                        setDropoffCoordinates(null);
                      }}>
                        <Ionicons name="close-circle" size={18} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Live Places API suggestions when typing, otherwise show static suggestions */}
                {activeField === 'pickup' ? (
                  <>
                    {/* Use Current Location Option - always visible for pickup */}
                    <TouchableOpacity
                      style={styles.currentLocationRow}
                      onPress={() => handleUseCurrentLocation('pickup')}
                      activeOpacity={0.7}
                      disabled={isLoadingCurrentLocation}
                    >
                      <View style={[styles.suggestionIcon, styles.currentLocationIcon]}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#00D4AA" />
                      </View>
                      <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionName}>Use current location</Text>
                        <Text style={styles.suggestionAddress}>
                          {isLoadingCurrentLocation ? 'Getting location...' : 'Your current GPS location'}
                        </Text>
                      </View>
                      {isLoadingCurrentLocation && (
                        <Animated.View
                          style={{
                            transform: [{
                              rotate: rotationAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg']
                              })
                            }]
                          }}
                        >
                          <Ionicons name="refresh" size={18} color="#00D4AA" />
                        </Animated.View>
                      )}
                    </TouchableOpacity>

                    {pickupSuggestions.length > 0 && (
                      <>
                        <Text style={styles.suggestionsTitle}>
                          {isLoadingSuggestions ? 'Searching...' : 'Pickup Suggestions'}
                        </Text>
                        {pickupSuggestions.map((place) => (
                          <TouchableOpacity
                            key={place.id}
                            style={styles.suggestionRow}
                            onPress={() => handlePlaceSelection(place, 'pickup')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.suggestionIcon}>
                              <Ionicons name="location-outline" size={20} color="#00D4AA" />
                            </View>
                            <View style={styles.suggestionContent}>
                              <Text style={styles.suggestionName}>{place.name}</Text>
                              <Text style={styles.suggestionAddress}>{place.address}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </>
                ) : activeField === 'dropoff' ? (
                  <>
                    {/* Use Current Location Option - also available for dropoff */}
                    <TouchableOpacity
                      style={styles.currentLocationRow}
                      onPress={() => handleUseCurrentLocation('dropoff')}
                      activeOpacity={0.7}
                      disabled={isLoadingCurrentLocation}
                    >
                      <View style={[styles.suggestionIcon, styles.currentLocationIcon]}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#A77BFF" />
                      </View>
                      <View style={styles.suggestionContent}>
                        <Text style={styles.suggestionName}>Use current location</Text>
                        <Text style={styles.suggestionAddress}>
                          {isLoadingCurrentLocation ? 'Getting location...' : 'Your current GPS location'}
                        </Text>
                      </View>
                      {isLoadingCurrentLocation && (
                        <Animated.View
                          style={{
                            transform: [{
                              rotate: rotationAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg']
                              })
                            }]
                          }}
                        >
                          <Ionicons name="refresh" size={18} color="#A77BFF" />
                        </Animated.View>
                      )}
                    </TouchableOpacity>

                    {dropoffSuggestions.length > 0 && (
                      <>
                        <Text style={styles.suggestionsTitle}>
                          {isLoadingSuggestions ? 'Searching...' : 'Destination Suggestions'}
                        </Text>
                        {dropoffSuggestions.map((place) => (
                          <TouchableOpacity
                            key={place.id}
                            style={styles.suggestionRow}
                            onPress={() => handlePlaceSelection(place, 'dropoff')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.suggestionIcon}>
                              <Ionicons name="location-outline" size={20} color="#A77BFF" />
                            </View>
                            <View style={styles.suggestionContent}>
                              <Text style={styles.suggestionName}>{place.name}</Text>
                              <Text style={styles.suggestionAddress}>{place.address}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                  </>
                ) : null}

                {/* Confirm Button - Always show when locations are filled */}
                {pickup.trim() && dropoff.trim() && (
                  <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.confirmButtonText}>
                      {isScheduled ? 'Schedule Pickup' : 'Confirm Locations'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        )}
      </Animated.View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
          presentationStyle="overFullScreen"
        >
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback onPress={() => { }}>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.pickerTitle}>Select Date</Text>
                    <View style={{ width: 60 }} />
                  </View>

                  <ScrollView
                    style={styles.pickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {getNextWeekDates().map((date, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.dateOption}
                        onPress={() => handleDateSelect(date)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dateOptionLeft}>
                          <Text style={styles.dateOptionDay}>{date.dayName}</Text>
                          <Text style={styles.dateOptionDate}>{date.monthName} {date.dayNumber}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#A77BFF" />
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: 20 }} />
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
          presentationStyle="overFullScreen"
        >
          <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback onPress={() => { }}>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.pickerTitle}>Select Time</Text>
                    <View style={{ width: 60 }} />
                  </View>

                  <ScrollView
                    style={styles.pickerScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    {getTimeSlots().map((time, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.timeOption}
                        onPress={() => handleTimeSelect(time)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeOptionText}>{time.display}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#A77BFF" />
                      </TouchableOpacity>
                    ))}
                    <View style={{ height: 20 }} />
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 998,
  },
  modal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT, // Full screen height
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchIcon: {
    marginRight: 12,
  },
  collapsedText: {
    color: '#999',
    fontSize: 16,
    flex: 1,
  },
  expandedContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContentContainer: {
    paddingBottom: 20, // Minimal padding to keep button visible
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickupNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F2F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  pickupNowText: {
    color: '#fff',
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  schedulingContainer: {
    marginBottom: 16, // Reduced from 20
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141426',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  dateTimeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  inputBox: {
    backgroundColor: '#141426',
    borderRadius: 12,
    padding: 12, // Reduced from 16
    marginBottom: 20, // Reduced from 25
    borderWidth: 1,
    borderColor: '#2A2A3B',
  },
  inputRowStyled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6, // Reduced from 8
  },
  inputField: {
    flex: 1,
    marginLeft: 12,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 4,
  },
  dotLine: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 6, // Reduced from 8
    marginLeft: 9,
  },
  dot: {
    width: 2,
    height: 2,
    backgroundColor: '#666',
    borderRadius: 1,
    marginVertical: 1,
  },
  suggestionsTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12, // Reduced from 15
    marginLeft: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Reduced from 14
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 3, // Reduced from 4
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F1F2F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionAddress: {
    color: '#aaa',
    fontSize: 13,
  },
  confirmButton: {
    backgroundColor: '#A77BFF',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 15, // Reduced from 20
    marginBottom: 20, // Reduced from 40
    shadowColor: '#A77BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    zIndex: 10000,
  },
  pickerContainer: {
    backgroundColor: '#0A0A1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 450, // Increased from 300
    maxHeight: SCREEN_HEIGHT * 0.85, // Increased from 0.7
    borderWidth: 1,
    borderColor: '#2A2A3B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3B',
    backgroundColor: '#0A0A1F',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  pickerCancelText: {
    color: '#A77BFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerScroll: {
    flex: 1,
    backgroundColor: '#0A0A1F',
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20, // Increased from 18 for better spacing
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A3A',
    backgroundColor: '#0A0A1F',
  },
  dateOptionLeft: {
    flex: 1,
  },
  dateOptionDay: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateOptionDate: {
    color: '#999',
    fontSize: 14,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A3A',
    backgroundColor: '#0A0A1F',
  },
  timeOptionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(167, 123, 255, 0.08)',
  },
  currentLocationIcon: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
  },
});

export default CustomerSearchModal;