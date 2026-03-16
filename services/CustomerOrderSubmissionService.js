import { uploadOrderItemsMedia } from './OrderItemMediaService';
import { failureResult, successResult } from './contracts/result';
import { logger } from './logger';
import { logFlowError, logFlowInfo, startFlowContext } from './flowContext';

const DEFAULT_INSURANCE_RETRY_DELAY_MS = 1500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getDefaultPurchaseInsurance = () => {
  const redkikServiceModule = require('./RedkikService');
  return redkikServiceModule?.default?.purchaseInsurance;
};

const toRoundedAmount = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return 0;
  }
  return Math.round(parsedValue * 100) / 100;
};

const getInsurancePremiumAmount = (insuranceQuote) => {
  const premium = Number(insuranceQuote?.premium);
  return Number.isFinite(premium) && premium > 0 ? premium : 0;
};

const removeInsuranceFromTotal = (totalAmount, insuranceQuote) => {
  return toRoundedAmount(totalAmount - getInsurancePremiumAmount(insuranceQuote));
};

const toInsurancePurchaseData = ({ offerId, premium, bookingId }) => ({
  bookingId,
  quoteId: offerId,
  premium,
  status: 'purchased',
});

const attemptInsurancePurchase = async ({ offerId, premium, purchaseInsurance }) => {
  const purchaseResult = await purchaseInsurance(offerId);
  if (!purchaseResult?.bookingId) {
    return null;
  }
  return toInsurancePurchaseData({
    offerId,
    premium,
    bookingId: purchaseResult.bookingId,
  });
};

const buildRideDetails = (orderData = {}) => ({
  scheduleType: orderData?.scheduleType,
  scheduledDateTime: orderData?.scheduledDateTime,
  pickup: orderData?.pickup,
  dropoff: orderData?.dropoff,
  distance: orderData?.distance,
  duration: orderData?.duration,
  vehicleType: orderData?.selectedVehicle?.type,
  itemsCount: orderData?.items?.length || 0,
  timestamp: new Date().toISOString(),
});

const resolveInsuranceForOrder = async ({
  orderData,
  totalAmount,
  purchaseInsurance,
  insuranceRetryDelayMs,
}) => {
  const insuranceQuote = orderData?.insuranceQuote;
  const offerId = insuranceQuote?.offerId;
  let insuranceData = null;
  let finalAmount = totalAmount;
  const notices = [];

  if (!offerId) {
    return { insuranceData, finalAmount, notices };
  }

  if (insuranceQuote?.canPurchase === false) {
    insuranceData = {
      quoteId: offerId,
      bookingId: null,
      premium: insuranceQuote?.premium,
      status: 'amendments_blocked',
    };
    finalAmount = removeInsuranceFromTotal(totalAmount, insuranceQuote);
    notices.push({
      title: 'Insurance Unavailable',
      message:
        'Insurance could not be applied due to validation issues. You will only be charged for the delivery.',
    });
    return { insuranceData, finalAmount, notices };
  }

  try {
    insuranceData = await attemptInsurancePurchase({
      offerId,
      premium: insuranceQuote?.premium,
      purchaseInsurance,
    });
    if (!insuranceData) {
      await wait(insuranceRetryDelayMs);
      insuranceData = await attemptInsurancePurchase({
        offerId,
        premium: insuranceQuote?.premium,
        purchaseInsurance,
      });
    }
  } catch (insuranceError) {
    logger.warn('CustomerOrderSubmission', 'Insurance purchase failed', insuranceError);
  }

  if (!insuranceData) {
    finalAmount = removeInsuranceFromTotal(totalAmount, insuranceQuote);
    insuranceData = {
      quoteId: offerId,
      bookingId: null,
      premium: insuranceQuote?.premium,
      status: 'purchase_failed',
    };
    notices.push({
      title: 'Insurance Notice',
      message:
        'We could not activate your insurance coverage. You will only be charged for the delivery itself. Our support team will follow up.',
    });
  }

  return { insuranceData, finalAmount, notices };
};

export const submitCustomerOrder = async ({
  orderData,
  currentUserId,
  uploadToSupabase,
  createPaymentIntent,
  confirmPayment,
  createPickupRequest,
  purchaseInsurance,
  insuranceRetryDelayMs = DEFAULT_INSURANCE_RETRY_DELAY_MS,
}) => {
  const flowContext = startFlowContext('trip.submitOrder', {
    userId: currentUserId || null,
    hasInsuranceQuote: Boolean(orderData?.insuranceQuote?.offerId),
  });

  const selectedPaymentMethod = orderData?.selectedPaymentMethod;
  const totalAmount = Number(orderData?.pricing?.total || 0);
  if (!selectedPaymentMethod?.stripePaymentMethodId) {
    return failureResult('Please select a saved payment method.', null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }
  if (totalAmount <= 0) {
    return failureResult('Invalid order total. Please review your order and try again.', null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }

  try {
    logFlowInfo('CustomerOrderSubmission', 'order submission started', flowContext);
    const needsInsurancePurchase = Boolean(orderData?.insuranceQuote?.offerId);
    let purchaseInsuranceFn = purchaseInsurance;

    if (needsInsurancePurchase && typeof purchaseInsuranceFn !== 'function') {
      purchaseInsuranceFn = getDefaultPurchaseInsurance();
    }

    if (needsInsurancePurchase && typeof purchaseInsuranceFn !== 'function') {
      return failureResult('Insurance service is unavailable. Please try again.', null, {
        notices: [],
        correlationId: flowContext.correlationId,
      });
    }

    const {
      insuranceData,
      finalAmount,
      notices,
    } = await resolveInsuranceForOrder({
      orderData,
      totalAmount,
      purchaseInsurance: purchaseInsuranceFn,
      insuranceRetryDelayMs,
    });

    const finalAmountInCents = Math.round(finalAmount * 100);
    if (!Number.isInteger(finalAmountInCents) || finalAmountInCents <= 0) {
      return failureResult('Invalid order total. Please review your order and try again.', null, {
        notices,
        correlationId: flowContext.correlationId,
      });
    }

    const uploadItemsResult = await uploadOrderItemsMedia({
      items: orderData?.items || [],
      userId: currentUserId,
      uploadToSupabase,
    });
    if (!uploadItemsResult.success) {
      return failureResult(
        uploadItemsResult.error || 'Could not upload item photos. Please try again.',
        null,
        { notices, correlationId: flowContext.correlationId }
      );
    }

    const paymentIntentResult = await createPaymentIntent(
      finalAmountInCents,
      'usd',
      buildRideDetails(orderData),
      selectedPaymentMethod.stripePaymentMethodId
    );
    if (!paymentIntentResult.success || !paymentIntentResult.paymentIntent?.client_secret) {
      return failureResult(paymentIntentResult.error || 'Failed to start payment.', null, {
        notices,
        correlationId: flowContext.correlationId,
      });
    }

    const paymentResult = await confirmPayment(
      paymentIntentResult.paymentIntent.client_secret,
      selectedPaymentMethod.stripePaymentMethodId
    );
    if (!paymentResult.success) {
      return failureResult(paymentResult.error || 'Unable to confirm payment.', null, {
        notices,
        correlationId: flowContext.correlationId,
      });
    }

    const createdRequest = await createPickupRequest({
      pickup: orderData?.pickup,
      dropoff: orderData?.dropoff,
      pickupDetails: orderData?.pickupDetails || {},
      dropoffDetails: orderData?.dropoffDetails || {},
      vehicle: orderData?.selectedVehicle,
      pricing: {
        ...(orderData?.pricing || {}),
        total: finalAmount,
        distance: Number(orderData?.distance || orderData?.pricing?.distance || 0),
      },
      items: uploadItemsResult.items,
      scheduledTime:
        orderData?.scheduleType === 'scheduled'
          ? orderData?.scheduledDateTime
          : null,
      insurance: insuranceData,
    });

    logFlowInfo('CustomerOrderSubmission', 'order submission succeeded', flowContext);
    return successResult({
      createdRequest: createdRequest || null,
      notices,
      correlationId: flowContext.correlationId,
    });
  } catch (error) {
    const normalized = logFlowError(
      'CustomerOrderSubmission',
      'order submission failed',
      error,
      flowContext,
      'Payment failed. Please try again.'
    );
    return failureResult(normalized.message || 'Payment failed. Please try again.', null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }
};
