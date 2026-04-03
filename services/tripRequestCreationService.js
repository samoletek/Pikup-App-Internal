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

export const createPickupRequest = async (requestData, currentUser) => {
  if (!currentUser) throw new Error('User not authenticated');

  try {
    logger.info('TripRequestCreationService', 'Creating pickup request in Supabase');

    const pricingData = requestData.pricing || null;
    const createdAt = new Date().toISOString();
    const dispatchRequirements = buildDispatchRequirementsFromRequest({
      ...requestData,
      createdAt,
    });

    const tripData = {
      customer_id: currentUser.uid || currentUser.id,
      pickup_location: {
        ...requestData.pickup,
        details: {
          ...(requestData.pickupDetails || {}),
          dispatchRequirements,
        },
        pricing: pricingData,
        dispatchRequirements,
      },
      dropoff_location: {
        ...requestData.dropoff,
        details: requestData.dropoffDetails || {},
      },
      vehicle_type: requestData.vehicle?.type || 'Standard',
      price: parseFloat(requestData.pricing?.total || 0),
      distance_miles: parseFloat(requestData.pricing?.distance || 0),
      items: requestData.items || [],
      scheduled_time: requestData.scheduledTime || null,
      status: toDbTripStatus(TRIP_STATUS.PENDING),
      created_at: createdAt,
      insurance_quote_id: requestData.insurance?.quoteId || null,
      insurance_booking_id: requestData.insurance?.bookingId || null,
      insurance_premium: requestData.insurance?.premium != null
        ? parseFloat(requestData.insurance.premium)
        : null,
      insurance_status: requestData.insurance?.status || null,
      booking_payment_method_id: requestData.selectedPaymentMethodId || null,
    };

    if (requestData.insurance) {
      tripData.insurance_quote_id = requestData.insurance.quoteId || null;
      tripData.insurance_booking_id = requestData.insurance.bookingId || null;
      tripData.insurance_premium = requestData.insurance.premium != null
        ? parseFloat(requestData.insurance.premium)
        : null;
      tripData.insurance_status = requestData.insurance.status || null;
    }

    let { data, error } = await insertTripWithSelect(tripData);
    if (error && hasMissingColumnError(error, 'booking_payment_method_id')) {
      const fallbackTripData = { ...tripData };
      delete fallbackTripData.booking_payment_method_id;
      ({ data, error } = await insertTripWithSelect(fallbackTripData));
    }

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
