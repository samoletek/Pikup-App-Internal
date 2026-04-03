jest.mock('../../../services/PricingService', () => ({
  resolveDriverPayoutAmount: jest.fn().mockReturnValue(0),
}));

const { TRIP_STATUS } = require('../../../constants/tripStatus');
const {
  formatTripDate,
  formatTripTime,
  getRecentTrips,
} = require('../../../screens/driver/earnings/earningsUtils');

describe('earningsUtils', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('formats distance from nested pricing and estimates duration when direct value is missing', () => {
    const [trip] = getRecentTrips([
      {
        id: 'trip-1',
        status: TRIP_STATUS.COMPLETED,
        completedAt: '2026-04-08T10:38:00.000Z',
        pickupAddress: '767 Deer Lake Trail',
        dropoffAddress: '772 Deer Lake Trail',
        driverEarnings: 24.61,
        pricing: {
          distance: 7.8,
        },
        items: [{ name: 'Sofa', weight: 110 }],
      },
    ]);

    expect(trip.distance).toBe('7.8 mi');
    expect(trip.duration).toBe('59 min');
    expect(trip.date).toBe('Today');
    expect(trip.time).toBeTruthy();
  });

  test('prefers actual lifecycle duration over estimated pricing duration', () => {
    const [trip] = getRecentTrips([
      {
        id: 'trip-2',
        status: TRIP_STATUS.COMPLETED,
        completed_at: '2026-04-08T11:00:00.000Z',
        picked_up_at: '2026-04-08T10:37:00.000Z',
        pickupAddress: 'Pickup Address',
        dropoffAddress: 'Dropoff Address',
        driverEarnings: 18.68,
        pricing: {
          distance: 5.2,
          durationMinutes: 42,
        },
      },
    ]);

    expect(trip.duration).toBe('23 min');
  });

  test('falls back to safe date labels for invalid timestamps', () => {
    expect(formatTripDate('not-a-date')).toBe('Date unavailable');
    expect(formatTripTime('not-a-date')).toBe('');
  });
});
