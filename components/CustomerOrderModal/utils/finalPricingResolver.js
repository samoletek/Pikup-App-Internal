import RedkikService from '../../../services/RedkikService';
import {
  recalculatePricingWithLabor,
  refreshPricingSnapshot,
} from '../../../services/PricingService';
import { logger } from '../../../services/logger';

const QUOTE_MAX_AGE_MS = 10 * 60 * 1000;

export const resolveFinalPricing = async ({
  calculatePricing,
  customerEmail,
  customerName,
  insuranceQuote,
  laborAdjustment,
  orderData,
  previewPricing,
  setInsuranceQuote,
  getInsuredItems,
}) => {
  let activeInsuranceQuote = insuranceQuote;
  if (insuranceQuote?.fetchedAt && Date.now() - insuranceQuote.fetchedAt > QUOTE_MAX_AGE_MS) {
    const insuredItems = getInsuredItems(orderData.items);
    if (insuredItems.length > 0) {
      try {
        const freshQuote = await RedkikService.getQuote({
          items: insuredItems,
          pickup: orderData.pickup,
          dropoff: orderData.dropoff,
          scheduledTime: orderData.scheduleType === 'scheduled' ? orderData.scheduledDateTime : null,
          durationMinutes: orderData.duration || null,
          customerEmail,
          customerName,
        });

        if (freshQuote) {
          activeInsuranceQuote = { ...freshQuote, fetchedAt: Date.now() };
        } else {
          logger.warn('CustomerOrderCheckout', 'Quote refresh returned null, keeping previous quote');
        }

        setInsuranceQuote(activeInsuranceQuote);
      } catch (error) {
        logger.warn('CustomerOrderCheckout', 'Quote refresh failed, keeping previous quote', error);
      }
    }
  }

  const rawPricing = previewPricing || await calculatePricing();

  let basePricing = rawPricing;
  if (laborAdjustment !== null && rawPricing) {
    basePricing = recalculatePricingWithLabor(rawPricing, laborAdjustment);
  }

  let finalPricing = basePricing;
  if (activeInsuranceQuote?.premium > 0 && basePricing?.insuranceApplied) {
    finalPricing = refreshPricingSnapshot({
      ...basePricing,
      mandatoryInsurance: activeInsuranceQuote.premium,
    });
  }

  return {
    pricing: finalPricing,
    insuranceQuote: activeInsuranceQuote,
  };
};
