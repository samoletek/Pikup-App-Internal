import { logger } from './logger';
import { normalizeError } from './errorService';

const INSURANCE_LOG_PREFIX = '[TripService]';

const getInsuranceBookingId = (trip) =>
    trip?.insurance?.bookingId || trip?.insurance_booking_id || null;

export const completeInsuranceBookingForTrip = async (trip) => {
    const bookingId = getInsuranceBookingId(trip);
    if (!bookingId) {
        return;
    }

    try {
        const RedkikService = (await import('./RedkikService')).default;
        const result = await RedkikService.completeBooking(bookingId);
        if (result?.success) {
            logger.info('TripInsurance', `${INSURANCE_LOG_PREFIX} Insurance booking completed`, { bookingId });
        } else {
            logger.warn('TripInsurance', `${INSURANCE_LOG_PREFIX} Insurance booking complete returned null`, {
                bookingId,
            });
        }
    } catch (error) {
        // Insurance completion must never block delivery finalization.
        const normalized = normalizeError(error, 'Failed to complete insurance booking');
        logger.warn('TripInsurance', `${INSURANCE_LOG_PREFIX} Failed to complete insurance booking`, normalized, error);
    }
};

export const cancelInsuranceBookingForTrip = async (trip) => {
    const bookingId = getInsuranceBookingId(trip);
    if (!bookingId) {
        return;
    }

    try {
        const RedkikService = (await import('./RedkikService')).default;
        const result = await RedkikService.cancelBooking(bookingId);
        if (result?.success) {
            logger.info('TripInsurance', `${INSURANCE_LOG_PREFIX} Insurance booking cancelled`, { bookingId });
        } else {
            logger.warn('TripInsurance', `${INSURANCE_LOG_PREFIX} Insurance booking cancel returned null`, {
                bookingId,
            });
        }
    } catch (error) {
        const normalized = normalizeError(error, 'Failed to cancel insurance booking');
        logger.warn('TripInsurance', `${INSURANCE_LOG_PREFIX} Failed to cancel insurance booking`, normalized, error);
    }
};
