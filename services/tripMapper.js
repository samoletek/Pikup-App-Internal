import { normalizeTripStatus } from '../constants/tripStatus';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const toLocation = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  return null;
};

const getAddress = (location, fallback = '') => {
  if (!location) return fallback;
  return location.address || location.formatted_address || fallback;
};

export const mapTripFromDb = (trip) => {
  if (!trip) return null;

  const pickup = toLocation(trip.pickup_location || trip.pickup);
  const dropoff = toLocation(trip.dropoff_location || trip.dropoff);
  const status = normalizeTripStatus(trip.status);
  const pickupPhotos = toArray(trip.pickup_photos || trip.pickupPhotos);
  const dropoffPhotos = toArray(trip.dropoff_photos || trip.dropoffPhotos);
  const pricing = trip.pricing || pickup?.pricing || {
    total: toNumber(trip.price),
    distance: toNumber(trip.distance_miles)
  };
  const dispatchRequirements =
    trip.dispatchRequirements ||
    trip.dispatch_requirements ||
    pickup?.dispatchRequirements ||
    pickup?.details?.dispatchRequirements ||
    null;

  return {
    ...trip,
    id: trip.id,
    status,
    statusRaw: trip.status,
    createdAt: trip.created_at || trip.createdAt || null,
    updatedAt: trip.updated_at || trip.updatedAt || null,
    acceptedAt: trip.accepted_at || trip.acceptedAt || null,
    pickup,
    dropoff,
    pickupAddress: trip.pickupAddress || getAddress(pickup),
    dropoffAddress: trip.dropoffAddress || getAddress(dropoff),
    pickupPhotos,
    dropoffPhotos,
    pricing,
    dispatchRequirements,
    scheduledTime: trip.scheduledTime || trip.scheduled_time || null,
    items: toArray(trip.items),
    item: trip.item || (Array.isArray(trip.items) && trip.items.length > 0 ? trip.items[0] : null),
    vehicleType: trip.vehicleType || trip.vehicle_type || trip.vehicle?.type || null,
    vehiclePlate: trip.vehiclePlate || trip.vehicle_plate || null,
    vehicle: trip.vehicle || { type: trip.vehicleType || trip.vehicle_type || null },
    photos: pickupPhotos,
    driverCheckinStatus:
      trip.driverCheckinStatus ||
      trip.driver_checkin_status ||
      null,
    driverCheckinRequiredAt:
      trip.driverCheckinRequiredAt ||
      trip.driver_checkin_required_at ||
      null,
    driverCheckinDeadlineAt:
      trip.driverCheckinDeadlineAt ||
      trip.driver_checkin_deadline_at ||
      null,
    driverCheckinConfirmedAt:
      trip.driverCheckinConfirmedAt ||
      trip.driver_checkin_confirmed_at ||
      null,
    driverCheckinDeclinedAt:
      trip.driverCheckinDeclinedAt ||
      trip.driver_checkin_declined_at ||
      null,
    customerId:
      trip.customerId ||
      trip.customer_id ||
      trip.userId ||
      trip.user_id ||
      trip.requesterId ||
      trip.requester_id ||
      trip.customer?.id ||
      trip.customer?.uid ||
      null,
    driverId:
      trip.driverId ||
      trip.driver_id ||
      trip.assignedDriverId ||
      trip.assigned_driver_id ||
      trip.assignedDriver?.id ||
      trip.assignedDriver?.uid ||
      trip.driver?.id ||
      trip.driver?.uid ||
      null,
    assignedDriverId:
      trip.assignedDriverId ||
      trip.assigned_driver_id ||
      trip.driverId ||
      trip.driver_id ||
      trip.assignedDriver?.id ||
      trip.assignedDriver?.uid ||
      trip.driver?.id ||
      trip.driver?.uid ||
      null,
    assignedDriverEmail:
      trip.assignedDriverEmail ||
      trip.assigned_driver_email ||
      trip.driverEmail ||
      trip.driver_email ||
      trip.assignedDriver?.email ||
      trip.driver?.email ||
      null,
    driverLocation: trip.driverLocation || toLocation(trip.driver_location),

    // Insurance data (mapped for CustomerClaimsScreen compatibility)
    insurance: {
      included: !!(trip.insurance_booking_id) || trip.insurance_status === 'purchased',
      purchaseFailed: trip.insurance_status === 'purchase_failed',
      bookingId: trip.insurance_booking_id || null,
      quoteId: trip.insurance_quote_id || null,
      premium: trip.insurance_premium != null ? toNumber(trip.insurance_premium) : null,
      status: trip.insurance_status || null,
    },
    itemValue: toArray(trip.items).reduce(
      (sum, item) => sum + (Number(item.value) || 0),
      0
    ) || null,
  };
};
