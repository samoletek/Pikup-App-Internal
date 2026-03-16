// Claim Flow Modal component: renders its UI and handles related interactions.
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './ui/AppModal';
import AppInput from './ui/AppInput';
import AppListEmpty from './ui/AppListEmpty';
import {
  colors,
  spacing,
} from '../styles/theme';
import styles from './ClaimFlowModal.styles';
import {
  CLAIM_FLOW_STEPS,
  CLAIM_TYPE_OPTIONS,
} from './claims/claimFlow.constants';
import useClaimFlowStepper from '../hooks/useClaimFlowStepper';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ClaimFlowModal({
  visible,
  onClose,
  pastTrips = [],
  selectedTrip = null,
  onSelectTrip,
  claimType,
  onClaimTypeChange,
  claimDescription,
  onClaimDescriptionChange,
  selectedDocuments = [],
  onAddDocument,
  onRemoveDocument,
  onSubmit,
  submitting = false,
}) {
  const insets = useSafeAreaInsets();
  const {
    continueDisabled,
    currentStep,
    handleBack,
    handleClose,
    handleContinue,
    isTransitioning,
    slideAnim,
    transitionToStep,
  } = useClaimFlowStepper({
    claimDescription,
    onClose,
    onSubmit,
    selectedTrip,
    submitting,
    visible,
  });

  const renderTripItem = ({ item }) => {
    const isSelected = selectedTrip?.id === item.id;
    const handleSelect = () => {
      const result = onSelectTrip?.(item);
      if (result === false) return;
      transitionToStep(2, 'forward');
    };

    return (
      <TouchableOpacity
        style={[styles.tripCard, isSelected && styles.tripCardSelected]}
        onPress={handleSelect}
        disabled={isTransitioning}
      >
        <View style={styles.tripHeader}>
          <Text style={styles.tripDate}>{item.date}</Text>
          <Text style={styles.tripAmount}>${item.amount}</Text>
        </View>

        <View style={styles.tripRow}>
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <Text style={styles.tripRouteText}>
            {item.pickup} {"->"} {item.dropoff}
          </Text>
        </View>

        <View style={styles.tripRow}>
          <Ionicons name="cube-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.tripSecondaryText}>{item.item}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDocuments = () => {
    if (!selectedDocuments.length) return null;

    return (
      <View style={styles.documentsList}>
        {selectedDocuments.map((doc) => (
          <View key={doc.id} style={styles.documentItem}>
            <View style={styles.documentInfo}>
              <Ionicons
                name={doc.type?.startsWith('image/') ? 'image' : 'document'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.documentName} numberOfLines={1}>
                {doc.name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => onRemoveDocument?.(doc.id)}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      height={SCREEN_HEIGHT * 0.9}
      avoidKeyboard
      renderHeader={() => (
        <View style={styles.header}>
          {currentStep > 1 ? (
            <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{CLAIM_FLOW_STEPS[currentStep - 1].title}</Text>
            <Text style={styles.headerStep}>Step {currentStep} of {CLAIM_FLOW_STEPS.length}</Text>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}
    >
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / CLAIM_FLOW_STEPS.length) * 100}%` },
            ]}
          />
        </View>

        <Animated.View
          style={[
            styles.stepContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {currentStep === 1 ? (
            <FlatList
              data={pastTrips}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderTripItem}
              contentContainerStyle={[
                styles.tripsList,
                pastTrips.length === 0 && styles.emptyStateContainer,
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <AppListEmpty
                  iconName="shield-outline"
                  title="No insured deliveries found"
                  subtitle="Only completed deliveries with insurance can be used for claims."
                  style={styles.emptyState}
                />
              }
            />
          ) : (
            <ScrollView
              style={styles.stepScroll}
              contentContainerStyle={styles.stepScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Delivery Details</Text>
                <Text style={styles.summaryDate}>{selectedTrip?.date}</Text>
                <Text style={styles.summaryItem}>{selectedTrip?.item}</Text>
                <View style={styles.tripRow}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.tripRouteText}>
                    {selectedTrip?.pickup} {"->"} {selectedTrip?.dropoff}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Issue Type</Text>
                <View style={styles.claimTypesRow}>
                  {CLAIM_TYPE_OPTIONS.map((option) => {
                    const isSelected = claimType === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.claimTypeChip, isSelected && styles.claimTypeChipSelected]}
                        onPress={() => onClaimTypeChange?.(option.key)}
                      >
                        <Text style={[styles.claimTypeText, isSelected && styles.claimTypeTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Describe the issue *</Text>
                <AppInput
                  multiline
                  value={claimDescription}
                  onChangeText={onClaimDescriptionChange}
                  placeholder="Please provide detailed information about what happened..."
                  inputStyle={styles.descriptionInput}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Supporting Documents</Text>
                {renderDocuments()}
                <TouchableOpacity style={styles.addDocButton} onPress={onAddDocument}>
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={styles.addDocButtonText}>Add Photo or Document</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? spacing.sm : spacing.md }]}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              continueDisabled && styles.continueBtnDisabled,
              currentStep === 2 && !continueDisabled && styles.submitBtn,
            ]}
            onPress={handleContinue}
            disabled={continueDisabled}
          >
            {submitting ? (
              <View style={styles.submittingWrap}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.continueBtnText}>Submitting...</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.continueBtnText, currentStep === 2 && styles.continueBtnTextNoTrailing]}>
                  {currentStep === 1 ? 'Continue' : 'Submit Claim'}
                </Text>
                {currentStep === 1 && <Ionicons name="arrow-forward" size={20} color={colors.white} />}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}
