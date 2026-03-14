import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseModal from './BaseModal';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../styles/theme';

const STEPS = [
  { id: 1, title: 'Select Insured Delivery' },
  { id: 2, title: 'File Insurance Claim' },
];

const CLAIM_TYPE_OPTIONS = [
  { key: 'DAMAGED_GOODS', label: 'Damaged' },
  { key: 'LOST_GOODS', label: 'Lost/Missing' },
  { key: 'OTHER', label: 'Other' },
];
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const [currentStep, setCurrentStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setCurrentStep(1);
      setIsTransitioning(false);
      slideAnim.setValue(0);
      wasVisibleRef.current = false;
      return;
    }

    if (!wasVisibleRef.current) {
      setCurrentStep(selectedTrip ? 2 : 1);
      wasVisibleRef.current = true;
    }
  }, [visible, selectedTrip, slideAnim]);

  const continueDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !selectedTrip || isTransitioning;
    }
    return !claimDescription?.trim() || submitting || isTransitioning;
  }, [currentStep, selectedTrip, claimDescription, submitting, isTransitioning]);

  const handleClose = () => {
    setCurrentStep(1);
    setIsTransitioning(false);
    slideAnim.setValue(0);
    onClose?.();
  };

  const transitionToStep = useCallback((nextStep, direction = 'forward') => {
    if (nextStep === currentStep || isTransitioning) return;

    const toValue = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;

    setIsTransitioning(true);

    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      slideAnim.setValue(-toValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  }, [currentStep, isTransitioning, slideAnim]);

  const handleBack = () => {
    if (currentStep > 1) {
      transitionToStep(currentStep - 1, 'backward');
      return;
    }
    handleClose();
  };

  const handleContinue = () => {
    if (currentStep === 1) {
      if (!selectedTrip) return;
      transitionToStep(2, 'forward');
      return;
    }

    onSubmit?.();
  };

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
    <BaseModal
      visible={visible}
      onClose={handleClose}
      onBackdropPress={handleClose}
      height={SCREEN_HEIGHT * 0.9}
      backgroundColor={colors.background.secondary}
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
            <Text style={styles.headerTitle}>{STEPS[currentStep - 1].title}</Text>
            <Text style={styles.headerStep}>Step {currentStep} of {STEPS.length}</Text>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      )}
    >
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentStep / STEPS.length) * 100}%` }]} />
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
              ListEmptyComponent={(
                <View style={styles.emptyState}>
                  <Ionicons name="shield-outline" size={44} color={colors.text.subtle} />
                  <Text style={styles.emptyStateTitle}>No insured deliveries found</Text>
                  <Text style={styles.emptyStateText}>
                    Only completed deliveries with insurance can be used for claims.
                  </Text>
                </View>
              )}
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
                <TextInput
                  style={styles.descriptionInput}
                  multiline
                  numberOfLines={5}
                  value={claimDescription}
                  onChangeText={onClaimDescriptionChange}
                  placeholder="Please provide detailed information about what happened..."
                  placeholderTextColor={colors.text.tertiary}
                  textAlignVertical="top"
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
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    height: 56,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerStep: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xs,
  },
  stepContainer: { flex: 1 },
  tripsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    gap: spacing.sm,
  },
  tripCard: {
    backgroundColor: colors.background.panel,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  tripCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.background.brandTint,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tripDate: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
  tripAmount: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  tripRouteText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  tripSecondaryText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateTitle: {
    marginTop: spacing.base,
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  emptyStateText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: typography.fontSize.base,
    lineHeight: 20,
  },
  stepScroll: { flex: 1 },
  stepScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  summaryCard: {
    backgroundColor: colors.background.panel,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },
  summaryDate: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  summaryItem: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  claimTypesRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
  },
  claimTypeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.transparent,
    marginHorizontal: spacing.xs / 2,
  },
  claimTypeChipSelected: {
    backgroundColor: colors.primary,
  },
  claimTypeText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  claimTypeTextSelected: {
    color: colors.white,
  },
  descriptionInput: {
    backgroundColor: colors.background.input,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    color: colors.text.primary,
    fontSize: typography.fontSize.base,
    minHeight: 120,
    padding: spacing.base,
  },
  documentsList: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.panel,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  documentName: {
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
    flex: 1,
  },
  addDocButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.input,
    height: 56,
  },
  addDocButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.background.input,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: colors.text.subtle,
    opacity: 0.65,
  },
  submitBtn: {
    backgroundColor: colors.success,
  },
  continueBtnText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  continueBtnTextNoTrailing: {
    marginRight: 0,
  },
  submittingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
