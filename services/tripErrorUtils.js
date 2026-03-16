import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';

const NETWORK_RETRY_PATTERNS = Object.freeze([
    'network request failed',
    'failed to fetch',
    'network error',
    'load failed'
]);

const STATUS_FLOW = Object.freeze([
    TRIP_STATUS.PENDING,
    TRIP_STATUS.ACCEPTED,
    TRIP_STATUS.IN_PROGRESS,
    TRIP_STATUS.ARRIVED_AT_PICKUP,
    TRIP_STATUS.PICKED_UP,
    TRIP_STATUS.EN_ROUTE_TO_DROPOFF,
    TRIP_STATUS.ARRIVED_AT_DROPOFF,
    TRIP_STATUS.COMPLETED
]);

export const isNetworkRequestFailure = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();

    return NETWORK_RETRY_PATTERNS.some((pattern) => message.includes(pattern) || details.includes(pattern));
};

export const hasReachedOrPassedStatus = (currentStatus, targetStatus) => {
    const current = normalizeTripStatus(currentStatus);
    const target = normalizeTripStatus(targetStatus);

    if (current === target) {
        return true;
    }

    const currentIndex = STATUS_FLOW.indexOf(current);
    const targetIndex = STATUS_FLOW.indexOf(target);

    if (currentIndex === -1 || targetIndex === -1) {
        return false;
    }

    return currentIndex >= targetIndex;
};

export const isMissingColumnError = (error, columnName) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const target = String(columnName || '').toLowerCase();
    return (
        (message.includes('does not exist') || details.includes('does not exist')) &&
        (message.includes(target) || details.includes(target))
    );
};

export const isTripStatusConstraintError = (error) => {
    if (error?.code !== '23514') return false;
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    return message.includes('trips_status_check') || details.includes('trips_status_check');
};

export const getAlternateTripStatusFormat = (status) => {
    if (typeof status !== 'string' || !status.trim()) return null;

    const normalizedStatus = normalizeTripStatus(status);
    const dbStatus = toDbTripStatus(normalizedStatus);

    // If we already send DB-format status, fallback to app-normalized format.
    if (status === dbStatus) {
        return normalizedStatus;
    }

    // If we send app format, fallback to DB-format status.
    if (status === normalizedStatus) {
        return dbStatus;
    }

    // Best effort fallback for unknown variants.
    return status.includes('_') ? normalizedStatus : dbStatus;
};

export const getMissingColumnFromError = (error) => {
    const message = String(error?.message || '');
    let match = message.match(/Could not find the '([^']+)' column/i);
    if (match?.[1]) return match[1];

    match = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i);
    if (match?.[1]) {
        return match[1].split('.').pop();
    }

    return null;
};

export const isMissingRpcFunctionError = (error, functionName) => {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const target = String(functionName || '').toLowerCase();
    const mentionsTarget = !target || message.includes(target) || details.includes(target);
    return (
        mentionsTarget &&
        (
            error?.code === 'PGRST202' ||
            message.includes('could not find the function') ||
            details.includes('could not find the function')
        )
    );
};
