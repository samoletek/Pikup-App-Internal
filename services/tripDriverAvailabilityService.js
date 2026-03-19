import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { extractDriverPreferencesFromDriverProfile } from './driverPreferencesColumns';
import {
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
  fetchDriverMetadata,
  fetchPendingTrips,
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
    return edgeRequests;
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
  const customerMap = await buildCustomerMapForTrips(sortedTrips);

  return mapAvailableRequestsForDriver(sortedTrips, customerMap);
};
