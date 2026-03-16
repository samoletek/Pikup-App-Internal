import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import MapboxLocationService from '../../../services/MapboxLocationService';
import { appConfig } from '../../../config/appConfig';
import { logger } from '../../../services/logger';

export const MAX_SCHEDULE_DAYS_AHEAD = 30;

const getMaxScheduleDate = () => {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + MAX_SCHEDULE_DAYS_AHEAD);
  maxDate.setHours(23, 59, 59, 999);
  return maxDate;
};

const getMinScheduleDate = () => {
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  return minDate;
};

const safeParseDate = (value) => {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export default function useAddressSearchStepState({
  orderData,
  setOrderData,
  userLocation,
  saveToRecentAddresses,
}) {
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(false);
  const [activePicker, setActivePicker] = useState(null);
  const searchTimeoutRef = useRef(null);

  const minScheduleDate = getMinScheduleDate();
  const maxScheduleDate = getMaxScheduleDate();

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, []);

  const clearSuggestions = useCallback((fieldType) => {
    if (fieldType === 'pickup') {
      setPickupSuggestions([]);
    } else {
      setDropoffSuggestions([]);
    }
  }, []);

  const clampScheduledDate = useCallback((date, showDateLimitAlert = false) => {
    const now = new Date();
    const maxDate = getMaxScheduleDate();

    if (date > maxDate) {
      if (showDateLimitAlert) {
        Alert.alert(
          'Date limit reached',
          `You can schedule rides up to ${MAX_SCHEDULE_DAYS_AHEAD} days in advance.`
        );
      }
      return new Date(maxDate.getTime());
    }
    if (date < now) {
      return new Date(now.getTime());
    }
    return date;
  }, []);

  const parseScheduledDateTime = useCallback(
    () => safeParseDate(orderData.scheduledDateTime),
    [orderData.scheduledDateTime]
  );

  const normalizeScheduledDate = useCallback(
    (date) => clampScheduledDate(date, true),
    [clampScheduledDate]
  );

  const getDatePickerValue = useCallback(
    () => clampScheduledDate(parseScheduledDateTime()),
    [clampScheduledDate, parseScheduledDateTime]
  );

  const searchPlaces = useCallback(async (query, fieldType) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query || query.length < 2) {
      clearSuggestions(fieldType);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoadingSuggestions(true);
        const accessToken = appConfig.mapbox.publicToken;
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          `access_token=${accessToken}&country=us&types=address,place,poi&limit=7&autocomplete=true&fuzzy_match=true`;

        if (userLocation) {
          url += `&proximity=${userLocation.longitude},${userLocation.latitude}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.features?.length > 0) {
          const formattedSuggestions = data.features.map((feature) => ({
            id: feature.id,
            name: feature.text,
            address: feature.place_name.replace(`${feature.text}, `, ''),
            full_description: feature.place_name,
            coordinates: { latitude: feature.center[1], longitude: feature.center[0] },
          }));

          if (fieldType === 'pickup') {
            setPickupSuggestions(formattedSuggestions);
          } else {
            setDropoffSuggestions(formattedSuggestions);
          }
        } else {
          clearSuggestions(fieldType);
        }
      } catch (error) {
        logger.error('AddressSearchStepState', 'Geocoding error', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);
  }, [clearSuggestions, userLocation]);

  const handlePlaceSelection = useCallback((place, fieldType) => {
    Keyboard.dismiss();
    const locationData = { address: place.full_description, coordinates: place.coordinates };
    setOrderData((prev) => ({ ...prev, [fieldType]: locationData }));
    clearSuggestions(fieldType);
    setActiveField(null);
    saveToRecentAddresses(place);
  }, [clearSuggestions, saveToRecentAddresses, setOrderData]);

  const handleUseCurrentLocation = useCallback(async (fieldType = 'pickup') => {
    Keyboard.dismiss();
    try {
      setIsLoadingCurrentLocation(true);
      const location = await MapboxLocationService.getCurrentLocation({
        maximumAge: 180000,
        timeoutMs: 8000,
      });

      if (location) {
        const coordinates = { latitude: location.latitude, longitude: location.longitude };
        const fallbackAddress = `Current location (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`;

        setOrderData((prev) => ({ ...prev, [fieldType]: { address: fallbackAddress, coordinates } }));
        clearSuggestions(fieldType);
        setActiveField(null);

        MapboxLocationService.reverseGeocode(location.latitude, location.longitude)
          .then((addressData) => {
            if (!addressData?.address) return;

            setOrderData((prev) => {
              const selectedCoords = prev[fieldType]?.coordinates;
              const sameCoords =
                selectedCoords &&
                Math.abs(selectedCoords.latitude - coordinates.latitude) < 0.00001 &&
                Math.abs(selectedCoords.longitude - coordinates.longitude) < 0.00001;

              if (!sameCoords) return prev;

              return {
                ...prev,
                [fieldType]: {
                  ...prev[fieldType],
                  address: addressData.address,
                },
              };
            });
          })
          .catch((err) => {
            logger.warn('AddressSearchStepState', 'Reverse geocoding failed', err);
          });
      }
    } catch (_error) {
      Alert.alert('Location Error', 'Unable to get current location.');
    } finally {
      setIsLoadingCurrentLocation(false);
    }
  }, [clearSuggestions, setOrderData]);

  const updateAddressInput = useCallback((fieldType, text) => {
    setOrderData((prev) => ({ ...prev, [fieldType]: { address: text, coordinates: null } }));
    setActiveField(fieldType);
    searchPlaces(text, fieldType);
  }, [searchPlaces, setOrderData]);

  const clearAddressInput = useCallback((fieldType) => {
    setOrderData((prev) => ({ ...prev, [fieldType]: { address: '', coordinates: null } }));
    clearSuggestions(fieldType);
  }, [clearSuggestions, setOrderData]);

  const applyScheduledChange = useCallback((selectedDate, mode) => {
    if (!selectedDate) return;

    const currentDate = parseScheduledDateTime();
    if (mode === 'date') {
      currentDate.setFullYear(selectedDate.getFullYear());
      currentDate.setMonth(selectedDate.getMonth());
      currentDate.setDate(selectedDate.getDate());
    } else {
      currentDate.setHours(selectedDate.getHours());
      currentDate.setMinutes(selectedDate.getMinutes());
    }

    const normalized = normalizeScheduledDate(currentDate);
    setOrderData((prev) => ({ ...prev, scheduledDateTime: normalized.toISOString() }));
  }, [normalizeScheduledDate, parseScheduledDateTime, setOrderData]);

  const setScheduledMode = useCallback(() => {
    const normalizedDateTime = orderData.scheduledDateTime
      ? clampScheduledDate(safeParseDate(orderData.scheduledDateTime))
      : clampScheduledDate(new Date());

    setOrderData((prev) => ({
      ...prev,
      scheduleType: 'scheduled',
      scheduledDateTime: normalizedDateTime.toISOString(),
    }));
  }, [clampScheduledDate, orderData.scheduledDateTime, setOrderData]);

  const openPicker = useCallback((pickerType) => {
    if (orderData.scheduleType !== 'scheduled') {
      return;
    }
    setActivePicker(pickerType);
  }, [orderData.scheduleType]);

  const closePicker = useCallback(() => setActivePicker(null), []);

  const handleOutsideTap = useCallback(() => {
    if (activeField) {
      setActiveField(null);
      Keyboard.dismiss();
    }
  }, [activeField]);

  return {
    pickupSuggestions,
    dropoffSuggestions,
    activeField,
    setActiveField,
    isLoadingSuggestions,
    isLoadingCurrentLocation,
    activePicker,
    minScheduleDate,
    maxScheduleDate,
    parseScheduledDateTime,
    getDatePickerValue,
    handlePlaceSelection,
    handleUseCurrentLocation,
    updateAddressInput,
    clearAddressInput,
    applyScheduledChange,
    setScheduledMode,
    openPicker,
    closePicker,
    handleOutsideTap,
  };
}
