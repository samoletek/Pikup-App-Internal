import { TRIP_STATUS } from '../../../constants/tripStatus';

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
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      return tripDate >= monthStart;
    });

    monthTrips.forEach((trip) => {
      const tripDate = new Date(trip.completedAt || trip.timestamp);
      const weekIndex = Math.min(Math.floor((tripDate.getDate() - 1) / 7), 4);
      weekData[weekIndex].trips += 1;
      weekData[weekIndex].earnings += parseFloat(
        trip.driverEarnings || trip.pricing?.total * 0.7 || 0
      );
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
    const tripDate = new Date(trip.completedAt || trip.timestamp);
    return tripDate >= periodStart;
  });

  filteredTrips.forEach((trip) => {
    const tripDate = new Date(trip.completedAt || trip.timestamp);
    const dayIndex = tripDate.getDay() === 0 ? 6 : tripDate.getDay() - 1;

    if (dayIndex >= 0 && dayIndex < 7) {
      weekData[dayIndex].trips += 1;
      weekData[dayIndex].earnings += parseFloat(
        trip.driverEarnings || trip.pricing?.total * 0.7 || 0
      );
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
  const date = new Date(timestamp);
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

export const formatTripTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

export const getRecentTrips = (driverTrips = []) =>
  driverTrips
    .filter((trip) => trip.status === TRIP_STATUS.COMPLETED)
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.timestamp) -
        new Date(a.completedAt || a.timestamp)
    )
    .slice(0, 4)
    .map((trip) => ({
      id: trip.id,
      date: formatTripDate(trip.completedAt || trip.timestamp),
      time: formatTripTime(trip.completedAt || trip.timestamp),
      pickup: trip.pickupAddress || trip.pickup?.address || 'Pickup Location',
      dropoff: trip.dropoffAddress || trip.dropoff?.address || 'Dropoff Location',
      amount: Number(trip.driverEarnings || trip.pricing?.total * 0.7 || 0),
      distance: trip.distance || '0 mi',
      duration: trip.duration || '0 min',
    }));
