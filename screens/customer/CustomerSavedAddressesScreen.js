import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../../components/ScreenHeader";
import AppButton from "../../components/ui/AppButton";
import AppInput from "../../components/ui/AppInput";
import { colors, spacing } from "../../styles/theme";
import styles from "./CustomerSavedAddressesScreen.styles";
import useSavedAddressesManager from "./useSavedAddressesManager";

export default function CustomerSavedAddressesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    closeEditModal,
    editingAddressText,
    emptyState,
    handleAddressTextChange,
    handleDeleteAddress,
    handleSaveEditedAddress,
    isCreatingAddress,
    isEditModalVisible,
    isLoading,
    openCreateModal,
    renderAddressRow,
    renderSuggestions,
    renderSuggestionsLoading,
    savedAddresses,
  } = useSavedAddressesManager();

  const handleCloseModal = () => {
    Keyboard.dismiss();
    closeEditModal();
  };

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
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseModal}>
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
                  <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={22} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons name="heart" size={18} color={colors.error} style={styles.inputIcon} />
                  <AppInput
                    containerStyle={styles.inputFieldContainer}
                    inputStyle={styles.input}
                    placeholder="Start typing an address..."
                    value={editingAddressText}
                    onChangeText={handleAddressTextChange}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                {renderSuggestionsLoading()}
                {renderSuggestions()}

                <View style={styles.modalActions}>
                  {!isCreatingAddress ? (
                    <AppButton
                      title="Delete"
                      variant="danger"
                      style={styles.deleteBtn}
                      onPress={handleDeleteAddress}
                    />
                  ) : null}
                  <AppButton
                    title={isCreatingAddress ? "Add" : "Save"}
                    style={[styles.saveBtn, isCreatingAddress && styles.saveBtnFull]}
                    onPress={handleSaveEditedAddress}
                  />
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
