import { colors } from '../../styles/theme';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';

export const ACTIVITY_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
});

export const formatDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

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

export const statusLabel = (status) => {
  if (status === ACTIVITY_STATUSES.SCHEDULED) {
    return 'Scheduled';
  }
  if (status === ACTIVITY_STATUSES.COMPLETED) {
    return 'Completed';
  }
  if (status === ACTIVITY_STATUSES.CANCELLED) {
    return 'Cancelled';
  }
  return 'Archived';
};

export const statusColor = (status) => {
  if (status === ACTIVITY_STATUSES.SCHEDULED) {
    return colors.primary;
  }
  if (status === ACTIVITY_STATUSES.COMPLETED) {
    return colors.success;
  }
  if (status === ACTIVITY_STATUSES.CANCELLED) {
    return colors.error;
  }
  return colors.text.tertiary;
};

const isFutureDate = (value) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > Date.now();
};

const resolveActivityStatus = (trip) => {
  const normalizedStatus = normalizeTripStatus(trip?.status);
  const scheduledTime = trip?.scheduledTime || trip?.scheduled_time || null;
  const isFutureScheduled = Boolean(scheduledTime) && isFutureDate(scheduledTime);

  if (
    isFutureScheduled &&
    (normalizedStatus === TRIP_STATUS.PENDING || normalizedStatus === TRIP_STATUS.ACCEPTED)
  ) {
    return ACTIVITY_STATUSES.SCHEDULED;
  }

  if (normalizedStatus === TRIP_STATUS.COMPLETED) {
    return ACTIVITY_STATUSES.COMPLETED;
  }

  if (normalizedStatus === TRIP_STATUS.CANCELLED) {
    return ACTIVITY_STATUSES.CANCELLED;
  }

  return ACTIVITY_STATUSES.ARCHIVED;
};

export const mapTripToActivityItem = (trip) => {
  const completedAt = trip.completedAt || trip.completed_at || null;
  const createdAt = trip.createdAt || trip.created_at || null;
  const scheduledTime = trip.scheduledTime || trip.scheduled_time || null;
  const activityStatus = resolveActivityStatus(trip);
  const timestamp = completedAt || createdAt || new Date().toISOString();
  const amountValue = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;

  return {
    id: trip.id,
    status: normalizeTripStatus(trip.status),
    activityStatus,
    scheduledTime,
    dateLabel: formatDate(timestamp),
    pickup: trip.pickup?.address || trip.pickupAddress || 'Unknown pickup',
    dropoff: trip.dropoff?.address || trip.dropoffAddress || 'Unknown drop-off',
    item: trip.item?.description || 'Package',
    driver: (trip.assignedDriverEmail || trip.driverEmail || 'Driver').split('@')[0],
    amount: formatCurrencyLabel(amountValue),
    timestamp,
    rawTrip: trip,
  };
};
