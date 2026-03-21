import {
  ACTIVE_TRIP_STATUSES,
  TRIP_STATUS,
  normalizeTripStatus,
} from '../../constants/tripStatus';

export const ACTIVE_DELIVERY_POLL_INTERVAL_MS = 5000;
export const IDLE_DELIVERY_POLL_INTERVAL_MS = 30000;

export const toMapboxCoordinate = (location) => {
  const rawCoordinates = location?.coordinates || location;

  if (
    Array.isArray(rawCoordinates) &&
    rawCoordinates.length === 2 &&
    Number.isFinite(Number(rawCoordinates[0])) &&
    Number.isFinite(Number(rawCoordinates[1]))
  ) {
    return [Number(rawCoordinates[0]), Number(rawCoordinates[1])];
  }

  const longitude = Number(rawCoordinates?.longitude);
  const latitude = Number(rawCoordinates?.latitude);

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return [longitude, latitude];
  }

  return null;
};

export const formatSearchDuration = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const getBookingAddress = (booking, pointType) => {
  const addressKey = `${pointType}Address`;
  const point = booking?.[pointType];
  return (
    booking?.[addressKey] ||
    point?.address ||
    point?.formatted_address ||
    'Address unavailable'
  );
};

export const formatScheduleLabel = (scheduledTime) => {
  if (!scheduledTime) {
    return 'ASAP';
  }

  const parsedDate = new Date(scheduledTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Scheduled';
  }

  return parsedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const ACTIVE_DELIVERY_STEP_META = Object.freeze({
  [TRIP_STATUS.ACCEPTED]: {
    label: 'Delivery Confirmed',
    icon: 'checkmark-circle',
  },
  [TRIP_STATUS.IN_PROGRESS]: {
    label: 'On the way to you',
    icon: 'car-sport',
  },
  [TRIP_STATUS.ARRIVED_AT_PICKUP]: {
    label: 'Driver arrived',
    icon: 'location',
  },
  [TRIP_STATUS.PICKED_UP]: {
    label: 'Package collected',
    icon: 'cube',
  },
  [TRIP_STATUS.EN_ROUTE_TO_DROPOFF]: {
    label: 'On the way to destination',
    icon: 'navigate',
  },
  [TRIP_STATUS.ARRIVED_AT_DROPOFF]: {
    label: 'Arrived at destination',
    icon: 'home',
  },
  [TRIP_STATUS.COMPLETED]: {
    label: 'Delivered',
    icon: 'checkmark-circle',
  },
});

export const getTripId = (trip) => {
  const rawId = trip?.id || trip?.requestId || trip?.request_id || null;
  if (!rawId) {
    return null;
  }
  return String(rawId);
};

const getScheduledTimeMs = (trip) => {
  const scheduledTime = trip?.scheduledTime || trip?.scheduled_time || null;
  if (!scheduledTime) {
    return Number.NaN;
  }

  const parsedMs = new Date(scheduledTime).getTime();
  return Number.isFinite(parsedMs) ? parsedMs : Number.NaN;
};

const isFutureAcceptedScheduledTrip = (trip, nowMs) => {
  const normalizedStatus = normalizeTripStatus(trip?.status);
  if (normalizedStatus !== TRIP_STATUS.ACCEPTED) {
    return false;
  }

  const scheduledTimeMs = getScheduledTimeMs(trip);
  return Number.isFinite(scheduledTimeMs) && scheduledTimeMs > nowMs;
};

export const pickCustomerTrips = ({ requests, currentUserId }) => {
  if (!Array.isArray(requests) || !currentUserId) {
    return {
      activeDelivery: null,
      pendingBooking: null,
    };
  }

  const customerRequests = requests.filter((request) => {
    const requestCustomerId = request?.customerId || request?.customer_id;
    return requestCustomerId === currentUserId;
  });

  const nowMs = Date.now();
  const activeRequest = customerRequests.find((request) => {
    const normalizedStatus = normalizeTripStatus(request.status);
    if (!ACTIVE_TRIP_STATUSES.includes(normalizedStatus)) {
      return false;
    }

    return !isFutureAcceptedScheduledTrip(request, nowMs);
  });
  const pendingRequest = customerRequests.find(
    (request) => normalizeTripStatus(request.status) === TRIP_STATUS.PENDING
  );

  return {
    activeDelivery: activeRequest || null,
    pendingBooking: activeRequest ? null : pendingRequest || null,
  };
};
