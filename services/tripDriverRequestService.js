import { logger } from './logger';
import {
  formatEdgeInvokeError,
  invokeDriverRequestPoolWithAuthRetry,
  normalizeRequestPool,
} from './tripDispatchUtils';
import { getAvailableRequestsForDriver } from './tripDriverAvailabilityService';
import { acceptRequestForDriver } from './tripDriverAcceptanceService';
import { normalizeError } from './errorService';

export const getAvailableRequests = async (currentUser, options = {}) => {
  try {
    return await getAvailableRequestsForDriver({ currentUser, options });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch available requests');
    logger.error('TripDriverRequestService', 'Error fetching available requests', normalized, error);
    throw new Error(normalized.message);
  }
};

export const declineRequestOffer = async (requestId, currentUser, options = {}) => {
  if (!currentUser) throw new Error('User not authenticated');

  const normalizedRequestId = String(requestId || '').trim();
  if (!normalizedRequestId) {
    throw new Error('Request ID is required');
  }

  const requestPool = normalizeRequestPool(options?.requestPool);

  try {
    const { data, error } = await invokeDriverRequestPoolWithAuthRetry({
      action: 'decline',
      tripId: normalizedRequestId,
      requestPool,
    });

    if (error) {
      throw new Error(formatEdgeInvokeError(error));
    }

    if (data?.error) {
      throw new Error(String(data.error));
    }

    return data || {};
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to decline request offer');
    logger.error('TripDriverRequestService', 'Error declining request offer', normalized, error);
    throw new Error(normalized.message);
  }
};

export const acceptRequest = async (requestId, currentUser) => {
  try {
    return await acceptRequestForDriver({ requestId, currentUser });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to accept request');
    logger.error('TripDriverRequestService', 'Error accepting request', normalized, error);
    throw new Error(normalized.message);
  }
};
