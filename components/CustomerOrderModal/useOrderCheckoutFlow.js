import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { calculatePrice, getVehicleRates } from '../../services/PricingService';
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

  const {
    confirmCountdown,
    startCountdown,
    cancelCountdown,
    skipCountdown,
    resetCountdown,
  } = useConfirmCountdown();
  const quoteRequestIdRef = useRef(0);

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
      const previousInsurance = prevPricing.mandatoryInsurance || 0;
      return {
        ...prevPricing,
        mandatoryInsurance: redkikPremium,
        total: Math.round((prevPricing.total - previousInsurance + redkikPremium) * 100) / 100,
      };
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

  const fetchInsuranceQuote = useCallback(async (insuredItems) => {
    const requestId = ++quoteRequestIdRef.current;
    setInsuranceLoading(true);
    setInsuranceError(false);
    setInsuranceQuote(null);

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
        return;
      }

      setInsuranceQuote(quote ? { ...quote, fetchedAt: Date.now() } : null);
      setInsuranceLoading(false);
      if (!quote) {
        setInsuranceError(true);
      }
    } catch (_error) {
      if (quoteRequestIdRef.current !== requestId) {
        return;
      }

      setInsuranceQuote(null);
      setInsuranceLoading(false);
      setInsuranceError(true);
    }
  }, [customerEmail, customerName, orderData]);

  const triggerVehicleRecommendation = useCallback(async (itemsSnapshot) => {
    const validItems = (itemsSnapshot || []).filter((item) => item?.name?.trim());
    if (validItems.length === 0) {
      return;
    }

    const requestFingerprint = buildItemsFingerprint(validItems);
    const summary = buildItemsSummary(validItems);

    setOrderData((prevOrderData) => {
      const currentAi = prevOrderData.aiVehicleRecommendation || createAiVehicleRecommendationDefaults();
      if (
        currentAi.requestFingerprint === requestFingerprint &&
        (currentAi.status === 'loading' || currentAi.status === 'success')
      ) {
        return prevOrderData;
      }

      return {
        ...prevOrderData,
        aiVehicleRecommendation: {
          ...currentAi,
          status: 'loading',
          requestFingerprint,
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
        if (currentAi.requestFingerprint !== requestFingerprint) {
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
        if (currentAi.requestFingerprint !== requestFingerprint) {
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
    const isStepValid = await Promise.resolve(validateStep());
    if (!isStepValid) {
      return;
    }

    if (currentStep === 2) {
      const itemsSnapshot = [...orderData.items];
      triggerVehicleRecommendation(itemsSnapshot);
      goToStep(currentStep + 1, 'forward');
      return;
    }

    if (currentStep < 6) {
      if (currentStep === 5) {
        calculatePricing().then((pricing) => setPreviewPricing(pricing));

        const insuredItems = getInsuredItems(orderData.items);
        if (insuredItems.length > 0) {
          await fetchInsuranceQuote(insuredItems);
        } else {
          quoteRequestIdRef.current += 1;
          setInsuranceQuote(null);
          setInsuranceLoading(false);
          setInsuranceError(false);
        }
      }

      goToStep(currentStep + 1, 'forward');
      return;
    }

    const selectedPaymentMethod =
      paymentMethods?.find((method) => method.id === orderData.selectedPaymentMethodId) || null;

    const { pricing: finalPricing, insuranceQuote: activeInsuranceQuote } = await resolveFinalPricing({
      calculatePricing,
      customerEmail,
      customerName,
      insuranceQuote,
      laborAdjustment,
      orderData,
      previewPricing,
      setInsuranceQuote,
      getInsuredItems,
    });

    const finalOrder = {
      ...orderData,
      pricing: finalPricing,
      selectedPaymentMethod,
      insuranceQuote: activeInsuranceQuote,
    };

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
    onConfirm,
    orderData,
    paymentMethods,
    insuranceQuote,
    laborAdjustment,
    customerEmail,
    customerName,
    previewPricing,
    setInsuranceQuote,
    startCountdown,
    triggerVehicleRecommendation,
    validateStep,
  ]);

  const resetCheckoutState = useCallback(() => {
    quoteRequestIdRef.current += 1;
    resetCountdown();
    setIsSubmitting(false);
    setPreviewPricing(null);
    setInsuranceQuote(null);
    setInsuranceLoading(false);
    setInsuranceError(false);
    setLaborAdjustment(null);
  }, [resetCountdown]);

  return {
    isSubmitting,
    confirmCountdown,
    previewPricing,
    insuranceQuote,
    insuranceLoading,
    insuranceError,
    laborAdjustment,
    setLaborAdjustment,
    handleContinue,
    cancelCountdown,
    skipCountdown,
    resetCheckoutState,
  };
}
