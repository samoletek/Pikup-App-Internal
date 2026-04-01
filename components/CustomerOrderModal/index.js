// Customer Order Modal component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseModal from '../BaseModal';
import { styles, SCREEN_HEIGHT } from './styles';
import { colors, spacing, typography } from '../../styles/theme';
import { usePayment } from '../../contexts/PaymentContext';
import {
    STEPS,
} from './constants';
import OrderStepContent from './OrderStepContent';
import useOrderCheckoutFlow from './useOrderCheckoutFlow';
import useCustomerOrderModalState from './useCustomerOrderModalState';

// ============================================
// MAIN COMPONENT
// ============================================
const CustomerOrderModal = ({ visible, onClose, onConfirm, userLocation, customerEmail, customerName }) => {
    const insets = useSafeAreaInsets();
    const headerIconSize = typography.fontSize.xxl;
    const actionIconSize = typography.fontSize.xl;
    const { paymentMethods, defaultPaymentMethod } = usePayment();
    const {
        currentStep,
        setCurrentStep,
        slideAnim,
        orderData,
        setOrderData,
        recentAddresses,
        saveToRecentAddresses,
        expandedItemId,
        setExpandedItemId,
        itemErrors,
        setItemErrors,
        pendingItemAttentionCount,
        goToStep,
        handleBack,
        hasOrderChanges,
        validateStep,
        resetLocalState,
    } = useCustomerOrderModalState({
        visible,
        paymentMethods,
        defaultPaymentMethod,
        userLocation,
    });
    const {
        isSubmitting,
        confirmCountdown,
        previewPricing,
        insuranceQuote,
        insuranceLoading,
        insuranceError,
        setLaborAdjustment,
        shouldShowVehicleFitOverlay,
        handleContinue,
        cancelCountdown,
        skipCountdown,
        resetCheckoutState,
    } = useOrderCheckoutFlow({
        currentStep,
        orderData,
        setOrderData,
        paymentMethods,
        customerEmail,
        customerName,
        goToStep,
        onConfirm,
        validateStep,
    });

    const resetState = () => {
        resetLocalState();
        resetCheckoutState();
    };

    const closeAndReset = () => {
        resetState();
        onClose();
    };

    const handleClose = () => {
        if (!hasOrderChanges()) {
            closeAndReset();
            return;
        }
        Alert.alert('Cancel Order?', 'Your progress will be lost.', [
            { text: 'Keep Editing', style: 'cancel' },
            {
                text: 'Cancel Order',
                style: 'destructive',
                onPress: () => {
                    closeAndReset();
                },
            },
        ]);
    };

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <BaseModal
            visible={visible}
            onClose={closeAndReset}
            onBackdropPress={handleClose}
            height={SCREEN_HEIGHT * 0.9}
            backgroundColor={colors.background.secondary}
            avoidKeyboard={false}
            renderHeader={(animateClose) => (
                <View style={styles.header}>
                    {currentStep > 1 ? (
                        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                            <Ionicons name="arrow-back" size={headerIconSize} color={colors.text.primary} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerBtn} />
                    )}

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{STEPS[currentStep - 1].title}</Text>
                        <Text style={styles.headerStep}>Step {currentStep} of {STEPS.length}</Text>
                    </View>

                    <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
                        <Ionicons name="close" size={headerIconSize} color={colors.text.primary} />
                    </TouchableOpacity>
                </View>
            )}
        >
            <View style={styles.container}>
                {/* Progress Bar */}
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(currentStep / STEPS.length) * 100}%` }]} />
                </View>

                {/* Step Content with Animation */}
                <Animated.View style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
                    <OrderStepContent
                        currentStep={currentStep}
                        orderData={orderData}
                        setOrderData={setOrderData}
                        userLocation={userLocation}
                        recentAddresses={recentAddresses}
                        saveToRecentAddresses={saveToRecentAddresses}
                        expandedItemId={expandedItemId}
                        setExpandedItemId={setExpandedItemId}
                        itemErrors={itemErrors}
                        setItemErrors={setItemErrors}
                        pendingItemAttentionCount={pendingItemAttentionCount}
                        paymentMethods={paymentMethods}
                        defaultPaymentMethod={defaultPaymentMethod}
                        previewPricing={previewPricing}
                        insuranceQuote={insuranceQuote}
                        insuranceLoading={insuranceLoading}
                        insuranceError={insuranceError}
                        setLaborAdjustment={setLaborAdjustment}
                        setCurrentStep={setCurrentStep}
                    />

                    {shouldShowVehicleFitOverlay && (
                        <View style={styles.vehicleFitOverlay} pointerEvents="box-only">
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={styles.vehicleFitOverlayTitle}>Finding your exact vehicle fit...</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Continue / Countdown Button */}
                <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : spacing.md }]}>
                    {confirmCountdown > 0 ? (
                        <View style={styles.countdownActionRow}>
                            <TouchableOpacity
                                style={[styles.continueBtn, styles.countdownPrimaryBtn]}
                                onPress={cancelCountdown}
                            >
                                <Ionicons name="close-circle" size={actionIconSize} color={colors.white} />
                                <Text style={[styles.continueBtnText, styles.countdownPrimaryText]}>
                                    Cancel ({confirmCountdown}s)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.skipCountdownBtn}
                                onPress={skipCountdown}
                            >
                                <Text style={styles.skipCountdownText}>Skip</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.continueBtn,
                                currentStep === 6 && styles.continueBtnSuccess,
                                isSubmitting && styles.continueBtnDisabled,
                            ]}
                            onPress={handleContinue}
                            disabled={isSubmitting}
                        >
                            <Text
                                style={[
                                    styles.continueBtnText,
                                    currentStep === 6 && styles.continueBtnTextNoIcon,
                                    isSubmitting && styles.continueBtnTextDisabled,
                                ]}
                            >
                                {isSubmitting ? 'Processing...' : currentStep === 6 ? 'Confirm & Pay' : 'Continue'}
                            </Text>
                            {currentStep !== 6 && <Ionicons name="arrow-forward" size={actionIconSize} color={colors.text.primary} />}
                        </TouchableOpacity>
                    )}
                </View>

            </View>

        </BaseModal>
    );
};

export default CustomerOrderModal;
