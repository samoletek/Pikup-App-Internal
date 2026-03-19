// Customer Order Modal component: renders its UI and handles related interactions.
import React from 'react';
import { View, Text, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseModal from '../BaseModal';
import { styles, SCREEN_HEIGHT } from './styles';
import { colors } from '../../styles/theme';
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
const CustomerOrderModal = ({ visible, onClose, onConfirm, userLocation, renderPhoneVerification, customerEmail, customerName }) => {
    const insets = useSafeAreaInsets();
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
        handleContinue,
        cancelCountdown,
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
                </Animated.View>

                {/* Continue / Countdown Button */}
                <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : 12 }]}>
                    {confirmCountdown > 0 ? (
                        <TouchableOpacity
                            style={[styles.continueBtn, { backgroundColor: colors.warning }]}
                            onPress={cancelCountdown}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.white} />
                            <Text style={[styles.continueBtnText, { color: colors.white, marginLeft: 8, marginRight: 0 }]}>
                                Tap to Cancel ({confirmCountdown}s)
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.continueBtn,
                                currentStep === 6 && { backgroundColor: colors.success },
                                isSubmitting && styles.continueBtnDisabled,
                            ]}
                            onPress={handleContinue}
                            disabled={isSubmitting}
                        >
                            <Text style={[styles.continueBtnText, currentStep === 6 && { marginRight: 0 }, isSubmitting && styles.continueBtnTextDisabled]}>
                                {isSubmitting ? 'Processing...' : currentStep === 6 ? 'Confirm & Pay' : 'Continue'}
                            </Text>
                            {currentStep !== 6 && <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {renderPhoneVerification && renderPhoneVerification()}
        </BaseModal>
    );
};

export default CustomerOrderModal;
