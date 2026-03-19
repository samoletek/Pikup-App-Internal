import { useMemo, useState, useCallback } from 'react';
import { estimateLaborMinutes } from '../../../../services/PricingService';

export const useReviewStepPricing = ({
  orderData,
  pricing,
  onLaborAdjustmentChange,
}) => {
  const isSelfHandling = orderData.pickupDetails?.driverHelpsLoading !== true
    && orderData.dropoffDetails?.driverHelpsUnloading !== true;

  const [laborAdjustment, setLaborAdjustment] = useState(null);

  const laborSliderConfig = useMemo(() => {
    if (!pricing || isSelfHandling) {
      return null;
    }

    const estimateMinutes = pricing.laborMinutes || 0;
    if (estimateMinutes === 0) {
      return null;
    }

    const bufferMinutes = pricing.laborBufferMinutes || 0;

    return {
      min: estimateMinutes,
      max: estimateMinutes * 2,
      step: 5,
      estimateMinutes,
      bufferMinutes,
    };
  }, [pricing, isSelfHandling]);

  const currentLaborMinutes = laborSliderConfig
    ? (laborAdjustment ?? laborSliderConfig.estimateMinutes)
    : (pricing?.laborMinutes || 0);

  const adjustedPricing = useMemo(() => {
    if (!pricing || !laborSliderConfig || laborAdjustment === null) {
      return pricing;
    }

    const bufferMinutes = laborSliderConfig.bufferMinutes;
    const billable = Math.max(0, laborAdjustment - bufferMinutes);
    const newLaborFee = Math.round(billable * (pricing.laborPerMin || 0) * 100) / 100;
    const laborDiff = newLaborFee - (pricing.laborFee || 0);
    const taxRate = Number(pricing.taxRate || 0);
    const newTaxableLaborAmount = newLaborFee;
    const newTax = Math.round(newTaxableLaborAmount * taxRate * 100) / 100;
    const taxDiff = newTax - (pricing.tax || 0);

    return {
      ...pricing,
      laborFee: newLaborFee,
      laborMinutes: laborAdjustment,
      laborBillableMinutes: billable,
      taxableLaborAmount: newTaxableLaborAmount,
      tax: newTax,
      total: Math.round((pricing.total + laborDiff + taxDiff) * 100) / 100,
    };
  }, [pricing, laborSliderConfig, laborAdjustment]);

  const handleLaborStep = useCallback((direction) => {
    if (!laborSliderConfig) {
      return;
    }

    const { min, max, step } = laborSliderConfig;
    const current = laborAdjustment ?? laborSliderConfig.estimateMinutes;
    const next = direction === 'up'
      ? Math.min(max, current + step)
      : Math.max(min, current - step);

    setLaborAdjustment(next);
    onLaborAdjustmentChange?.(next);
  }, [laborSliderConfig, laborAdjustment, onLaborAdjustmentChange]);

  const handlingEstimate = useMemo(() => {
    const aiVehicleRecommendation = orderData.aiVehicleRecommendation || {};

    const labor = pricing
      ? {
        pickupMinutes: Number(pricing.laborPickupMinutes) || 0,
        dropoffMinutes: Number(pricing.laborDropoffMinutes) || 0,
        bufferMinutes: Number(pricing.laborBufferMinutes) || 0,
      }
      : estimateLaborMinutes({
        items: orderData.items || [],
        pickupDetails: orderData.pickupDetails || {},
        dropoffDetails: orderData.dropoffDetails || {},
      });

    const formatLegMinutes = (minutes) => (minutes > 0 ? `${minutes} min` : 'Not requested');
    const totalHandlingMinutes = (labor.pickupMinutes || 0) + (labor.dropoffMinutes || 0);

    if (totalHandlingMinutes === 0) {
      return {
        loading: 'Not requested',
        unloading: 'Not requested',
        hint: 'No loading/unloading assistance selected.',
      };
    }

    const baseHint = labor.bufferMinutes > 0
      ? `Based on labor settings. Includes ${labor.bufferMinutes} min free buffer.`
      : 'Based on labor settings in your request.';

    return {
      loading: formatLegMinutes(labor.pickupMinutes),
      unloading: formatLegMinutes(labor.dropoffMinutes),
      hint: aiVehicleRecommendation.step6Description || aiVehicleRecommendation.notes || baseHint,
    };
  }, [
    pricing,
    orderData.items,
    orderData.pickupDetails,
    orderData.dropoffDetails,
    orderData.aiVehicleRecommendation,
  ]);

  return {
    isSelfHandling,
    laborAdjustment,
    laborSliderConfig,
    currentLaborMinutes,
    displayPricing: adjustedPricing || pricing,
    handlingEstimate,
    handleLaborStep,
  };
};
