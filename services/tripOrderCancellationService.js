import { appConfig } from '../config/appConfig';
import {
  ensureOrderCanBeCancelled,
  getCancellationInfoFromOrder,
  notifyPaymentBackendCancellation,
  persistTripCancellation,
  resolveCancellationActorRole,
  resolveCancellationActorId,
  resolveOrderCustomerId,
  shouldNotifyPaymentBackendForStatus,
} from './tripCancellationUtils';
import { cancelInsuranceBookingForTrip } from './tripInsuranceUtils';
import { getRequestById } from './tripLifecycleUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';
import { releaseTripPayment } from './tripPaymentLifecycleService';

const PAYMENT_SERVICE_URL = appConfig.paymentService.baseUrl;

export const cancelOrder = async (orderId, reason = 'customer_request', currentUser) => {
  try {
    const orderData = await getRequestById(orderId);
    const actorRole = resolveCancellationActorRole({ currentUser, orderData });
    const normalizedOrderStatus = ensureOrderCanBeCancelled(orderData, { actorRole });
    const actorId = resolveCancellationActorId({ currentUser, orderData });
    const orderCustomerId = resolveOrderCustomerId(orderData);

    if (shouldNotifyPaymentBackendForStatus(normalizedOrderStatus)) {
      await notifyPaymentBackendCancellation({
        paymentServiceUrl: PAYMENT_SERVICE_URL,
        orderId,
        customerId: orderCustomerId,
        reason,
        driverLocation: orderData.driverLocation || orderData.driver_location || null,
      });
    }

    const releaseResult = await releaseTripPayment({
      tripId: orderId,
      reason,
      idempotencyKey: `trip_release:${orderId}:${reason}`,
    });

    let paymentReleaseWarning = null;
    if (!releaseResult.success && releaseResult.errorCode !== 'missing_authorization') {
      paymentReleaseWarning = releaseResult.error || 'Failed to release trip payment authorization';
      logger.warn(
        'TripOrderCancellationService',
        'Trip payment release failed during cancellation, proceeding with trip cancellation',
        {
          orderId,
          reason,
          errorCode: releaseResult.errorCode || null,
          error: releaseResult.error || null,
        }
      );
    }

    await persistTripCancellation({
      orderId,
      actorId,
      reason,
    });

    await cancelInsuranceBookingForTrip(orderData);

    return successResult({
      paymentReleaseWarning,
    });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to cancel order');
    logger.error('TripOrderCancellationService', 'Error cancelling order', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const getCancellationInfo = getCancellationInfoFromOrder;
