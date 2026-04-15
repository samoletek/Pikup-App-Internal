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
const INSURANCE_STATUS = Object.freeze({
  PURCHASED: 'purchased',
  AMENDMENTS_BLOCKED: 'amendments_blocked',
  PURCHASE_FAILED: 'purchase_failed',
  QUOTE_UNAVAILABLE_OPT_IN: 'quote_unavailable_opt_in',
});
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

const isInsuredNewItem = (item = {}) =>
  String(item?.condition || '').toLowerCase() === 'new' && item?.hasInsurance === true;

const hasInsuredNewItems = (items = []) =>
  Array.isArray(items) && items.some((item) => isInsuredNewItem(item));

const toInsurancePurchaseData = ({ offerId, premium, bookingId }) => ({
  bookingId,
  quoteId: offerId,
  premium,
  status: INSURANCE_STATUS.PURCHASED,
});

const toQuoteUnavailableOptInInsuranceData = () => ({
  bookingId: null,
  quoteId: null,
  premium: null,
  status: INSURANCE_STATUS.QUOTE_UNAVAILABLE_OPT_IN,
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
      premium: null,
      status: INSURANCE_STATUS.AMENDMENTS_BLOCKED,
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
      premium: null,
      status: INSURANCE_STATUS.PURCHASE_FAILED,
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
  const hasInsuredItems = hasInsuredNewItems(orderData?.items || []);
  const hasInsuranceOfferId = Boolean(orderData?.insuranceQuote?.offerId);
  const allowUninsuredInsuranceFallback = (
    hasInsuredItems &&
    !hasInsuranceOfferId &&
    orderData?.insuranceQuoteFallbackOptIn === true
  );

  const flowContext = startFlowContext('trip.submitOrder', {
    userId: currentUserId || null,
    hasInsuranceQuote: hasInsuranceOfferId,
    hasInsuredItems,
    allowUninsuredInsuranceFallback,
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

  if (hasInsuredItems && !hasInsuranceOfferId && !allowUninsuredInsuranceFallback) {
    return failureResult(
      'Insurance quote is still loading. Please wait a moment and try again.',
      null,
      {
        notices: [],
        correlationId: flowContext.correlationId,
      }
    );
  }

  try {
    logFlowInfo('CustomerOrderSubmission', 'order submission started', flowContext);
    const fallbackInsuranceData = allowUninsuredInsuranceFallback
      ? toQuoteUnavailableOptInInsuranceData()
      : null;
    if (fallbackInsuranceData) {
      logFlowInfo(
        'CustomerOrderSubmission',
        'creating order without insurance after customer fallback opt-in',
        flowContext
      );
    }
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
      insuranceData: resolvedInsuranceData,
      finalAmount,
      notices,
    } = await resolveInsuranceForOrder({
      orderData,
      totalAmount,
      purchaseInsurance: purchaseInsuranceFn,
      insuranceRetryDelayMs,
    });
    const insuranceData = resolvedInsuranceData || fallbackInsuranceData;

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

    const shouldPersistInsurancePricing = insuranceData?.status === INSURANCE_STATUS.PURCHASED;
    const normalizedPricing = {
      ...(orderData?.pricing || {}),
      total: finalAmount,
      distance: normalizedDistanceMiles,
      ...(normalizedDurationMinutes !== null
        ? {
          duration: normalizedDurationMinutes,
          durationMinutes: normalizedDurationMinutes,
        }
        : {}),
      ...(shouldPersistInsurancePricing
        ? {}
        : {
          mandatoryInsurance: 0,
          insuranceApplied: false,
        }),
    };

    const createdRequest = await createPickupRequest({
      pickup: orderData?.pickup,
      dropoff: orderData?.dropoff,
      pickupDetails: orderData?.pickupDetails || {},
      dropoffDetails: orderData?.dropoffDetails || {},
      vehicle: orderData?.selectedVehicle,
      pricing: normalizedPricing,
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
