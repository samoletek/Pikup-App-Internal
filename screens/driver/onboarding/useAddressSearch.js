import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import MapboxLocationService from '../../../services/MapboxLocationService';
import { appConfig } from '../../../config/appConfig';
import { logger } from '../../../services/logger';
import { SUPPORTED_ORDER_COUNTRY_QUERY } from '../../../constants/orderAvailability';

export default function useAddressSearch({ updateFormData }) {
  const statePickerRef = useRef(null);
  const addressSearchTimeout = useRef(null);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    MapboxLocationService.getCurrentLocation()
      .then((location) => {
        if (location) {
          setUserLocation(location);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }
    };
  }, []);

  const closeStatePicker = useCallback(() => {
    if (statePickerRef.current) {
      statePickerRef.current.close();
    } else {
      setShowStatePicker(false);
    }
  }, []);

  const searchAddress = useCallback(
    (query) => {
      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }

      if (!query || query.length < 2) {
        setAddressSuggestions([]);
        return;
      }

      addressSearchTimeout.current = setTimeout(async () => {
        try {
          setIsLoadingAddress(true);
          const accessToken = appConfig.mapbox.publicToken;
          let url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
            `access_token=${accessToken}&country=${encodeURIComponent(SUPPORTED_ORDER_COUNTRY_QUERY)}&types=address,place&limit=5&autocomplete=true&fuzzy_match=true`;

          if (userLocation) {
            url += `&proximity=${userLocation.longitude},${userLocation.latitude}`;
          }

          const response = await fetch(url);
          const data = await response.json();
          setAddressSuggestions(data.features?.length > 0 ? data.features : []);
        } catch (error) {
          logger.error('OnboardingAddressSearch', 'Address search error', error);
        } finally {
          setIsLoadingAddress(false);
        }
      }, 200);
    },
    [userLocation]
  );

  const handleAddressSelect = useCallback(
    (feature) => {
      Keyboard.dismiss();
      const context = feature.context || [];

      const line1 = feature.address
        ? `${feature.address} ${feature.text}`
        : feature.place_name?.split(',')[0] || feature.text;

      const city = context.find((entry) => entry.id.startsWith('place'))?.text || '';
      const stateEntry = context.find((entry) => entry.id.startsWith('region'));
      const state = stateEntry?.short_code?.replace('US-', '') || '';
      const zip = context.find((entry) => entry.id.startsWith('postcode'))?.text || '';

      updateFormData('address.line1', line1);
      if (city) {
        updateFormData('address.city', city);
      }
      if (state) {
        updateFormData('address.state', state);
      }
      if (zip) {
        updateFormData('address.postalCode', zip);
      }

      setAddressSuggestions([]);
    },
    [updateFormData]
  );

  return {
    showStatePicker,
    setShowStatePicker,
    addressSuggestions,
    isLoadingAddress,
    statePickerRef,
    searchAddress,
    handleAddressSelect,
    closeStatePicker,
  };
}
