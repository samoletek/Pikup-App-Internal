// Order Step Content component: renders its UI and handles related interactions.
import React from 'react';
import LocationDetailsStep from '../order/LocationDetailsStep';
import AddressSearchStep from './steps/AddressSearchStep';
import ItemsStep from './steps/ItemsStep';
import VehicleStep from './steps/VehicleStep';
import ReviewStep from './steps/ReviewStep';

export default function OrderStepContent({
    currentStep,
    orderData,
    setOrderData,
    userLocation,
    recentAddresses,
    saveToRecentAddresses,
    expandedItemId,
    setExpandedItemId,
    itemErrors,
    setItemErrors,
    pendingItemAttentionCount,
    paymentMethods,
    defaultPaymentMethod,
    previewPricing,
    insuranceQuote,
    insuranceLoading,
    insuranceError,
    setLaborAdjustment,
    setCurrentStep,
}) {
    if (currentStep === 1) {
        return (
            <AddressSearchStep
                orderData={orderData}
                setOrderData={setOrderData}
                userLocation={userLocation}
                recentAddresses={recentAddresses}
                saveToRecentAddresses={saveToRecentAddresses}
            />
        );
    }

    if (currentStep === 2) {
        return (
            <ItemsStep
                orderData={orderData}
                setOrderData={setOrderData}
                expandedItemId={expandedItemId}
                setExpandedItemId={setExpandedItemId}
                itemErrors={itemErrors}
                setItemErrors={setItemErrors}
                pendingAttentionCount={pendingItemAttentionCount}
            />
        );
    }

    if (currentStep === 3) {
        return (
            <LocationDetailsStep
                address={orderData.pickup.address}
                type="pickup"
                details={orderData.pickupDetails}
                onUpdate={(details) =>
                    setOrderData((prev) => {
                        const normalizedHelpPreference =
                            typeof details.driverHelpsLoading === 'boolean'
                                ? details.driverHelpsLoading
                                : typeof details.driverHelp === 'boolean'
                                    ? details.driverHelp
                                    : prev.pickupDetails?.driverHelpsLoading ?? false;

                        return {
                            ...prev,
                            pickupDetails: {
                                ...details,
                                driverHelpsLoading: normalizedHelpPreference,
                            },
                            dropoffDetails: {
                                ...prev.dropoffDetails,
                                driverHelpsUnloading: normalizedHelpPreference,
                            },
                        };
                    })
                }
            />
        );
    }

    if (currentStep === 4) {
        return (
            <LocationDetailsStep
                address={orderData.dropoff.address}
                type="dropoff"
                details={orderData.dropoffDetails}
                onUpdate={(details) => setOrderData((prev) => ({ ...prev, dropoffDetails: details }))}
            />
        );
    }

    if (currentStep === 5) {
        return (
            <VehicleStep
                orderData={orderData}
                setOrderData={setOrderData}
            />
        );
    }

    if (currentStep === 6) {
        const selectedPaymentMethod =
            paymentMethods?.find((method) => method.id === orderData.selectedPaymentMethodId) || null;

        return (
            <ReviewStep
                orderData={orderData}
                pricing={previewPricing}
                insuranceQuote={insuranceQuote}
                insuranceLoading={insuranceLoading}
                insuranceError={insuranceError}
                onLaborAdjustmentChange={setLaborAdjustment}
                onNavigateToStep={setCurrentStep}
                paymentMethods={paymentMethods || []}
                selectedPaymentMethod={selectedPaymentMethod}
                defaultPaymentMethodId={defaultPaymentMethod?.id || null}
                onSelectPaymentMethod={(method) =>
                    setOrderData((prev) => ({ ...prev, selectedPaymentMethodId: method?.id || null }))
                }
            />
        );
    }

    return null;
}
