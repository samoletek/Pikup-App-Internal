import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';
import { logger } from './logger';
import { updateTripById } from './repositories/tripRepository';
import { normalizeError } from './errorService';

const CUSTOMER_CANCELLABLE_TRIP_STATUSES = new Set([
    TRIP_STATUS.PENDING,
    TRIP_STATUS.ACCEPTED,
    TRIP_STATUS.IN_PROGRESS,
    TRIP_STATUS.ARRIVED_AT_PICKUP,
]);

const DRIVER_CANCELLABLE_TRIP_STATUSES = new Set([
    TRIP_STATUS.ARRIVED_AT_PICKUP,
]);

const CANCELLABLE_STATUSES_BY_ROLE = {
    customer: CUSTOMER_CANCELLABLE_TRIP_STATUSES,
    driver: DRIVER_CANCELLABLE_TRIP_STATUSES,
};

const resolveTripCustomerId = (orderData) => orderData?.customerId || orderData?.customer_id || null;

const resolveTripDriverId = (orderData) => orderData?.driverId || orderData?.driver_id || null;

const resolveCurrentUserId = (currentUser) => currentUser?.uid || currentUser?.id || null;

const getRoleSpecificCancellationError = ({ actorRole, orderData }) => {
    if (actorRole !== 'driver') {
        const cancellationInfo = getCancellationInfoFromOrder(orderData);
        return cancellationInfo.reason || 'Order cannot be cancelled at this stage';
    }

    const normalizedStatus = normalizeTripStatus(orderData?.status);
    if (normalizedStatus === TRIP_STATUS.PICKED_UP) {
        return 'Cannot cancel - loading has started';
    }

    if (normalizedStatus === TRIP_STATUS.ARRIVED_AT_DROPOFF) {
        return 'Cannot cancel - driver has arrived at dropoff';
    }

    if (normalizedStatus === TRIP_STATUS.EN_ROUTE_TO_DROPOFF) {
        return 'Cannot cancel - delivery is in progress';
    }

    return 'Driver can cancel only at pickup if address/details are wrong or loading help is unavailable';
};

export const resolveCancellationActorRole = ({ currentUser, orderData }) => {
    const currentUserId = resolveCurrentUserId(currentUser);
    if (!currentUserId) {
        return 'customer';
    }

    if (currentUserId === resolveTripDriverId(orderData)) {
        return 'driver';
    }

    if (currentUserId === resolveTripCustomerId(orderData)) {
        return 'customer';
    }

    return 'customer';
};

export const resolveOrderCustomerId = (orderData) => resolveTripCustomerId(orderData);

export const ensureOrderCanBeCancelled = (orderData, { actorRole = 'customer' } = {}) => {
    if (!orderData) {
        throw new Error('Order not found');
    }

    const normalizedOrderStatus = normalizeTripStatus(orderData.status);
    const role = actorRole === 'driver' ? 'driver' : 'customer';
    const cancellableStatuses = CANCELLABLE_STATUSES_BY_ROLE[role] || CUSTOMER_CANCELLABLE_TRIP_STATUSES;

    if (!cancellableStatuses.has(normalizedOrderStatus)) {
        throw new Error(getRoleSpecificCancellationError({ actorRole: role, orderData }));
    }

    return normalizedOrderStatus;
};

export const shouldNotifyPaymentBackendForStatus = (status) => status !== TRIP_STATUS.PENDING;

export const resolveCancellationActorId = ({ currentUser, orderData }) =>
    resolveCurrentUserId(currentUser) || resolveTripCustomerId(orderData);

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
                canCancel: true,
                fee: 0,
                reason: 'Free cancellation - driver has arrived, loading has not started',
                refundAmount: orderTotal,
                driverCompensation: 0,
            };

        case TRIP_STATUS.PICKED_UP:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - loading has started',
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

        case TRIP_STATUS.ARRIVED_AT_DROPOFF:
            return {
                canCancel: false,
                fee: 0,
                reason: 'Cannot cancel - driver has arrived at dropoff',
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
