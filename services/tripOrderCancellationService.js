import { appConfig } from '../config/appConfig';
import {
  ensureOrderCanBeCancelled,
  getCancellationInfoFromOrder,
  notifyPaymentBackendCancellation,
  persistTripCancellation,
  resolveCancellationActorId,
  shouldNotifyPaymentBackendForStatus,
} from './tripCancellationUtils';
import { cancelInsuranceBookingForTrip } from './tripInsuranceUtils';
import { getRequestById } from './tripLifecycleUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { failureResult, successResult } from './contracts/result';

const PAYMENT_SERVICE_URL = appConfig.paymentService.baseUrl;

export const cancelOrder = async (orderId, reason = 'customer_request', currentUser) => {
  try {
    const orderData = await getRequestById(orderId);
    const normalizedOrderStatus = ensureOrderCanBeCancelled(orderData);
    const customerId = resolveCancellationActorId({ currentUser, orderData });

    if (shouldNotifyPaymentBackendForStatus(normalizedOrderStatus)) {
      await notifyPaymentBackendCancellation({
        paymentServiceUrl: PAYMENT_SERVICE_URL,
        orderId,
        customerId,
        reason,
        driverLocation: orderData.driverLocation || orderData.driver_location || null,
      });
    }

    await persistTripCancellation({
      orderId,
      actorId: customerId,
      reason,
    });

    await cancelInsuranceBookingForTrip(orderData);

    return successResult();
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to cancel order');
    logger.error('TripOrderCancellationService', 'Error cancelling order', normalized, error);
    return failureResult(normalized.message, normalized.code || null);
  }
};

export const getCancellationInfo = getCancellationInfoFromOrder;
