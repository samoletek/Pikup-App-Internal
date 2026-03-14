import { uploadOrderItemsMedia } from './OrderItemMediaService';

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
    console.warn('Insurance purchase failed:', insuranceError);
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
  const selectedPaymentMethod = orderData?.selectedPaymentMethod;
  const totalAmount = Number(orderData?.pricing?.total || 0);
  if (!selectedPaymentMethod?.stripePaymentMethodId) {
    return {
      success: false,
      error: 'Please select a saved payment method.',
      notices: [],
    };
  }
  if (totalAmount <= 0) {
    return {
      success: false,
      error: 'Invalid order total. Please review your order and try again.',
      notices: [],
    };
  }

  try {
    const needsInsurancePurchase = Boolean(orderData?.insuranceQuote?.offerId);
    let purchaseInsuranceFn = purchaseInsurance;

    if (needsInsurancePurchase && typeof purchaseInsuranceFn !== 'function') {
      purchaseInsuranceFn = getDefaultPurchaseInsurance();
    }

    if (needsInsurancePurchase && typeof purchaseInsuranceFn !== 'function') {
      return {
        success: false,
        error: 'Insurance service is unavailable. Please try again.',
        notices: [],
      };
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
      return {
        success: false,
        error: 'Invalid order total. Please review your order and try again.',
        notices,
      };
    }

    const uploadItemsResult = await uploadOrderItemsMedia({
      items: orderData?.items || [],
      userId: currentUserId,
      uploadToSupabase,
    });
    if (!uploadItemsResult.success) {
      return {
        success: false,
        error: uploadItemsResult.error || 'Could not upload item photos. Please try again.',
        notices,
      };
    }

    const paymentIntentResult = await createPaymentIntent(
      finalAmountInCents,
      'usd',
      buildRideDetails(orderData),
      selectedPaymentMethod.stripePaymentMethodId
    );
    if (!paymentIntentResult.success || !paymentIntentResult.paymentIntent?.client_secret) {
      return {
        success: false,
        error: paymentIntentResult.error || 'Failed to start payment.',
        notices,
      };
    }

    const paymentResult = await confirmPayment(
      paymentIntentResult.paymentIntent.client_secret,
      selectedPaymentMethod.stripePaymentMethodId
    );
    if (!paymentResult.success) {
      return {
        success: false,
        error: paymentResult.error || 'Unable to confirm payment.',
        notices,
      };
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

    return {
      success: true,
      createdRequest: createdRequest || null,
      notices,
    };
  } catch (error) {
    console.error('Error confirming customer order:', error);
    return {
      success: false,
      error: error?.message || 'Payment failed. Please try again.',
      notices: [],
    };
  }
};
