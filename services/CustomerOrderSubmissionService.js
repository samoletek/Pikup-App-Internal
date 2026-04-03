import { uploadOrderItemsMedia } from './OrderItemMediaService';
import { failureResult, successResult } from './contracts/result';
import { logger } from './logger';
import { logFlowError, logFlowInfo, startFlowContext } from './flowContext';
import {
  COMING_SOON_UNSUPPORTED_STATE_MESSAGE,
  SUPPORTED_ORDER_STATE_CODES,
} from '../constants/orderAvailability';
import {
  evaluateOrderStateCoverage,
  isSupportedOrderStateCode,
  resolveLocationStateCode,
} from '../utils/locationState';

const DEFAULT_INSURANCE_RETRY_DELAY_MS = 1500;
const REMOTE_URL_REGEX = /^https?:\/\//i;
const MEDIA_UPLOAD_FALLBACK_NOTICE = Object.freeze({
  title: 'Photos not attached',
  message:
    'We could not attach some item photos or receipts, but your order was created successfully.',
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRemoteMediaUrl = (value) =>
  typeof value === 'string' && REMOTE_URL_REGEX.test(value.trim());

const sanitizeOrderItemsForPersistence = (items = []) => {
  const sourceItems = Array.isArray(items) ? items : [];

  return sourceItems.map((item = {}) => {
    const sourcePhotos = Array.isArray(item.photos) ? item.photos : [];
    const persistedPhotos = sourcePhotos.filter((photo) => isRemoteMediaUrl(photo));
    const persistedInvoicePhoto = isRemoteMediaUrl(item.invoicePhoto)
      ? item.invoicePhoto
      : null;

    return {
      ...item,
      photos: persistedPhotos,
      invoicePhoto: persistedInvoicePhoto,
    };
  });
};

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

const toPositiveInteger = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }
  return Math.round(parsedValue);
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
  const customerStateCode = resolveLocationStateCode(orderData?.customerLocation || null);
  if (customerStateCode && !isSupportedOrderStateCode(customerStateCode, SUPPORTED_ORDER_STATE_CODES)) {
    return failureResult(COMING_SOON_UNSUPPORTED_STATE_MESSAGE, null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }

  const stateCoverage = evaluateOrderStateCoverage({
    pickup: orderData?.pickup || null,
    dropoff: orderData?.dropoff || null,
    supportedStateCodes: SUPPORTED_ORDER_STATE_CODES,
    requireResolvedState: true,
  });

  if (!stateCoverage.isSupported && stateCoverage.reason === 'state_unresolved') {
    return failureResult('Please select pickup and dropoff addresses from suggestions.', null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }

  if (!stateCoverage.isSupported && stateCoverage.reason === 'unsupported_state') {
    return failureResult(COMING_SOON_UNSUPPORTED_STATE_MESSAGE, null, {
      notices: [],
      correlationId: flowContext.correlationId,
    });
  }

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

    if (finalAmount <= 0) {
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
    const fallbackItems = sanitizeOrderItemsForPersistence(orderData?.items || []);
    const persistedItems = uploadItemsResult.success
      ? (uploadItemsResult.items || fallbackItems)
      : fallbackItems;
    const submissionNotices = Array.isArray(notices) ? [...notices] : [];

    if (!uploadItemsResult.success) {
      logger.warn(
        'CustomerOrderSubmission',
        'Order item media upload failed, continuing without local media attachments',
        {
          error: uploadItemsResult.error || null,
          errorCode: uploadItemsResult.errorCode || null,
          correlationId: flowContext.correlationId,
        }
      );
      submissionNotices.push(MEDIA_UPLOAD_FALLBACK_NOTICE);
    }

    const normalizedDistanceMiles = Number(orderData?.distance || orderData?.pricing?.distance || 0);
    const normalizedDurationMinutes =
      toPositiveInteger(orderData?.duration) ??
      toPositiveInteger(orderData?.pricing?.durationMinutes) ??
      toPositiveInteger(orderData?.pricing?.duration) ??
      null;

    const createdRequest = await createPickupRequest({
      pickup: orderData?.pickup,
      dropoff: orderData?.dropoff,
      pickupDetails: orderData?.pickupDetails || {},
      dropoffDetails: orderData?.dropoffDetails || {},
      vehicle: orderData?.selectedVehicle,
      pricing: {
        ...(orderData?.pricing || {}),
        total: finalAmount,
        distance: normalizedDistanceMiles,
        ...(normalizedDurationMinutes !== null
          ? {
            duration: normalizedDurationMinutes,
            durationMinutes: normalizedDurationMinutes,
          }
          : {}),
      },
      items: persistedItems,
      scheduledTime:
        orderData?.scheduleType === 'scheduled'
          ? orderData?.scheduledDateTime
          : null,
      insurance: insuranceData,
      selectedPaymentMethodId: selectedPaymentMethod.stripePaymentMethodId,
    });

    logFlowInfo('CustomerOrderSubmission', 'order submission succeeded', flowContext);
    return successResult({
      createdRequest: createdRequest || null,
      notices: submissionNotices,
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
