import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';

export const renderAddressRowItem = ({
  item,
  index,
  savedAddressesLength,
  openEditModal,
  styles,
}) => (
  <TouchableOpacity
    style={[
      styles.addressRow,
      index === 0 && styles.addressRowFirst,
      index === savedAddressesLength - 1 && styles.addressRowLast,
    ]}
    onPress={() => openEditModal(item, index)}
    activeOpacity={0.85}
  >
    <View style={styles.addressIconWrap}>
      <Ionicons name="heart" size={18} color={colors.error} />
    </View>
    <View style={styles.addressTextWrap}>
      <Text style={styles.addressName} numberOfLines={1}>
        {item?.name || 'Saved Address'}
      </Text>
      <Text style={styles.addressFullText} numberOfLines={2}>
        {item?.full_description || item?.address || 'Unknown address'}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
  </TouchableOpacity>
);

export const renderEmptySavedAddresses = ({ openCreateModal, styles }) => (
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
);

export const renderAddressSuggestions = ({
  hasSuggestions,
  suggestions,
  handleSuggestionSelect,
  styles,
}) => {
  if (!hasSuggestions) return null;

  return (
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
  );
};

export const renderAddressSuggestionsLoading = ({
  isLoadingSuggestions,
  styles,
}) => {
  if (!isLoadingSuggestions) return null;
  return (
    <View style={styles.suggestionsLoading}>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
};
