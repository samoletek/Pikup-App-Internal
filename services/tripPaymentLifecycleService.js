import { failureResult, successResult } from './contracts/result';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  invokeAuthorizeTripPayment,
  invokeCaptureTripPayment,
  invokeCreateTipPayment,
  invokeReleaseTripPayment,
} from './repositories/paymentRepository';

const resolveString = (value) => String(value || '').trim();

const toCents = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 100);
};

const resolveTripId = (tripLike = {}) => {
  return resolveString(tripLike?.id || tripLike?.requestId || tripLike?.tripId || null);
};

const resolveCustomerId = (tripLike = {}) => {
  return resolveString(tripLike?.customer_id || tripLike?.customerId || null);
};

const resolvePaymentMethodId = (tripLike = {}) => {
  return resolveString(
    tripLike?.booking_payment_method_id ||
      tripLike?.bookingPaymentMethodId ||
      tripLike?.selected_payment_method_id ||
      tripLike?.selectedPaymentMethodId ||
      null
  );
};

const resolveTripAmountCents = (tripLike = {}) => {
  const fromPrice = toCents(tripLike?.price);
  if (fromPrice > 0) {
    return fromPrice;
  }

  const fromPricingTotal = toCents(tripLike?.pricing?.total);
  if (fromPricingTotal > 0) {
    return fromPricingTotal;
  }

  return 0;
};

const resolveEdgeErrorMessage = (edgeError, edgeData, fallbackMessage) => {
  if (edgeError?.message) {
    return edgeError.message;
  }

  if (typeof edgeData?.error === 'string' && edgeData.error.trim()) {
    return edgeData.error.trim();
  }

  return fallbackMessage;
};

export const authorizeTripPayment = async ({
  trip,
  driverId,
  idempotencyKey,
}) => {
  try {
    const tripId = resolveTripId(trip || {});
    if (!tripId) {
      return failureResult('Trip ID is required', 'trip_id_required');
    }

    const customerId = resolveCustomerId(trip || {});
    if (!customerId) {
      return failureResult('Trip customer is missing', 'trip_customer_missing');
    }

    const paymentMethodId = resolvePaymentMethodId(trip || {});
    if (!paymentMethodId) {
      return failureResult('Trip payment method is missing', 'trip_payment_method_missing');
    }

    const amountCents = resolveTripAmountCents(trip || {});
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return failureResult('Trip amount is invalid', 'trip_amount_invalid');
    }

    const fallbackIdempotencyKey = `trip_hold:${tripId}:${resolveString(driverId) || 'driver'}`;
    const { data, error } = await invokeAuthorizeTripPayment({
      tripId,
      customerId,
      paymentMethodId,
      amountCents,
      currency: 'usd',
      idempotencyKey: resolveString(idempotencyKey) || fallbackIdempotencyKey,
    });

    if (error || data?.success === false || data?.error) {
      return failureResult(
        resolveEdgeErrorMessage(error, data, 'Failed to authorize trip payment'),
        data?.code || error?.code || null
      );
    }

    return successResult({
      paymentIntentId: data?.paymentIntentId || null,
      status: data?.status || 'authorized',
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to authorize trip payment');
    logger.error('TripPaymentLifecycle', 'authorizeTripPayment failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const captureTripPayment = async ({ tripId, idempotencyKey }) => {
  try {
    const normalizedTripId = resolveString(tripId);
    if (!normalizedTripId) {
      return failureResult('Trip ID is required', 'trip_id_required');
    }

    const { data, error } = await invokeCaptureTripPayment({
      tripId: normalizedTripId,
      idempotencyKey: resolveString(idempotencyKey) || `trip_capture:${normalizedTripId}`,
    });

    if (error || data?.success === false || data?.error) {
      return failureResult(
        resolveEdgeErrorMessage(error, data, 'Failed to capture trip payment'),
        data?.code || error?.code || null
      );
    }

    return successResult({
      paymentIntentId: data?.paymentIntentId || null,
      chargeId: data?.chargeId || null,
      status: data?.status || 'captured',
      total: Number(data?.total || 0),
      driverPayout: Number(data?.driverPayout || 0),
      platformShare: Number(data?.platformShare || 0),
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to capture trip payment');
    logger.error('TripPaymentLifecycle', 'captureTripPayment failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const releaseTripPayment = async ({ tripId, reason, idempotencyKey }) => {
  try {
    const normalizedTripId = resolveString(tripId);
    if (!normalizedTripId) {
      return failureResult('Trip ID is required', 'trip_id_required');
    }

    const { data, error } = await invokeReleaseTripPayment({
      tripId: normalizedTripId,
      reason: resolveString(reason) || null,
      idempotencyKey: resolveString(idempotencyKey) || `trip_release:${normalizedTripId}`,
    });

    if (error || data?.success === false || data?.error) {
      return failureResult(
        resolveEdgeErrorMessage(error, data, 'Failed to release trip payment'),
        data?.code || error?.code || null
      );
    }

    return successResult({
      paymentIntentId: data?.paymentIntentId || null,
      status: data?.status || 'released',
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to release trip payment');
    logger.error('TripPaymentLifecycle', 'releaseTripPayment failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const createTripTipPayment = async ({ tripId, tipAmount, idempotencyKey }) => {
  try {
    const normalizedTripId = resolveString(tripId);
    if (!normalizedTripId) {
      return failureResult('Trip ID is required', 'trip_id_required');
    }

    const tipAmountCents = toCents(tipAmount);
    if (!Number.isInteger(tipAmountCents) || tipAmountCents <= 0) {
      return failureResult('Tip amount must be greater than $0.00', 'tip_amount_invalid');
    }

    const { data, error } = await invokeCreateTipPayment({
      tripId: normalizedTripId,
      tipAmountCents,
      idempotencyKey: resolveString(idempotencyKey) || `trip_tip:${normalizedTripId}:${tipAmountCents}`,
    });

    if (error || data?.success === false || data?.error) {
      return failureResult(
        resolveEdgeErrorMessage(error, data, 'Failed to process tip payment'),
        data?.code || error?.code || null
      );
    }

    return successResult({
      tipPaymentIntentId: data?.tipPaymentIntentId || null,
      amount: Number(data?.amount || tipAmount || 0),
      status: data?.status || 'succeeded',
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to process tip payment');
    logger.error('TripPaymentLifecycle', 'createTripTipPayment failed', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};
