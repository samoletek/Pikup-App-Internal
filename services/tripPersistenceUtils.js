import {
    getAlternateTripStatusFormat,
    getMissingColumnFromError,
    isMissingRpcFunctionError,
    isNetworkRequestFailure,
    isTripStatusConstraintError,
} from "./tripErrorUtils";
import { logger } from "./logger";
import {
    fetchTripColumnsByIdMaybeSingle,
    invokeTripRpc,
    updateTripById,
} from "./repositories/tripRepository";

const TRIP_UPDATE_MAX_RETRIES = 3;
const DEFAULT_TRIP_FETCH_MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchTripByIdWithRetry = async (requestId, maxAttempts = DEFAULT_TRIP_FETCH_MAX_RETRIES) => {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data, error } = await fetchTripColumnsByIdMaybeSingle(requestId, "*");

        if (!error) {
            return { data, error: null };
        }

        lastError = error;
        if (attempt < maxAttempts && isNetworkRequestFailure(error)) {
            await sleep(250 * attempt);
            continue;
        }

        return { data: null, error };
    }

    return { data: null, error: lastError };
};

const buildAcceptTripIdempotencyKey = ({ requestId, driverId }) => (
    `accept_trip_request:${requestId}:${driverId}`
);

export const invokeAcceptTripRequestRpc = async ({ requestId, driverId }) => {
    const rpcName = "accept_trip_request";
    const idempotencyKey = buildAcceptTripIdempotencyKey({ requestId, driverId });
    const primaryPayload = {
        p_trip_id: requestId,
        p_driver_id: driverId,
        p_idempotency_key: idempotencyKey,
    };

    const primaryResult = await invokeTripRpc(rpcName, primaryPayload);
    if (!primaryResult.error) {
        return { ...primaryResult, usedSignature: "three_arg" };
    }

    if (!isMissingRpcFunctionError(primaryResult.error, rpcName)) {
        return { ...primaryResult, usedSignature: "three_arg" };
    }

    const fallbackPayload = {
        p_trip_id: requestId,
        p_driver_id: driverId,
    };
    const fallbackResult = await invokeTripRpc(rpcName, fallbackPayload);

    return { ...fallbackResult, usedSignature: "two_arg" };
};

export const REQUEST_UNAVAILABLE_ERROR_CODE = "REQUEST_UNAVAILABLE";

export const createRequestUnavailableError = (message = "Request is no longer available") => {
    const error = new Error(message);
    error.code = REQUEST_UNAVAILABLE_ERROR_CODE;
    return error;
};

export const applyTripUpdateWithColumnFallback = async (requestId, rawUpdates = {}) => {
    const updates = { ...rawUpdates };
    const attemptedStatuses = new Set();
    let networkAttempts = 0;

    while (Object.keys(updates).length > 0) {
        if (typeof updates.status === "string" && updates.status) {
            attemptedStatuses.add(updates.status);
        }

        const { error } = await updateTripById(requestId, updates);

        if (!error) {
            return updates;
        }

        if (isNetworkRequestFailure(error) && networkAttempts < TRIP_UPDATE_MAX_RETRIES - 1) {
            networkAttempts += 1;
            logger.warn(
                "TripPersistence",
                `Retrying trip update (${networkAttempts}/${TRIP_UPDATE_MAX_RETRIES}) for request ${requestId}:`,
                error?.message || error
            );
            await sleep(300 * networkAttempts);
            continue;
        }

        const missingColumn = getMissingColumnFromError(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
            logger.warn("TripPersistence", `Trips table is missing "${missingColumn}". Retrying without it.`);
            delete updates[missingColumn];
            continue;
        }

        if (isTripStatusConstraintError(error) && typeof updates.status === "string") {
            const alternateStatus = getAlternateTripStatusFormat(updates.status);
            if (alternateStatus && !attemptedStatuses.has(alternateStatus)) {
                logger.warn(
                    "TripPersistence",
                    `Trips status constraint rejected "${updates.status}". Retrying with "${alternateStatus}".`
                );
                updates.status = alternateStatus;
                continue;
            }
        }

        throw error;
    }

    return {};
};
