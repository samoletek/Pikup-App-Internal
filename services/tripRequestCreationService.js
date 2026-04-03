import { TRIP_STATUS, toDbTripStatus } from '../constants/tripStatus';
import { mapTripFromDb } from './tripMapper';
import { buildDispatchRequirementsFromRequest } from './DispatchMatchingService';
import { logger } from './logger';
import { normalizeError } from './errorService';
import {
  fetchTripsByParticipantId,
  insertTripWithSelect,
} from './repositories/tripRepository';

const hasMissingColumnError = (error, columnName) => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('column') &&
    message.includes('does not exist') &&
    message.includes(String(columnName || '').toLowerCase())
  );
};

const OPTIONAL_TRIP_INSERT_COLUMNS = Object.freeze([
  'booking_payment_method_id',
  'duration_minutes',
]);

const toPositiveInteger = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.round(parsedValue);
};

const resolveDurationMinutes = (requestData = {}, pricingData = null) => {
  const candidates = [
    requestData?.durationMinutes,
    requestData?.duration_minutes,
    requestData?.duration,
    pricingData?.durationMinutes,
    pricingData?.duration_minutes,
    pricingData?.duration,
    requestData?.pickupDetails?.estimatedDurationMinutes,
  ];

  for (const candidate of candidates) {
    const parsedValue = toPositiveInteger(candidate);
    if (parsedValue !== null) {
      return parsedValue;
    }
  }

  return null;
};

const insertTripWithOptionalColumnFallback = async (tripData) => {
  const payload = { ...tripData };
  let result = await insertTripWithSelect(payload);

  while (result.error) {
    const missingOptionalColumn = OPTIONAL_TRIP_INSERT_COLUMNS.find((columnName) => (
      Object.prototype.hasOwnProperty.call(payload, columnName) &&
      hasMissingColumnError(result.error, columnName)
    ));

    if (!missingOptionalColumn) {
      break;
    }

    delete payload[missingOptionalColumn];
    result = await insertTripWithSelect(payload);
  }

  return result;
};

export const createPickupRequest = async (requestData, currentUser) => {
  if (!currentUser) throw new Error('User not authenticated');

  try {
    logger.info('TripRequestCreationService', 'Creating pickup request in Supabase');

    const pricingData = requestData.pricing ? { ...requestData.pricing } : null;
    const durationMinutes = resolveDurationMinutes(requestData, pricingData);
    if (pricingData && durationMinutes !== null) {
      pricingData.duration = toPositiveInteger(pricingData.duration) ?? durationMinutes;
      pricingData.durationMinutes = toPositiveInteger(pricingData.durationMinutes) ?? durationMinutes;
    }

    const createdAt = new Date().toISOString();
    const normalizedRequestData = {
      ...requestData,
      pricing: pricingData,
      ...(durationMinutes !== null ? { duration: durationMinutes } : {}),
    };
    const dispatchRequirements = buildDispatchRequirementsFromRequest({
      ...normalizedRequestData,
      createdAt,
    });

    const tripData = {
      customer_id: currentUser.uid || currentUser.id,
      pickup_location: {
        ...normalizedRequestData.pickup,
        details: {
          ...(normalizedRequestData.pickupDetails || {}),
          dispatchRequirements,
        },
        pricing: pricingData,
        dispatchRequirements,
      },
      dropoff_location: {
        ...normalizedRequestData.dropoff,
        details: normalizedRequestData.dropoffDetails || {},
      },
      vehicle_type: normalizedRequestData.vehicle?.type || 'Standard',
      price: parseFloat(normalizedRequestData.pricing?.total || 0),
      distance_miles: parseFloat(normalizedRequestData.pricing?.distance || 0),
      items: normalizedRequestData.items || [],
      scheduled_time: normalizedRequestData.scheduledTime || null,
      status: toDbTripStatus(TRIP_STATUS.PENDING),
      created_at: createdAt,
      insurance_quote_id: normalizedRequestData.insurance?.quoteId || null,
      insurance_booking_id: normalizedRequestData.insurance?.bookingId || null,
      insurance_premium: normalizedRequestData.insurance?.premium != null
        ? parseFloat(normalizedRequestData.insurance.premium)
        : null,
      insurance_status: normalizedRequestData.insurance?.status || null,
      booking_payment_method_id: normalizedRequestData.selectedPaymentMethodId || null,
      ...(durationMinutes !== null ? { duration_minutes: durationMinutes } : {}),
    };

    if (normalizedRequestData.insurance) {
      tripData.insurance_quote_id = normalizedRequestData.insurance.quoteId || null;
      tripData.insurance_booking_id = normalizedRequestData.insurance.bookingId || null;
      tripData.insurance_premium = normalizedRequestData.insurance.premium != null
        ? parseFloat(normalizedRequestData.insurance.premium)
        : null;
      tripData.insurance_status = normalizedRequestData.insurance.status || null;
    }

    const { data, error } = await insertTripWithOptionalColumnFallback(tripData);

    if (error) {
      throw error;
    }
    logger.info('TripRequestCreationService', 'Trip created successfully', { tripId: data.id });

    return mapTripFromDb(data);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to create pickup request');
    logger.error('TripRequestCreationService', 'Error creating pickup request', normalized, error);
    throw new Error(normalized.message);
  }
};

export const getUserPickupRequests = async (currentUser) => {
  if (!currentUser) throw new Error('User not authenticated');
  const userId = currentUser.id || currentUser.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    const { data, error } = await fetchTripsByParticipantId(userId);

    if (error) throw error;

    return (Array.isArray(data) ? data : []).map(mapTripFromDb);
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch pickup requests');
    logger.error('TripRequestCreationService', 'Error fetching pickup requests', normalized, error);
    throw new Error(normalized.message);
  }
};
