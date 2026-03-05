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
    customerId: trip.customerId || trip.customer_id || null,
    driverId: trip.driverId || trip.driver_id || null,
    assignedDriverId: trip.assignedDriverId || trip.driver_id || null,
    assignedDriverEmail:
      trip.assignedDriverEmail ||
      trip.assigned_driver_email ||
      trip.driverEmail ||
      trip.driver_email ||
      trip.driver?.email ||
      null,
    driverLocation: trip.driverLocation || toLocation(trip.driver_location),

    // Insurance data (mapped for CustomerClaimsScreen compatibility)
    insurance: {
      included: !!(trip.insurance_booking_id),
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
