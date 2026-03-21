import { normalizeTripStatus } from '../constants/tripStatus';
import {
  resolveCustomerDisplayFromRequest,
  resolveDriverDisplayFromRequest,
} from '../utils/profileDisplay';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const toPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
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
  const customerDisplay = resolveCustomerDisplayFromRequest(trip, {
    fallbackName: 'Customer',
  });
  const driverDisplay = resolveDriverDisplayFromRequest(trip, {
    fallbackName: 'Driver',
  });

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
    customerName: customerDisplay.name,
    customerEmail:
      trip.customerEmail ||
      trip.customer_email ||
      trip.customer?.email ||
      null,
    customerAvatarUrl: customerDisplay.avatarUrl,
    customerInitials: customerDisplay.initials,
    customer: {
      ...toPlainObject(trip.customer),
      id: trip.customerId || trip.customer_id || trip.customer?.id || null,
      name: customerDisplay.name,
      email:
        trip.customerEmail ||
        trip.customer_email ||
        trip.customer?.email ||
        null,
      profileImageUrl: customerDisplay.avatarUrl,
      profile_image_url: customerDisplay.avatarUrl,
      photo: customerDisplay.avatarUrl,
      initials: customerDisplay.initials,
    },
    assignedDriverId: trip.assignedDriverId || trip.driver_id || null,
    assignedDriverName: driverDisplay.name,
    assignedDriverEmail:
      trip.assignedDriverEmail ||
      trip.assigned_driver_email ||
      trip.driverEmail ||
      trip.driver_email ||
      trip.driver?.email ||
      null,
    assignedDriverAvatarUrl: driverDisplay.avatarUrl,
    driverName: driverDisplay.name,
    driverAvatarUrl: driverDisplay.avatarUrl,
    driverInitials: driverDisplay.initials,
    driver: {
      ...toPlainObject(trip.driver),
      id: trip.driverId || trip.driver_id || trip.driver?.id || null,
      name: driverDisplay.name,
      email:
        trip.assignedDriverEmail ||
        trip.assigned_driver_email ||
        trip.driverEmail ||
        trip.driver_email ||
        trip.driver?.email ||
        null,
      profileImageUrl: driverDisplay.avatarUrl,
      profile_image_url: driverDisplay.avatarUrl,
      photo: driverDisplay.avatarUrl,
      initials: driverDisplay.initials,
    },
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
