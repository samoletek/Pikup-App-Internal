import { createConversation } from './MessagingService';
import { TRIP_STATUS, normalizeTripStatus, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { isMissingRpcFunctionError } from './tripErrorUtils';
import {
  createRequestUnavailableError,
  invokeAcceptTripRequestRpc,
} from './tripPersistenceUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { fetchProfileByTableAndUserId } from './repositories/authRepository';
import {
  acceptPendingTripForDriver,
  fetchTripColumnsByIdMaybeSingle,
} from './repositories/tripRepository';

const fetchTripById = async (requestId) => {
  const { data, error } = await fetchTripColumnsByIdMaybeSingle(requestId, '*');

  if (error) {
    throw error;
  }

  return data || null;
};

const validateRequestCanBeAccepted = ({ requestSnapshot, driverId }) => {
  const normalizedStatus = normalizeTripStatus(requestSnapshot.status);

  if (normalizedStatus === TRIP_STATUS.ACCEPTED && requestSnapshot.driver_id === driverId) {
    return { alreadyAcceptedByDriver: true };
  }

  if (normalizedStatus !== TRIP_STATUS.PENDING) {
    throw createRequestUnavailableError('Request is no longer pending');
  }

  if (requestSnapshot.driver_id && requestSnapshot.driver_id !== driverId) {
    throw createRequestUnavailableError('Request already accepted by another driver');
  }

  return { alreadyAcceptedByDriver: false };
};

const tryAcceptRequestWithRpc = async ({ requestId, driverId }) => {
  const { data, error, usedSignature } = await invokeAcceptTripRequestRpc({
    requestId,
    driverId,
  });

  if (error) {
    if (isMissingRpcFunctionError(error, 'accept_trip_request')) {
      logger.warn(
        'TripDriverAcceptance',
        'accept_trip_request RPC is missing. Falling back to direct trips update.'
      );
      return { acceptedRequest: null, rpcAccepted: false };
    }
    throw error;
  }

  if (usedSignature === 'two_arg') {
    logger.info('TripDriverAcceptance', 'accept_trip_request RPC used legacy 2-arg signature');
  }

  const acceptedRequest = Array.isArray(data) && data.length > 0 ? data[0] : null;
  return { acceptedRequest, rpcAccepted: true };
};

const acceptRequestWithDirectUpdate = async ({ requestId, driverId, requestSnapshot }) => {
  const acceptedStatus = toDbTripStatus(TRIP_STATUS.ACCEPTED);
  const updates = {
    status: acceptedStatus,
    driver_id: driverId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await acceptPendingTripForDriver({
    requestId,
    driverId,
    pendingStatus: toDbTripStatus(TRIP_STATUS.PENDING),
    acceptedStatus,
    updatedAt: updates.updated_at,
  });

  if (error) {
    throw error;
  }

  const refetchedRequest = await fetchTripById(requestId);
  if (refetchedRequest) {
    return refetchedRequest;
  }

  return {
    ...requestSnapshot,
    ...updates,
  };
};

const resolveCustomerIdFromRequest = ({ requestSnapshot, acceptedRequest }) => {
  return (
    requestSnapshot?.customer_id ||
    acceptedRequest?.customer_id ||
    acceptedRequest?.customerId ||
    null
  );
};

const resolveProfileName = (profile, fallback) => {
  if (!profile) {
    return fallback;
  }

  const firstName = String(profile.first_name || '').trim();
  if (firstName) {
    return firstName;
  }

  const email = String(profile.email || '').trim();
  if (email.includes('@')) {
    return email.split('@')[0];
  }

  return fallback;
};

const ensureConversationForAcceptedRequest = async ({
  requestId,
  requestSnapshot,
  acceptedRequest,
  driverId,
}) => {
  try {
    const customerId = resolveCustomerIdFromRequest({ requestSnapshot, acceptedRequest });
    if (!customerId) {
      logger.warn(
        'TripDriverAcceptance',
        'Skipping conversation creation: missing customer id',
        { requestId }
      );
      return;
    }

    const [{ data: customerProfile }, { data: driverProfile }] = await Promise.all([
      fetchProfileByTableAndUserId('customers', customerId, {
        columns: 'first_name, last_name, email',
        maybeSingle: true,
      }),
      fetchProfileByTableAndUserId('drivers', driverId, {
        columns: 'first_name, last_name, email',
        maybeSingle: true,
      }),
    ]);

    const customerName = resolveProfileName(customerProfile, 'Customer');
    const driverName = resolveProfileName(driverProfile, 'Driver');

    await createConversation(requestId, customerId, driverId, customerName, driverName);
    logger.info('TripDriverAcceptance', 'Conversation created for accepted request', { requestId });
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to create conversation for accepted request');
    logger.error('TripDriverAcceptance', 'Error creating conversation', normalized, error);
  }
};

const ensureAcceptedByDriver = ({ acceptedRequest, driverId }) => {
  if (
    normalizeTripStatus(acceptedRequest?.status) !== TRIP_STATUS.ACCEPTED ||
    acceptedRequest?.driver_id !== driverId
  ) {
    throw new Error(
      'Request acceptance was not persisted. Please apply the latest Supabase migration and try again.'
    );
  }
};

export const acceptRequestForDriver = async ({ requestId, currentUser }) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const driverId = currentUser.uid || currentUser.id;
  const requestSnapshot = await fetchTripById(requestId);
  if (!requestSnapshot) {
    throw createRequestUnavailableError('Request is no longer available');
  }

  const { alreadyAcceptedByDriver } = validateRequestCanBeAccepted({
    requestSnapshot,
    driverId,
  });

  if (alreadyAcceptedByDriver) {
    return mapTripFromDb(requestSnapshot);
  }

  let acceptedRequest = null;
  let rpcAccepted = false;

  const rpcResult = await tryAcceptRequestWithRpc({ requestId, driverId });
  acceptedRequest = rpcResult.acceptedRequest;
  rpcAccepted = rpcResult.rpcAccepted;

  if (!acceptedRequest && rpcAccepted) {
    const latestTrip = await fetchTripById(requestId);
    if (!latestTrip) {
      throw createRequestUnavailableError('Request is no longer available');
    }

    const latestStatus = normalizeTripStatus(latestTrip.status);
    if (latestStatus === TRIP_STATUS.ACCEPTED && latestTrip.driver_id === driverId) {
      acceptedRequest = latestTrip;
    } else {
      throw createRequestUnavailableError('Request is no longer pending');
    }
  }

  if (!acceptedRequest && !rpcAccepted) {
    acceptedRequest = await acceptRequestWithDirectUpdate({
      requestId,
      driverId,
      requestSnapshot,
    });
  }

  ensureAcceptedByDriver({ acceptedRequest, driverId });
  logger.info('TripDriverAcceptance', 'Request accepted successfully', { requestId });

  await ensureConversationForAcceptedRequest({
    requestId,
    requestSnapshot,
    acceptedRequest,
    driverId,
  });

  return mapTripFromDb(acceptedRequest);
};
