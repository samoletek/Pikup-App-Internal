import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { calculatePrice, getVehicleRates, refreshPricingSnapshot } from '../../services/PricingService';
import { recommendVehicleForItems } from '../../services/AIService';
import RedkikService from '../../services/RedkikService';
import {
  createAiVehicleRecommendationDefaults,
} from './constants';
import {
  buildItemsFingerprint,
  buildItemsSummary,
} from './utils/itemRecommendation';
import { resolveFinalPricing } from './utils/finalPricingResolver';
import useConfirmCountdown from './useConfirmCountdown';

const COUNTDOWN_SECONDS = 5;
const QUOTE_MAX_AGE_MS = 10 * 60 * 1000;
const createVehicleFitGateDefaults = () => ({
  requestFingerprint: null,
  requestToken: null,
});

const confirmProceedWithoutInsurance = () => (
  new Promise((resolve) => {
    let resolved = false;
    const settle = (value) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
    };

    Alert.alert(
      'Insurance Unavailable',
      'Due to a technical issue, we could not apply insurance to this trip. Do you want to create the trip without insurance?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => settle(false),
        },
        {
          text: 'Create Without Insurance',
          style: 'destructive',
          onPress: () => settle(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => settle(false),
      }
    );
  })
);

function getInsuredItems(items = []) {
  return (items || []).filter(
    (item) => String(item.condition || '').toLowerCase() === 'new' && item.hasInsurance === true
  );
}

export default function useOrderCheckoutFlow({
  currentStep,
  orderData,
  setOrderData,
  paymentMethods,
  customerEmail,
  customerName,
  goToStep,
  onConfirm,
  validateStep,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewPricing, setPreviewPricing] = useState(null);
  const [insuranceQuote, setInsuranceQuote] = useState(null);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [insuranceError, setInsuranceError] = useState(false);
  const [laborAdjustment, setLaborAdjustment] = useState(null);
  const [vehicleFitGate, setVehicleFitGate] = useState(createVehicleFitGateDefaults);

  const {
    confirmCountdown,
    startCountdown,
    cancelCountdown,
    skipCountdown,
    resetCountdown,
  } = useConfirmCountdown();
  const quoteRequestIdRef = useRef(0);
  const aiRecommendation = orderData.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
  const selectedVehicleId = orderData.selectedVehicle?.id || null;
  const selectedVehicleFitsExactly = Boolean(
    selectedVehicleId &&
    aiRecommendation.status === 'success' &&
    aiRecommendation.fitByVehicle?.[selectedVehicleId]?.fits === true
  );
  const gateMatchesCurrentAi = Boolean(
    vehicleFitGate.requestToken &&
    aiRecommendation.requestToken &&
    vehicleFitGate.requestToken === aiRecommendation.requestToken
  );
  const shouldShowVehicleFitOverlay = Boolean(
    currentStep === 5 &&
    vehicleFitGate.requestToken &&
    gateMatchesCurrentAi &&
    (
      aiRecommendation.status === 'loading' ||
      (aiRecommendation.status === 'success' && !selectedVehicleFitsExactly)
    )
  );
  const clearInsuranceQuote = useCallback(() => {
    quoteRequestIdRef.current += 1;
    setInsuranceQuote(null);
    setInsuranceLoading(false);
    setInsuranceError(false);
  }, []);
  const isQuoteStale = useCallback((quote) => (
    Boolean(quote?.fetchedAt && Date.now() - quote.fetchedAt > QUOTE_MAX_AGE_MS)
  ), []);

  useEffect(() => {
    if (!vehicleFitGate.requestToken || !gateMatchesCurrentAi) {
      return;
    }

    if (aiRecommendation.status === 'error') {
      setVehicleFitGate(createVehicleFitGateDefaults());
      return;
    }

    if (aiRecommendation.status === 'success' && selectedVehicleFitsExactly) {
      setVehicleFitGate(createVehicleFitGateDefaults());
    }
  }, [
    aiRecommendation.status,
    gateMatchesCurrentAi,
    selectedVehicleFitsExactly,
    vehicleFitGate.requestToken,
  ]);

  useEffect(() => {
    if (!previewPricing || !insuranceQuote?.premium || !previewPricing.insuranceApplied) {
      return;
    }

    const redkikPremium = insuranceQuote.premium;
    const oldInsurance = previewPricing.mandatoryInsurance || 0;
    if (Math.abs(redkikPremium - oldInsurance) < 0.01) {
      return;
    }

    setPreviewPricing((prevPricing) => {
      return refreshPricingSnapshot({
        ...prevPricing,
        mandatoryInsurance: redkikPremium,
      });
    });
  }, [insuranceQuote, previewPricing]);

  const calculatePricing = useCallback(async () => {
    const vehicle = orderData.selectedVehicle;
    if (!vehicle) {
      return null;
    }

    const distance = orderData.distance || 10;
    const duration = orderData.duration || 0;

    return calculatePrice(vehicle, distance, duration, {
      pickup: orderData.pickup || null,
      dropoff: orderData.dropoff || null,
      items: orderData.items || [],
      laborOptions: {
        items: orderData.items || [],
        pickupDetails: orderData.pickupDetails || {},
        dropoffDetails: orderData.dropoffDetails || {},
      },
    });
  }, [orderData]);

  const fetchInsuranceQuote = useCallback(async (insuredItems, options = {}) => {
    const { resetQuote = true } = options;
    const requestId = ++quoteRequestIdRef.current;
    setInsuranceLoading(true);
    setInsuranceError(false);
    if (resetQuote) {
      setInsuranceQuote(null);
    }

    try {
      const quote = await RedkikService.getQuote({
        items: insuredItems,
        pickup: orderData.pickup,
        dropoff: orderData.dropoff,
        scheduledTime: orderData.scheduleType === 'scheduled' ? orderData.scheduledDateTime : null,
        durationMinutes: orderData.duration || null,
        customerEmail,
        customerName,
      });

      if (quoteRequestIdRef.current !== requestId) {
        return null;
      }

      const nextQuote = quote ? { ...quote, fetchedAt: Date.now() } : null;
      setInsuranceQuote(nextQuote);
      setInsuranceLoading(false);
      if (!quote) {
        setInsuranceError(true);
      }
      return nextQuote;
    } catch (_error) {
      if (quoteRequestIdRef.current !== requestId) {
        return null;
      }

      if (resetQuote) {
        setInsuranceQuote(null);
      }
      setInsuranceLoading(false);
      setInsuranceError(true);
      return null;
    }
  }, [customerEmail, customerName, orderData]);

  const triggerVehicleRecommendation = useCallback(async (itemsSnapshot) => {
    const validItems = (itemsSnapshot || []).filter((item) => item?.name?.trim());
    if (validItems.length === 0) {
      setVehicleFitGate(createVehicleFitGateDefaults());
      return;
    }

    const requestFingerprint = buildItemsFingerprint(validItems);
    const requestToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const summary = buildItemsSummary(validItems);
    setVehicleFitGate({
      requestFingerprint,
      requestToken,
    });

    setOrderData((prevOrderData) => {
      const currentAi = prevOrderData.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();

      return {
        ...prevOrderData,
        selectedVehicle: null,
        aiVehicleRecommendation: {
          ...currentAi,
          status: 'loading',
          requestFingerprint,
          requestToken,
          requestedAt: new Date().toISOString(),
          completedAt: null,
          summary,
          loadingEstimate: '',
          unloadingEstimate: '',
          step6Description: '',
          notes: '',
          error: null,
        },
      };
    });

    try {
      const vehicles = await getVehicleRates();
      const recommendation = await recommendVehicleForItems({
        itemSummary: summary,
        items: validItems,
        vehicles,
      });

      setOrderData((prevOrderData) => {
        const currentAi = prevOrderData.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
        if (
          currentAi.requestFingerprint !== requestFingerprint ||
          currentAi.requestToken !== requestToken
        ) {
          return prevOrderData;
        }

        const selectedVehicleId = prevOrderData.selectedVehicle?.id;
        const selectedIsTooSmall = selectedVehicleId
          ? recommendation?.fitByVehicle?.[selectedVehicleId]?.fits === false
          : false;

        return {
          ...prevOrderData,
          selectedVehicle: selectedIsTooSmall ? null : prevOrderData.selectedVehicle,
          aiVehicleRecommendation: {
            ...currentAi,
            status: 'success',
            completedAt: new Date().toISOString(),
            recommendedVehicleId: recommendation.recommendedVehicleId || null,
            fitByVehicle: recommendation.fitByVehicle || {},
            loadingEstimate: recommendation.loadingEstimate || '',
            unloadingEstimate: recommendation.unloadingEstimate || '',
            step6Description: recommendation.step6Description || '',
            notes: recommendation.notes || recommendation.step6Description || '',
            error: null,
          },
        };
      });
    } catch (error) {
      setOrderData((prevOrderData) => {
        const currentAi = prevOrderData.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
        if (
          currentAi.requestFingerprint !== requestFingerprint ||
          currentAi.requestToken !== requestToken
        ) {
          return prevOrderData;
        }

        return {
          ...prevOrderData,
          aiVehicleRecommendation: {
            ...currentAi,
            status: 'error',
            completedAt: new Date().toISOString(),
            error: error?.message || 'Vehicle recommendation failed',
          },
        };
      });
    }
  }, [setOrderData]);

  const handleContinue = useCallback(async () => {
    Keyboard.dismiss();

    if (isSubmitting || confirmCountdown > 0) {
      return;
    }
    if (currentStep === 5 && shouldShowVehicleFitOverlay) {
      return;
    }
    const isStepValid = await Promise.resolve(validateStep());
    if (!isStepValid) {
      return;
    }

    const insuredItems = getInsuredItems(orderData.items);
    const hasInsuredItems = insuredItems.length > 0;

    if (currentStep === 2) {
      const itemsSnapshot = [...orderData.items];
      triggerVehicleRecommendation(itemsSnapshot);
      if (hasInsuredItems) {
        void fetchInsuranceQuote(insuredItems, { resetQuote: !insuranceQuote?.offerId });
      } else {
        clearInsuranceQuote();
      }
      goToStep(currentStep + 1, 'forward');
      return;
    }

    if (currentStep < 6) {
      if (hasInsuredItems && currentStep >= 3 && currentStep <= 4 && (!insuranceQuote?.offerId || insuranceError)) {
        void fetchInsuranceQuote(insuredItems, { resetQuote: !insuranceQuote?.offerId });
      }

      if (currentStep === 5) {
        calculatePricing().then((pricing) => setPreviewPricing(pricing));

        if (hasInsuredItems) {
          const quoteMissing = !insuranceQuote?.offerId;
          const quoteExpired = isQuoteStale(insuranceQuote);
          if (quoteMissing || quoteExpired || insuranceError) {
            await fetchInsuranceQuote(insuredItems, { resetQuote: quoteMissing });
          }
        } else {
          clearInsuranceQuote();
        }
      }

      goToStep(currentStep + 1, 'forward');
      return;
    }

    let effectiveInsuranceQuote = insuranceQuote;
    let proceedWithoutInsurance = false;

    if (hasInsuredItems && (!insuranceQuote?.offerId || insuranceError)) {
      const recoveredQuote = await fetchInsuranceQuote(insuredItems, {
        resetQuote: !insuranceQuote?.offerId,
      });
      if (!recoveredQuote?.offerId) {
        const allowUninsuredTrip = await confirmProceedWithoutInsurance();
        if (!allowUninsuredTrip) {
          return;
        }
        proceedWithoutInsurance = true;
        effectiveInsuranceQuote = null;
      } else {
        effectiveInsuranceQuote = recoveredQuote;
      }
    }

    const selectedPaymentMethod =
      paymentMethods?.find((method) => method.id === orderData.selectedPaymentMethodId) || null;

    const { pricing: finalPricing, insuranceQuote: activeInsuranceQuote } = await resolveFinalPricing({
      calculatePricing,
      customerEmail,
      customerName,
      insuranceQuote: effectiveInsuranceQuote,
      laborAdjustment,
      orderData,
      previewPricing,
      setInsuranceQuote,
      getInsuredItems,
    });

    const effectiveFinalPricing = proceedWithoutInsurance && finalPricing
      ? refreshPricingSnapshot({
        ...finalPricing,
        mandatoryInsurance: 0,
        insuranceApplied: false,
      })
      : finalPricing;

    const finalOrder = {
      ...orderData,
      pricing: effectiveFinalPricing,
      selectedPaymentMethod,
      insuranceQuote: proceedWithoutInsurance ? null : activeInsuranceQuote,
      insuranceQuoteFallbackOptIn: proceedWithoutInsurance,
    };

    if (hasInsuredItems && !proceedWithoutInsurance && !finalOrder.insuranceQuote?.offerId) {
      Alert.alert(
        'Insurance Quote Required',
        'Insurance is selected for at least one item. Please wait until the quote is ready.'
      );
      return;
    }

    const wasCancelled = await startCountdown(COUNTDOWN_SECONDS);

    if (wasCancelled) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await onConfirm(finalOrder);

      if (result?.success === false) {
        Alert.alert('Payment Issue', result.error || 'Unable to complete payment. Please try again.');
      }
    } catch (error) {
      Alert.alert('Payment Issue', error?.message || 'Unable to complete payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    calculatePricing,
    confirmCountdown,
    currentStep,
    fetchInsuranceQuote,
    goToStep,
    isSubmitting,
    isQuoteStale,
    onConfirm,
    orderData,
    paymentMethods,
    clearInsuranceQuote,
    insuranceQuote,
    laborAdjustment,
    customerEmail,
    customerName,
    previewPricing,
    setInsuranceQuote,
    shouldShowVehicleFitOverlay,
    startCountdown,
    triggerVehicleRecommendation,
    validateStep,
  ]);

  const resetCheckoutState = useCallback(() => {
    clearInsuranceQuote();
    resetCountdown();
    setIsSubmitting(false);
    setPreviewPricing(null);
    setLaborAdjustment(null);
    setVehicleFitGate(createVehicleFitGateDefaults());
  }, [clearInsuranceQuote, resetCountdown]);

  return {
    isSubmitting,
    confirmCountdown,
    previewPricing,
    insuranceQuote,
    insuranceLoading,
    insuranceError,
    laborAdjustment,
    setLaborAdjustment,
    shouldShowVehicleFitOverlay,
    handleContinue,
    cancelCountdown,
    skipCountdown,
    resetCheckoutState,
  };
}
