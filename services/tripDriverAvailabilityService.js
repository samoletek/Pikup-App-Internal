import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { extractDriverPreferencesFromDriverProfile } from './driverPreferencesColumns';
import {
  findDriverScheduleConflictForTrip,
  formatEdgeInvokeError,
  getAvailableRequestsFromEdge,
  hasValidCoordinatePair,
  normalizeRequestPool,
} from './tripDispatchUtils';
import {
  buildCustomerMapFromRows,
  filterTripsForAvailability,
  getUniqueCustomerIdsFromTrips,
  mapAvailableRequestsForDriver,
} from './tripAvailabilityUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { SUPPORTED_ORDER_STATE_CODES } from '../constants/orderAvailability';
import { resolveLocationStateCode } from '../utils/locationState';
import {
  fetchCustomersByIds,
  fetchDriverRequestOffersByTripIds,
  fetchDriverMetadata,
  fetchPendingTrips,
  fetchTripsByDriverIdAndStatuses,
} from './repositories/tripRepository';

const DRIVER_SCHEDULE_CONFLICT_STATUSES = Object.freeze([
  toDbTripStatus(TRIP_STATUS.ACCEPTED),
  toDbTripStatus(TRIP_STATUS.IN_PROGRESS),
  toDbTripStatus(TRIP_STATUS.ARRIVED_AT_PICKUP),
  toDbTripStatus(TRIP_STATUS.PICKED_UP),
  toDbTripStatus(TRIP_STATUS.EN_ROUTE_TO_DROPOFF),
  toDbTripStatus(TRIP_STATUS.ARRIVED_AT_DROPOFF),
]);

const resolveDriverLocation = (rawLocation) => {
  if (!hasValidCoordinatePair(rawLocation)) {
    return null;
  }

  const stateCode = resolveLocationStateCode(rawLocation);

  return {
    latitude: Number(rawLocation.latitude),
    longitude: Number(rawLocation.longitude),
    stateCode: stateCode || null,
  };
};

const FINALIZED_OFFER_STATUSES = new Set(['declined', 'expired', 'accepted']);

const parseOfferExpiryMs = (value) => {
  if (!value) {
    return Number.NaN;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const loadDriverProfileData = async (driverId) => {
  if (!driverId) {
    return { mergedPreferences: null };
  }

  const { data: driverProfile, error } = await fetchDriverMetadata(driverId);

  if (error) {
    logger.warn('TripDriverAvailability', 'Unable to load driver preferences for request filtering', error);
    return { mergedPreferences: null };
  }

  return {
    mergedPreferences: extractDriverPreferencesFromDriverProfile(driverProfile),
  };
};

const logFilterStats = ({ mergedPreferences, hiddenReasonCounts, stats }) => {
  const {
    filteredByPoolCount,
    filteredByDistanceCount,
    filteredByTimeWindowCount,
    filteredByAssignedDriverCount,
    filteredByPreferenceCount,
    filteredByStateCount,
    driverStateRestricted,
  } = stats;

  if (mergedPreferences && filteredByPreferenceCount > 0) {
    logger.info(
      'TripDriverAvailability',
      `Filtered out ${filteredByPreferenceCount} requests by driver preferences`,
      hiddenReasonCounts
    );
  }

  if (
    filteredByPoolCount > 0 ||
    filteredByDistanceCount > 0 ||
    filteredByTimeWindowCount > 0 ||
    filteredByAssignedDriverCount > 0 ||
    filteredByStateCount > 0 ||
    driverStateRestricted
  ) {
    logger.info('TripDriverAvailability', 'Filtered requests by dispatch windows', {
      filteredByPoolCount,
      filteredByDistanceCount,
      filteredByTimeWindowCount,
      filteredByAssignedDriverCount,
      filteredByStateCount,
      driverStateRestricted,
    });
  }
};

const buildCustomerMapForTrips = async (sortedTrips) => {
  const customerIds = getUniqueCustomerIdsFromTrips(sortedTrips);
  if (customerIds.length === 0) {
    return {};
  }

  const { data: customers } = await fetchCustomersByIds(customerIds);

  return customers ? buildCustomerMapFromRows(customers) : {};
};

const resolveCustomerIdFromRequest = (request) => {
  return (
    request?.customerId ||
    request?.customer_id ||
    request?.customer?.id ||
    request?.customer?.uid ||
    request?.originalData?.customerId ||
    request?.originalData?.customer_id ||
    null
  );
};

const enrichRequestsWithCustomerProfiles = async (requests = []) => {
  const normalizedRequests = Array.isArray(requests) ? requests : [];
  if (normalizedRequests.length === 0) {
    return [];
  }

  const customerIds = Array.from(
    new Set(
      normalizedRequests
        .map((request) => String(resolveCustomerIdFromRequest(request) || '').trim())
        .filter(Boolean)
    )
  );

  if (customerIds.length === 0) {
    return normalizedRequests;
  }

  const { data: customers, error } = await fetchCustomersByIds(customerIds);
  if (error || !customers) {
    return normalizedRequests;
  }

  const customerMap = buildCustomerMapFromRows(customers);

  return normalizedRequests.map((request) => {
    const customerId = String(resolveCustomerIdFromRequest(request) || '').trim();
    const customer = customerMap[customerId];
    if (!customer) {
      return request;
    }

    const mergedRating =
      customer.rating ??
      request?.customerRating ??
      request?.customer?.rating ??
      null;
    const mergedAvatarUrl =
      customer.avatarUrl ||
      request?.customerAvatarUrl ||
      request?.customer?.photo ||
      null;

    return {
      ...request,
      customerName: customer.name || request?.customerName || 'Customer',
      customerEmail: customer.email || request?.customerEmail || null,
      customerRating: mergedRating,
      customerAvatarUrl: mergedAvatarUrl,
      customer: {
        ...(request?.customer || {}),
        id: request?.customer?.id || customerId || null,
        name: customer.name || request?.customer?.name || request?.customerName || 'Customer',
        email: customer.email || request?.customer?.email || request?.customerEmail || null,
        rating: mergedRating,
        photo: mergedAvatarUrl,
        profile_image_url: mergedAvatarUrl,
        avatar_url: mergedAvatarUrl,
      },
    };
  });
};

const filterTripsByDriverOfferLifecycle = async ({ trips, driverId }) => {
  const normalizedTrips = Array.isArray(trips) ? trips : [];
  if (!driverId || normalizedTrips.length === 0) {
    return normalizedTrips;
  }

  const tripIds = Array.from(
    new Set(
      normalizedTrips
        .map((trip) => String(trip?.id || '').trim())
        .filter(Boolean)
    )
  );

  if (tripIds.length === 0) {
    return normalizedTrips;
  }

  const { data: offerRows, error: offerRowsError } = await fetchDriverRequestOffersByTripIds({
    driverId,
    tripIds,
  });

  if (offerRowsError || !Array.isArray(offerRows)) {
    if (offerRowsError) {
      const normalized = normalizeError(offerRowsError, 'Failed to load request offer lifecycle');
      logger.warn(
        'TripDriverAvailability',
        'Unable to apply offer lifecycle fallback filtering',
        normalized
      );
    }
    return normalizedTrips;
  }

  const offerByTripId = new Map();
  offerRows.forEach((offerRow) => {
    const tripId = String(offerRow?.trip_id || '').trim();
    if (!tripId) {
      return;
    }
    offerByTripId.set(tripId, offerRow);
  });

  const nowMs = Date.now();
  return normalizedTrips.filter((trip) => {
    const tripId = String(trip?.id || '').trim();
    if (!tripId) {
      return false;
    }

    const offerRow = offerByTripId.get(tripId);
    if (!offerRow) {
      return true;
    }

    const offerStatus = String(offerRow?.status || '').trim().toLowerCase();
    if (FINALIZED_OFFER_STATUSES.has(offerStatus)) {
      return false;
    }

    if (offerStatus === 'offered') {
      const offerExpiresAtMs = parseOfferExpiryMs(offerRow?.expires_at);
      if (Number.isFinite(offerExpiresAtMs) && offerExpiresAtMs <= nowMs) {
        return false;
      }
    }

    return true;
  });
};

const filterTripsByDriverSchedule = ({ trips, assignedTrips, driverLocation }) => {
  const normalizedTrips = Array.isArray(trips) ? trips : [];
  const normalizedAssignedTrips = Array.isArray(assignedTrips) ? assignedTrips : [];
  if (normalizedTrips.length === 0 || normalizedAssignedTrips.length === 0) {
    return {
      trips: normalizedTrips,
      filteredByScheduleConflictCount: 0,
    };
  }

  const filteredTrips = normalizedTrips.filter((trip) => {
    const conflict = findDriverScheduleConflictForTrip({
      candidateTrip: trip,
      assignedTrips: normalizedAssignedTrips,
      driverLocation,
      nowDate: new Date(),
    });
    return !conflict;
  });

  return {
    trips: filteredTrips,
    filteredByScheduleConflictCount: normalizedTrips.length - filteredTrips.length,
  };
};

export const getAvailableRequestsForDriver = async ({ currentUser, options = {} }) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const requestPool = normalizeRequestPool(options?.requestPool);
  const driverLocation = resolveDriverLocation(options?.driverLocation);

  try {
    const edgeRequests = await getAvailableRequestsFromEdge({
      requestPool,
      driverLocation,
    });
    return await enrichRequestsWithCustomerProfiles(edgeRequests);
  } catch (edgeError) {
    const normalized = normalizeError(edgeError, 'Driver request pool edge function failed');
    logger.warn(
      'TripDriverAvailability',
      'get-driver-request-pool edge function failed, falling back to client-side filtering',
      normalized,
      formatEdgeInvokeError(edgeError)
    );
  }

  const { data, error } = await fetchPendingTrips(toDbTripStatus(TRIP_STATUS.PENDING));

  if (error) {
    throw error;
  }

  const trips = Array.isArray(data) ? data.map(mapTripFromDb) : [];
  const driverId = currentUser?.uid || currentUser?.id;
  const { mergedPreferences } = await loadDriverProfileData(driverId);
  const driverStateCode = resolveLocationStateCode(driverLocation);

  const { hiddenReasonCounts, stats, sortedTrips } = filterTripsForAvailability({
    trips,
    requestPool,
    driverLocation,
    driverId,
    mergedPreferences,
    driverStateCode,
    supportedStateCodes: SUPPORTED_ORDER_STATE_CODES,
  });

  logFilterStats({ mergedPreferences, hiddenReasonCounts, stats });
  const { data: assignedTripRows, error: assignedTripsError } = await fetchTripsByDriverIdAndStatuses({
    driverId,
    statuses: DRIVER_SCHEDULE_CONFLICT_STATUSES,
    columns: '*',
    ascending: false,
  });
  const assignedTripsForConflict = assignedTripsError
    ? []
    : (Array.isArray(assignedTripRows) ? assignedTripRows : []).map(mapTripFromDb);
  if (assignedTripsError) {
    const normalizedAssignedTripsError = normalizeError(
      assignedTripsError,
      'Failed to load assigned trips for schedule conflict filtering'
    );
    logger.warn(
      'TripDriverAvailability',
      'Unable to apply schedule conflict filtering in fallback path',
      normalizedAssignedTripsError
    );
  }

  const {
    trips: scheduleFilteredTrips,
    filteredByScheduleConflictCount,
  } = filterTripsByDriverSchedule({
    trips: sortedTrips,
    assignedTrips: assignedTripsForConflict,
    driverLocation,
  });
  if (filteredByScheduleConflictCount > 0) {
    logger.info('TripDriverAvailability', 'Filtered requests by driver schedule conflicts', {
      filteredByScheduleConflictCount,
    });
  }

  const lifecycleFilteredTrips = await filterTripsByDriverOfferLifecycle({
    trips: scheduleFilteredTrips,
    driverId,
  });
  if (lifecycleFilteredTrips.length !== scheduleFilteredTrips.length) {
    logger.info('TripDriverAvailability', 'Filtered requests by offer lifecycle in fallback path', {
      filteredByOfferLifecycleCount: scheduleFilteredTrips.length - lifecycleFilteredTrips.length,
    });
  }

  const customerMap = await buildCustomerMapForTrips(lifecycleFilteredTrips);

  return mapAvailableRequestsForDriver(lifecycleFilteredTrips, customerMap);
};
