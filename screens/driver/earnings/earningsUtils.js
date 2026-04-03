import { TRIP_STATUS } from '../../../constants/tripStatus';
import { resolveDriverPayoutAmount } from '../../../services/PricingService';
import { resolveActualTripDurationMinutes } from '../../../services/tripDurationUtils';

const toPositiveNumber = (value) => {
  const normalizedValue =
    typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getTripCompletedTimestamp = (trip = {}) =>
  trip.completedAt ||
  trip.completed_at ||
  trip.createdAt ||
  trip.created_at ||
  trip.timestamp ||
  null;

const getTripCompletedDate = (trip = {}) => {
  const timestamp = getTripCompletedTimestamp(trip);
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveTripDistanceMiles = (trip = {}) => {
  const candidates = [
    trip.dispatchRequirements?.estimatedDistanceMiles,
    trip.dispatch_requirements?.estimatedDistanceMiles,
    trip.distance,
    trip.distanceMiles,
    trip.distance_miles,
    trip.pricing?.distanceMiles,
    trip.pricing?.distance_miles,
    trip.pricing?.distance,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const resolveTripDurationMinutes = (trip = {}) => {
  const actualDurationMinutes = resolveActualTripDurationMinutes(trip);
  if (actualDurationMinutes !== null) {
    return actualDurationMinutes;
  }

  const candidates = [
    trip.dispatchRequirements?.estimatedDurationMinutes,
    trip.dispatch_requirements?.estimatedDurationMinutes,
    trip.actualDurationMinutes,
    trip.actual_duration_minutes,
    trip.durationMinutes,
    trip.duration_minutes,
    trip.duration,
    trip.pricing?.durationMinutes,
    trip.pricing?.duration_minutes,
    trip.pricing?.duration,
    trip.pricing?.timeMinutes,
    trip.pricing?.time_minutes,
    trip.pricing?.time,
  ];

  for (const candidate of candidates) {
    const parsed = toPositiveNumber(candidate);
    if (parsed !== null) {
      return Math.round(parsed);
    }
  }

  const distanceMiles = resolveTripDistanceMiles(trip);
  if (distanceMiles === null) {
    return null;
  }

  const pickupDetails = trip?.pickup?.details || trip?.pickup_location?.details || {};
  const dropoffDetails = trip?.dropoff?.details || trip?.dropoff_location?.details || {};
  const items = Array.isArray(trip?.items)
    ? trip.items
    : trip?.item && typeof trip.item === 'object'
      ? [trip.item]
      : [];
  const helpRequested = Boolean(
    pickupDetails?.driverHelpsLoading ||
    pickupDetails?.driverHelp ||
    dropoffDetails?.driverHelpsUnloading ||
    dropoffDetails?.driverHelp
  );
  const itemCount = Math.max(items.length, 1);
  const estimatedMinutes = Math.round(
    25 + (distanceMiles * 4) + (Math.min(itemCount, 8) * 3) + (helpRequested ? 20 : 0)
  );

  return Math.min(Math.max(estimatedMinutes, 30), 240);
};

const formatDistanceLabel = (trip = {}) => {
  const miles = resolveTripDistanceMiles(trip);
  if (miles === null) {
    return null;
  }

  const roundedMiles = Number(miles.toFixed(1));
  const label = Number.isInteger(roundedMiles)
    ? roundedMiles.toFixed(0)
    : roundedMiles.toFixed(1);

  return `${label} mi`;
};

const formatDurationLabel = (trip = {}) => {
  const durationMinutes = resolveTripDurationMinutes(trip);
  if (durationMinutes === null) {
    return null;
  }

  return `${Math.round(durationMinutes)} min`;
};

const getTripEarningsAmount = (trip = {}) => {
  const directAmount = Number(trip.driverEarnings);
  if (Number.isFinite(directAmount)) {
    return directAmount;
  }

  return resolveDriverPayoutAmount(trip);
};

export const getPeriodStartDate = (period) => {
  const now = new Date();
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const processTripsIntoChartData = (trips, period) => {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (period === 'month') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    const weekData = weeks.map((label) => ({ day: label, trips: 0, earnings: 0 }));

    const monthTrips = trips.filter((trip) => {
      const tripDate = getTripCompletedDate(trip);
      return tripDate ? tripDate >= monthStart : false;
    });

    monthTrips.forEach((trip) => {
      const tripDate = getTripCompletedDate(trip);
      if (!tripDate) {
        return;
      }
      const weekIndex = Math.min(Math.floor((tripDate.getDate() - 1) / 7), 4);
      weekData[weekIndex].trips += 1;
      weekData[weekIndex].earnings += getTripEarningsAmount(trip);
    });

    return weekData.filter((_, index) => {
      const weekStart = new Date(monthStart);
      weekStart.setDate(1 + index * 7);
      return weekStart <= now;
    });
  }

  const weekData = daysOfWeek.map((day) => ({ day, trips: 0, earnings: 0 }));
  const periodStart = getPeriodStartDate('week');

  const filteredTrips = trips.filter((trip) => {
    const tripDate = getTripCompletedDate(trip);
    return tripDate ? tripDate >= periodStart : false;
  });

  filteredTrips.forEach((trip) => {
    const tripDate = getTripCompletedDate(trip);
    if (!tripDate) {
      return;
    }
    const dayIndex = tripDate.getDay() === 0 ? 6 : tripDate.getDay() - 1;

    if (dayIndex >= 0 && dayIndex < 7) {
      weekData[dayIndex].trips += 1;
      weekData[dayIndex].earnings += getTripEarningsAmount(trip);
    }
  });

  return weekData;
};

export const getMockWeeklyData = () => [
  { day: 'Mon', trips: 2, earnings: 45.8 },
  { day: 'Tue', trips: 3, earnings: 67.2 },
  { day: 'Wed', trips: 1, earnings: 28.5 },
  { day: 'Thu', trips: 2, earnings: 52.3 },
  { day: 'Fri', trips: 2, earnings: 61.4 },
  { day: 'Sat', trips: 1, earnings: 34.2 },
  { day: 'Sun', trips: 1, earnings: 41.1 },
];

export const formatTripDate = (timestamp) => {
  const date = getTripCompletedDate({ completedAt: timestamp });
  if (!date) {
    return 'Date unavailable';
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTripTime = (timestamp) => {
  const date = getTripCompletedDate({ completedAt: timestamp });
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getRecentTrips = (driverTrips = []) =>
  driverTrips
    .filter((trip) => trip.status === TRIP_STATUS.COMPLETED)
    .sort(
      (a, b) =>
        (getTripCompletedDate(b)?.getTime() || 0) -
        (getTripCompletedDate(a)?.getTime() || 0)
    )
    .slice(0, 4)
    .map((trip) => ({
      id: trip.id,
      request: trip,
      date: formatTripDate(getTripCompletedTimestamp(trip)),
      time: formatTripTime(getTripCompletedTimestamp(trip)),
      pickup: trip.pickupAddress || trip.pickup?.address || 'Pickup Location',
      dropoff: trip.dropoffAddress || trip.dropoff?.address || 'Dropoff Location',
      amount: getTripEarningsAmount(trip),
      distance: formatDistanceLabel(trip),
      duration: formatDurationLabel(trip),
    }));
