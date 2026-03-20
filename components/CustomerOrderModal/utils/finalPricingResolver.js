import RedkikService from '../../../services/RedkikService';
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
    const bufferMinutes = rawPricing.laborBufferMinutes || 0;
    const billable = Math.max(0, laborAdjustment - bufferMinutes);
    const newLaborFee = Math.round(billable * (rawPricing.laborPerMin || 0) * 100) / 100;
    const laborDiff = newLaborFee - (rawPricing.laborFee || 0);
    const taxRate = Number(rawPricing.taxRate || 0);
    const newTaxableLaborAmount = newLaborFee;
    const newTax = Math.round(newTaxableLaborAmount * taxRate * 100) / 100;
    const taxDiff = newTax - (rawPricing.tax || 0);

    basePricing = {
      ...rawPricing,
      laborFee: newLaborFee,
      laborMinutes: laborAdjustment,
      laborBillableMinutes: billable,
      taxableLaborAmount: newTaxableLaborAmount,
      tax: newTax,
      total: Math.round((rawPricing.total + laborDiff + taxDiff) * 100) / 100,
    };
  }

  let finalPricing = basePricing;
  if (activeInsuranceQuote?.premium > 0 && basePricing?.insuranceApplied) {
    const redkikPremium = activeInsuranceQuote.premium;
    const oldInsurance = basePricing.mandatoryInsurance || 0;
    finalPricing = {
      ...basePricing,
      mandatoryInsurance: redkikPremium,
      total: Math.round((basePricing.total - oldInsurance + redkikPremium) * 100) / 100,
    };
  }

  return {
    pricing: finalPricing,
    insuranceQuote: activeInsuranceQuote,
  };
};
