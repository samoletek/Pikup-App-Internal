import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';
import { logger } from './logger';
import { updateTripById } from './repositories/tripRepository';
import { normalizeError } from './errorService';

export const ensureOrderCanBeCancelled = (orderData) => {
    if (!orderData) {
        throw new Error('Order not found');
    }

    const normalizedOrderStatus = normalizeTripStatus(orderData.status);
    if (normalizedOrderStatus === TRIP_STATUS.COMPLETED || normalizedOrderStatus === TRIP_STATUS.CANCELLED) {
        throw new Error('Order already finalized');
    }

    return normalizedOrderStatus;
};

export const shouldNotifyPaymentBackendForStatus = (status) => status !== TRIP_STATUS.PENDING;

export const resolveCancellationActorId = ({ currentUser, orderData }) =>
    currentUser?.uid || currentUser?.id || orderData?.customerId || orderData?.customer_id || null;

export const notifyPaymentBackendCancellation = async ({
    paymentServiceUrl,
    orderId,
    customerId,
    reason,
    driverLocation,
}) => {
    const payload = {
        orderId,
        customerId,
        reason,
        driverLocation: driverLocation || null,
    };

    try {
        const response = await fetch(`${paymentServiceUrl}/cancel-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            logger.warn(
                'TripCancellation',
                `Payment backend cancellation returned ${response.status}. Proceeding with Supabase cancellation.`
            );
        }
    } catch (error) {
        const normalized = normalizeError(
            error,
            'Payment backend cancellation request failed. Proceeding with Supabase cancellation.'
        );
        logger.warn(
            'TripCancellation',
            'Payment backend cancellation request failed. Proceeding with Supabase cancellation.',
            normalized,
            error
        );
    }
};

export const persistTripCancellation = async ({ orderId, actorId, reason }) => {
    const cancellationUpdates = {
        status: toDbTripStatus(TRIP_STATUS.CANCELLED),
        cancelled_at: new Date().toISOString(),
        cancelled_by: actorId || null,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
    };

    const { error } = await updateTripById(orderId, cancellationUpdates);

    if (error) {
        throw error;
    }
};

export const getCancellationInfoFromOrder = (orderData) => {
    const status = normalizeTripStatus(orderData.status);
    const orderTotal = orderData.pricing?.total || 0;

    switch (status) {
        case TRIP_STATUS.PENDING:
            return {
                canCancel: true,
                fee: 0,
                reason: 'Free cancellation - no driver assigned yet',
                refundAmount: orderTotal,
                driverCompensation: 0,
            };

        case TRIP_STATUS.ACCEPTED:
        case TRIP_STATUS.IN_PROGRESS:
            return {
                canCancel: true,
                fee: 0,
                reason: 'Free cancellation - driver is on the way',
                refundAmount: orderTotal,
                driverCompensation: 0,
            };

        case TRIP_STATUS.ARRIVED_AT_PICKUP:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - driver has arrived at pickup location',
                refundAmount: 0,
                driverCompensation: 0,
            };

        case TRIP_STATUS.PICKED_UP:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - items have been picked up',
                refundAmount: 0,
                driverCompensation: 0,
            };

        case TRIP_STATUS.EN_ROUTE_TO_DROPOFF:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - delivery is in progress',
                refundAmount: 0,
                driverCompensation: 0,
            };

        case TRIP_STATUS.COMPLETED:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - order has been completed',
                refundAmount: 0,
                driverCompensation: 0,
            };

        case TRIP_STATUS.CANCELLED:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Order is already cancelled',
                refundAmount: 0,
                driverCompensation: 0,
            };

        default:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Unknown order status',
                refundAmount: 0,
                driverCompensation: 0,
            };
    }
};
