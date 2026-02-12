import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import MapboxLocationService from "../../services/MapboxLocationService";
import { borderRadius, colors, spacing, typography } from "../../styles/theme";

const RECENT_ADDRESSES_KEY = "@pikup_recent_addresses";
const MODAL_VERTICAL_INSET = spacing.lg;

const buildAddressRecord = (text, previousRecord, selectedPlace = null) => {
  const normalizedText = text.trim();
  const [namePart, ...restParts] = normalizedText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const resolvedName = selectedPlace?.name || namePart || previousRecord?.name || normalizedText;
  const resolvedAddress =
    selectedPlace?.address ||
    restParts.join(", ") ||
    previousRecord?.address ||
    normalizedText;

  return {
    id: selectedPlace?.id || previousRecord?.id || `saved-${Date.now()}`,
    name: resolvedName,
    address: resolvedAddress,
    full_description: selectedPlace?.full_description || normalizedText,
    coordinates: selectedPlace?.coordinates || previousRecord?.coordinates || null,
  };
};

export default function CustomerSavedAddressesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const searchTimeoutRef = useRef(null);

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [editingAddressText, setEditingAddressText] = useState("");
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
      console.error("Failed to load saved addresses:", error);
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
      loadSavedAddresses();
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
        console.log("Failed to load last known location for address bias:", error);
      }
    };

    loadLocationBias();
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const closeEditModal = useCallback(() => {
    Keyboard.dismiss();
    setIsEditModalVisible(false);
    setEditingIndex(null);
    setIsCreatingAddress(false);
    setEditingAddressText("");
    setSuggestions([]);
    setSelectedSuggestion(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingIndex(null);
    setIsCreatingAddress(true);
    setEditingAddressText("");
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsEditModalVisible(true);
  }, []);

  const openEditModal = useCallback((addressItem, index) => {
    setEditingIndex(index);
    setIsCreatingAddress(false);
    setEditingAddressText(addressItem?.full_description || "");
    setSuggestions([]);
    setSelectedSuggestion(null);
    setIsEditModalVisible(true);
  }, []);

  const searchAddressSuggestions = useCallback(
    (query) => {
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
          const accessToken = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
          let url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
              query
            )}.json?` +
            `access_token=${accessToken}&country=us&types=address,place,poi&limit=7&autocomplete=true&fuzzy_match=true`;

          if (currentLocation?.longitude && currentLocation?.latitude) {
            url += `&proximity=${currentLocation.longitude},${currentLocation.latitude}`;
          }

          const response = await fetch(url);
          const data = await response.json();

          if (data?.features?.length > 0) {
            const formatted = data.features.map((feature) => ({
              id: feature.id,
              name: feature.text,
              address: feature.place_name.replace(`${feature.text}, `, ""),
              full_description: feature.place_name,
              coordinates: {
                latitude: feature.center[1],
                longitude: feature.center[0],
              },
            }));
            setSuggestions(formatted);
          } else {
            setSuggestions([]);
          }
        } catch (error) {
          console.error("Address search error:", error);
          setSuggestions([]);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }, 300);
    },
    [currentLocation]
  );

  const handleAddressTextChange = useCallback(
    (text) => {
      setEditingAddressText(text);
      setSelectedSuggestion(null);
      searchAddressSuggestions(text);
    },
    [searchAddressSuggestions]
  );

  const handleSuggestionSelect = useCallback((suggestion) => {
    setSelectedSuggestion(suggestion);
    setEditingAddressText(suggestion.full_description);
    setSuggestions([]);
  }, []);

  const handleSaveEditedAddress = useCallback(async () => {
    const nextText = editingAddressText.trim();
    if (!nextText) {
      Alert.alert("Address required", "Please enter an address.");
      return;
    }

    try {
      let nextAddresses = [];

      if (isCreatingAddress) {
        const newRecord = buildAddressRecord(nextText, null, selectedSuggestion);
        const normalizedDescription = (newRecord.full_description || "").trim().toLowerCase();
        const deduped = savedAddresses.filter((item) => {
          const itemDescription = (item?.full_description || "").trim().toLowerCase();
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
      console.error("Failed to update saved address:", error);
      Alert.alert("Error", "Could not update address. Please try again.");
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

    Alert.alert("Delete address?", "This saved address will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const nextAddresses = savedAddresses.filter((_, idx) => idx !== editingIndex);
            await persistSavedAddresses(nextAddresses);
            closeEditModal();
          } catch (error) {
            console.error("Failed to delete saved address:", error);
            Alert.alert("Error", "Could not delete address. Please try again.");
          }
        },
      },
    ]);
  }, [closeEditModal, editingIndex, persistSavedAddresses, savedAddresses]);

  const renderAddressRow = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        style={[
          styles.addressRow,
          index === 0 && styles.addressRowFirst,
          index === savedAddresses.length - 1 && styles.addressRowLast,
        ]}
        onPress={() => openEditModal(item, index)}
        activeOpacity={0.85}
      >
        <View style={styles.addressIconWrap}>
          <Ionicons name="heart" size={18} color={colors.error} />
        </View>
        <View style={styles.addressTextWrap}>
          <Text style={styles.addressName} numberOfLines={1}>
            {item?.name || "Saved Address"}
          </Text>
          <Text style={styles.addressFullText} numberOfLines={2}>
            {item?.full_description || item?.address || "Unknown address"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
      </TouchableOpacity>
    ),
    [openEditModal, savedAddresses.length]
  );

  const emptyState = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="heart-outline" size={26} color={colors.text.muted} />
        <Text style={styles.emptyTitle}>No saved addresses yet</Text>
        <Text style={styles.emptySubtitle}>
          Add your first address manually or save one from booking.
        </Text>
        <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.emptyAddBtnText}>Add Address</Text>
        </TouchableOpacity>
      </View>
    ),
    [openCreateModal]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Addresses"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
        showBack
        rightContent={(
          <TouchableOpacity
            style={styles.headerAddButton}
            onPress={openCreateModal}
            accessibilityRole="button"
            accessibilityLabel="Add address"
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={savedAddresses}
          keyExtractor={(item, index) => `${item?.id || "saved"}-${index}`}
          renderItem={renderAddressRow}
          ListEmptyComponent={emptyState}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xl },
            savedAddresses.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        transparent
        visible={isEditModalVisible}
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <TouchableWithoutFeedback onPress={closeEditModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => null}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalCard}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {isCreatingAddress ? "Add Address" : "Edit Address"}
                  </Text>
                  <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons name="heart" size={18} color={colors.error} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Start typing an address..."
                    placeholderTextColor={colors.text.placeholder}
                    value={editingAddressText}
                    onChangeText={handleAddressTextChange}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                {isLoadingSuggestions ? (
                  <View style={styles.suggestionsLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null}

                {hasSuggestions ? (
                  <View style={styles.suggestionsCard}>
                    <FlatList
                      data={suggestions}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      style={styles.suggestionsList}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.suggestionRow}
                          onPress={() => handleSuggestionSelect(item)}
                        >
                          <Ionicons name="location-outline" size={18} color={colors.text.primary} />
                          <View style={styles.suggestionTextWrap}>
                            <Text style={styles.suggestionName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.suggestionAddress} numberOfLines={1}>
                              {item.address}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  {!isCreatingAddress ? (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={handleDeleteAddress}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.saveBtn, isCreatingAddress && styles.saveBtnFull]}
                    onPress={handleSaveEditedAddress}
                  >
                    <Text style={styles.saveBtnText}>{isCreatingAddress ? "Add" : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAddButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  addressRowFirst: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  addressRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.circle,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  addressTextWrap: {
    flex: 1,
    marginRight: spacing.base,
  },
  addressName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  addressFullText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: typography.fontSize.base,
    textAlign: "center",
  },
  emptyAddBtn: {
    marginTop: spacing.base,
    minHeight: 40,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  emptyAddBtnText: {
    marginLeft: spacing.xs,
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.strong,
    paddingHorizontal: spacing.lg,
    paddingTop: MODAL_VERTICAL_INSET,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    minHeight: 52,
    paddingHorizontal: spacing.base,
  },
  inputIcon: {
    marginRight: spacing.base,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  suggestionsLoading: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  suggestionsCard: {
    marginTop: spacing.base,
    maxHeight: 220,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.elevated,
    overflow: "hidden",
  },
  suggestionsList: {
    maxHeight: 220,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.strong,
  },
  suggestionTextWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  suggestionName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  suggestionAddress: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginTop: 1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    paddingBottom: MODAL_VERTICAL_INSET,
  },
  deleteBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  saveBtn: {
    flex: 1,
    minHeight: 48,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnFull: {
    marginLeft: 0,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
