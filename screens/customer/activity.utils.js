import { colors } from '../../styles/theme';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';

export const ACTIVITY_FILTER = Object.freeze({
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  ARCHIVE: 'archive',
});

export const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 0) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} min ago`;
  }
  if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)} hr ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatCurrencyLabel = (amount) => {
  const normalizedAmount = Number(amount) || 0;
  return `$${normalizedAmount.toFixed(2)}`;
};

export const statusLabel = (status, options = {}) => {
  const normalizedStatus = normalizeTripStatus(status);
  const isScheduled =
    Boolean(options?.scheduledTime) &&
    (normalizedStatus === TRIP_STATUS.PENDING || normalizedStatus === TRIP_STATUS.ACCEPTED);
  if (isScheduled) {
    return 'Scheduled';
  }
  switch (normalizedStatus) {
    case TRIP_STATUS.COMPLETED:
      return 'Completed';
    case TRIP_STATUS.CANCELLED:
      return 'Cancelled';
    case TRIP_STATUS.PENDING:
      return 'Pending';
    case TRIP_STATUS.ACCEPTED:
      return 'Accepted';
    case TRIP_STATUS.IN_PROGRESS:
      return 'In progress';
    case TRIP_STATUS.ARRIVED_AT_PICKUP:
      return 'Driver arrived';
    case TRIP_STATUS.PICKED_UP:
      return 'Picked up';
    case TRIP_STATUS.EN_ROUTE_TO_DROPOFF:
      return 'On the way';
    case TRIP_STATUS.ARRIVED_AT_DROPOFF:
      return 'Arrived at drop-off';
    default:
      return 'Trip';
  }
};

export const statusColor = (status, options = {}) => {
  const normalizedStatus = normalizeTripStatus(status);
  const isScheduled =
    Boolean(options?.scheduledTime) &&
    (normalizedStatus === TRIP_STATUS.PENDING || normalizedStatus === TRIP_STATUS.ACCEPTED);
  if (isScheduled) {
    return colors.primary;
  }
  switch (normalizedStatus) {
    case TRIP_STATUS.COMPLETED:
      return colors.success;
    case TRIP_STATUS.CANCELLED:
      return colors.error;
    case TRIP_STATUS.PENDING:
      return colors.warning;
    case TRIP_STATUS.ACCEPTED:
    case TRIP_STATUS.IN_PROGRESS:
    case TRIP_STATUS.ARRIVED_AT_PICKUP:
    case TRIP_STATUS.PICKED_UP:
    case TRIP_STATUS.EN_ROUTE_TO_DROPOFF:
    case TRIP_STATUS.ARRIVED_AT_DROPOFF:
      return colors.primary;
    default:
      return colors.text.tertiary;
  }
};

export const isArchivedActivityTrip = (tripLike) => {
  const status = normalizeTripStatus(tripLike?.status);
  return status === TRIP_STATUS.COMPLETED || status === TRIP_STATUS.CANCELLED;
};

export const isScheduledActivityTrip = (tripLike) =>
  !isArchivedActivityTrip(tripLike) && Boolean(tripLike?.scheduledTime);

export const isActiveActivityTrip = (tripLike) =>
  !isArchivedActivityTrip(tripLike) && !isScheduledActivityTrip(tripLike);

export const matchActivityTripByFilter = (tripLike, filter) => {
  if (filter === ACTIVITY_FILTER.ACTIVE) {
    return isActiveActivityTrip(tripLike);
  }
  if (filter === ACTIVITY_FILTER.SCHEDULED) {
    return isScheduledActivityTrip(tripLike);
  }
  if (filter === ACTIVITY_FILTER.ARCHIVE) {
    return isArchivedActivityTrip(tripLike);
  }
  return false;
};

export const mapTripToActivityItem = (trip) => {
  const scheduledTime = trip.scheduledTime || trip.scheduled_time || null;
  const completedAt = trip.completedAt || trip.completed_at || null;
  const createdAt = trip.createdAt || trip.created_at || null;
  const timestamp = scheduledTime || completedAt || createdAt || new Date().toISOString();
  const amountValue = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;
  const firstItem = Array.isArray(trip.items) ? trip.items[0] : null;
  const assignedDriverName =
    trip.assignedDriverName ||
    trip.driverName ||
    [trip.assignedDriverFirstName, trip.assignedDriverLastName].filter(Boolean).join(' ') ||
    trip.assignedDriver?.name ||
    '';
  const assignedDriverEmail = trip.assignedDriverEmail || trip.driverEmail || '';
  const driverLabelFromEmail = assignedDriverEmail.split('@')[0];

  return {
    id: trip.id,
    status: normalizeTripStatus(trip.status),
    dateLabel: formatDate(timestamp),
    pickup: trip.pickup?.address || trip.pickupAddress || 'Unknown pickup',
    dropoff: trip.dropoff?.address || trip.dropoffAddress || 'Unknown drop-off',
    item: trip.item?.description || firstItem?.description || 'Package',
    driver: assignedDriverName || driverLabelFromEmail || 'Driver',
    amount: formatCurrencyLabel(amountValue),
    scheduledTime,
    timestamp,
    rawTrip: trip,
  };
};
