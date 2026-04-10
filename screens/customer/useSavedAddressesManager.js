import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MapboxLocationService from '../../services/MapboxLocationService';
import { logger } from '../../services/logger';
import { appConfig } from '../../config/appConfig';
import { SUPPORTED_ORDER_COUNTRY_QUERY } from '../../constants/orderAvailability';
import styles from './CustomerSavedAddressesScreen.styles';
import {
  buildAddressRecord,
  RECENT_ADDRESSES_KEY,
} from './savedAddresses.utils';
import { buildAddressSuggestionFromMapboxFeature } from '../../utils/mapboxAddressFormatter';
import {
  renderAddressRowItem,
  renderAddressSuggestions,
  renderAddressSuggestionsLoading,
  renderEmptySavedAddresses,
} from './savedAddresses.renderers';

export default function useSavedAddressesManager() {
  const searchTimeoutRef = useRef(null);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [editingAddressText, setEditingAddressText] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const hasSuggestions = suggestions.length > 0;

  const loadSavedAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      setSavedAddresses(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      logger.error('SavedAddressesManager', 'Failed to load saved addresses', error);
      setSavedAddresses([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistSavedAddresses = useCallback(async (nextAddresses) => {
    await AsyncStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(nextAddresses));
    setSavedAddresses(nextAddresses);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedAddresses();
    }, [loadSavedAddresses])
  );

  useEffect(() => {
    const loadLocationBias = async () => {
      try {
        const lastKnownLocation = await MapboxLocationService.getLastKnownLocation();
        if (lastKnownLocation?.latitude && lastKnownLocation?.longitude) {
          setCurrentLocation(lastKnownLocation);
        }
      } catch (error) {
        logger.warn('SavedAddressesManager', 'Failed to load last known location for address bias', error);
      }
    };

    void loadLocationBias();
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalVisible(false);
    setEditingIndex(null);
    setIsCreatingAddress(false);
    setEditingAddressText('');
    setSuggestions([]);
    setSelectedSuggestion(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingIndex(null);
    setIsCreatingAddress(true);
    setEditingAddressText('');
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsEditModalVisible(true);
  }, []);

  const openEditModal = useCallback((addressItem, index) => {
    setEditingIndex(index);
    setIsCreatingAddress(false);
    setEditingAddressText(addressItem?.full_description || '');
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsEditModalVisible(true);
  }, []);

  const searchAddressSuggestions = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoadingSuggestions(true);
        const accessToken = appConfig.mapbox.publicToken;
        let url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          `access_token=${accessToken}&country=${encodeURIComponent(SUPPORTED_ORDER_COUNTRY_QUERY)}&types=address,place,poi&limit=7&autocomplete=true&fuzzy_match=true`;

        if (currentLocation?.longitude && currentLocation?.latitude) {
          url += `&proximity=${currentLocation.longitude},${currentLocation.latitude}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data?.features?.length > 0) {
          const formatted = data.features.map((feature) =>
            buildAddressSuggestionFromMapboxFeature(feature)
          );
          setSuggestions(formatted);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        logger.error('SavedAddressesManager', 'Address search error', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);
  }, [currentLocation]);

  const handleAddressTextChange = useCallback((text) => {
    setEditingAddressText(text);
    setSelectedSuggestion(null);
    searchAddressSuggestions(text);
  }, [searchAddressSuggestions]);

  const handleSuggestionSelect = useCallback((suggestion) => {
    setSelectedSuggestion(suggestion);
    setEditingAddressText(suggestion.full_description);
    setSuggestions([]);
  }, []);

  const handleSaveEditedAddress = useCallback(async () => {
    const nextText = editingAddressText.trim();
    if (!nextText) {
      Alert.alert('Address required', 'Please enter an address.');
      return;
    }

    try {
      let nextAddresses = [];

      if (isCreatingAddress) {
        const newRecord = buildAddressRecord(nextText, null, selectedSuggestion);
        const normalizedDescription = (newRecord.full_description || '').trim().toLowerCase();
        const deduped = savedAddresses.filter((item) => {
          const itemDescription = (item?.full_description || '').trim().toLowerCase();
          const sameId = Boolean(item?.id && newRecord?.id && item.id === newRecord.id);
          return !sameId && itemDescription !== normalizedDescription;
        });
        nextAddresses = [newRecord, ...deduped];
      } else {
        if (editingIndex === null || editingIndex < 0 || editingIndex >= savedAddresses.length) {
          closeEditModal();
          return;
        }

        const previousRecord = savedAddresses[editingIndex];
        const updatedRecord = buildAddressRecord(nextText, previousRecord, selectedSuggestion);
        nextAddresses = [...savedAddresses];
        nextAddresses[editingIndex] = updatedRecord;
      }

      await persistSavedAddresses(nextAddresses);
      closeEditModal();
    } catch (error) {
      logger.error('SavedAddressesManager', 'Failed to update saved address', error);
      Alert.alert('Error', 'Could not update address. Please try again.');
    }
  }, [
    closeEditModal,
    editingAddressText,
    editingIndex,
    isCreatingAddress,
    persistSavedAddresses,
    savedAddresses,
    selectedSuggestion,
  ]);

  const handleDeleteAddress = useCallback(async () => {
    if (editingIndex === null || editingIndex < 0 || editingIndex >= savedAddresses.length) {
      closeEditModal();
      return;
    }

    Alert.alert('Delete address?', 'This saved address will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextAddresses = savedAddresses.filter((_, idx) => idx !== editingIndex);
            await persistSavedAddresses(nextAddresses);
            closeEditModal();
          } catch (error) {
            logger.error('SavedAddressesManager', 'Failed to delete saved address', error);
            Alert.alert('Error', 'Could not delete address. Please try again.');
          }
        },
      },
    ]);
  }, [closeEditModal, editingIndex, persistSavedAddresses, savedAddresses]);

  const renderAddressRow = useCallback(
    ({ item, index }) =>
      renderAddressRowItem({
        item,
        index,
        savedAddressesLength: savedAddresses.length,
        openEditModal,
        styles,
      }),
    [openEditModal, savedAddresses.length]
  );

  const emptyState = useMemo(
    () => renderEmptySavedAddresses({ openCreateModal, styles }),
    [openCreateModal]
  );

  const renderSuggestions = useCallback(
    () =>
      renderAddressSuggestions({
        hasSuggestions,
        suggestions,
        handleSuggestionSelect,
        styles,
      }),
    [handleSuggestionSelect, hasSuggestions, suggestions]
  );

  const renderSuggestionsLoading = useCallback(
    () => renderAddressSuggestionsLoading({ isLoadingSuggestions, styles }),
    [isLoadingSuggestions]
  );

  return {
    closeEditModal,
    editingAddressText,
    emptyState,
    handleAddressTextChange,
    handleDeleteAddress,
    handleSaveEditedAddress,
    hasSuggestions,
    isCreatingAddress,
    isEditModalVisible,
    isLoading,
    openCreateModal,
    renderAddressRow,
    savedAddresses,
    renderSuggestions,
    renderSuggestionsLoading,
  };
}
