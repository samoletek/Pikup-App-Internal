import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { extractDriverPreferencesFromDriverProfile } from './driverPreferencesColumns';
import {
  formatEdgeInvokeError,
  getAvailableRequestsFromEdge,
  hasValidCoordinatePair,
  isDriverRequestPoolAuthError,
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
  fetchDriverMetadata,
  fetchPendingTrips,
  fetchTripsByDriverAndStatuses,
} from './repositories/tripRepository';

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

const ACTIVE_DRIVER_STATUSES_FOR_SCHEDULE_CONFLICT = Object.freeze([
  'accepted',
  'in_progress',
  'arrived_at_pickup',
  'picked_up',
  'en_route_to_dropoff',
  'arrived_at_dropoff',
]);

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
    filteredBySearchLifetimeCount,
    filteredByTimeWindowCount,
    filteredByAssignedDriverCount,
    filteredByPreferenceCount,
    filteredByScheduleConflictCount,
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
    filteredBySearchLifetimeCount > 0 ||
    filteredByTimeWindowCount > 0 ||
    filteredByAssignedDriverCount > 0 ||
    filteredByScheduleConflictCount > 0 ||
    filteredByStateCount > 0 ||
    driverStateRestricted
  ) {
    logger.info('TripDriverAvailability', 'Filtered requests by dispatch windows', {
      filteredByPoolCount,
      filteredByDistanceCount,
      filteredBySearchLifetimeCount,
      filteredByTimeWindowCount,
      filteredByAssignedDriverCount,
      filteredByScheduleConflictCount,
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

export const getAvailableRequestsForDriver = async ({ currentUser, options = {} }) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const requestPool = normalizeRequestPool(options?.requestPool);
  const driverLocation = resolveDriverLocation(options?.driverLocation);

  try {
    const edgeResponse = await getAvailableRequestsFromEdge({
      requestPool,
      driverLocation,
    });
    const edgeRequests = Array.isArray(edgeResponse?.requests) ? edgeResponse.requests : [];
    const edgeMeta = edgeResponse?.meta;

    if (edgeMeta) {
      logger.info('TripDriverAvailability', 'Driver request pool edge summary', edgeMeta);
    }

    return edgeRequests;
  } catch (edgeError) {
    if (await isDriverRequestPoolAuthError(edgeError)) {
      throw new Error('Session expired. Please sign in again.');
    }

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
  const { data: activeDriverRows, error: activeDriverTripsError } = await fetchTripsByDriverAndStatuses({
    driverId,
    statuses: [...ACTIVE_DRIVER_STATUSES_FOR_SCHEDULE_CONFLICT],
    columns: '*',
  });

  if (activeDriverTripsError) {
    logger.warn(
      'TripDriverAvailability',
      'Unable to load active driver trips for schedule conflict filtering',
      activeDriverTripsError
    );
  }
  const driverActiveTrips = Array.isArray(activeDriverRows)
    ? activeDriverRows.map(mapTripFromDb)
    : [];

  const { hiddenReasonCounts, stats, sortedTrips } = filterTripsForAvailability({
    trips,
    requestPool,
    driverLocation,
    driverId,
    driverActiveTrips,
    mergedPreferences,
    driverStateCode,
    supportedStateCodes: SUPPORTED_ORDER_STATE_CODES,
  });

  logFilterStats({ mergedPreferences, hiddenReasonCounts, stats });
  const customerMap = await buildCustomerMapForTrips(sortedTrips);

  return mapAvailableRequestsForDriver(sortedTrips, customerMap);
};
