jest.mock('../../services/PricingService', () => ({
  getPlatformFees: jest.fn().mockResolvedValue({}),
  resolveDriverPayoutAmount: jest.fn().mockReturnValue(0),
}));

jest.mock('../../services/repositories/paymentRepository', () => ({
  fetchDriverRowById: jest.fn(),
  updateDriverRowById: jest.fn(),
}));

jest.mock('../../services/repositories/tripRepository', () => ({
  createRealtimeChannel: jest.fn(),
  fetchTripsByDriverId: jest.fn(),
  removeRealtimeChannel: jest.fn(),
}));

const {
  getDriverStats,
  getDriverTrips,
  updateDriverEarnings,
} = require('../../services/driverEarningsService');
const {
  fetchDriverRowById,
  updateDriverRowById,
} = require('../../services/repositories/paymentRepository');
const { fetchTripsByDriverId } = require('../../services/repositories/tripRepository');
const { resolveDriverPayoutAmount } = require('../../services/PricingService');

describe('driverEarningsService.updateDriverEarnings', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    updateDriverRowById.mockResolvedValue({
      data: { id: 'driver-1' },
      error: null,
    });
  });

  test('does not send completed_orders update when drivers table has no such column', async () => {
    fetchDriverRowById.mockResolvedValue({
      data: {
        id: 'driver-1',
        metadata: {
          totalEarnings: 100,
          totalTrips: 2,
          totalPayouts: 20,
        },
      },
      error: null,
    });

    await updateDriverEarnings('driver-1', { driverEarnings: 15 });

    const [, updates] = updateDriverRowById.mock.calls[0];
    expect(updates.completed_orders).toBeUndefined();
    expect(updates.metadata).toEqual(
      expect.objectContaining({
        totalEarnings: 115,
        availableBalance: 95,
        totalTrips: 3,
        lastTripEarnings: 15,
      })
    );
  });

  test('increments completed_orders when column exists on driver profile', async () => {
    fetchDriverRowById.mockResolvedValue({
      data: {
        id: 'driver-1',
        completed_orders: 3,
        metadata: {
          totalEarnings: 50,
          totalTrips: 4,
          totalPayouts: 5,
        },
      },
      error: null,
    });

    await updateDriverEarnings('driver-1', { driverEarnings: 20 });

    const [, updates] = updateDriverRowById.mock.calls[0];
    expect(updates.completed_orders).toBe(4);
    expect(updates.metadata).toEqual(
      expect.objectContaining({
        totalEarnings: 70,
        availableBalance: 65,
        totalTrips: 5,
      })
    );
  });

  test('maps completed trips with settled payout and sorts by completed time', async () => {
    resolveDriverPayoutAmount.mockImplementation((trip) => {
      return Number(trip?.pricing?.driverPayout ?? trip?.pickup_location?.pricing?.driverPayout ?? 0);
    });
    fetchTripsByDriverId.mockResolvedValue({
      data: [
        {
          id: 'trip-1',
          price: 70,
          status: 'completed',
          created_at: '2026-04-01T09:00:00.000Z',
          completed_at: '2026-04-07T10:00:00.000Z',
          pickup_location: { address: 'A', pricing: { driverPayout: 42.25 } },
          dropoff_location: { address: 'B' },
        },
        {
          id: 'trip-2',
          price: 55,
          status: 'completed',
          created_at: '2026-04-08T08:00:00.000Z',
          completed_at: '2026-04-08T11:00:00.000Z',
          pickup_location: { address: 'C', pricing: { driverPayout: 33.5 } },
          dropoff_location: { address: 'D' },
        },
      ],
      error: null,
    });

    const trips = await getDriverTrips('driver-1');

    expect(trips).toHaveLength(2);
    expect(trips[0]).toEqual(
      expect.objectContaining({
        id: 'trip-2',
        completedAt: '2026-04-08T11:00:00.000Z',
        driverEarnings: 33.5,
      })
    );
    expect(trips[1]).toEqual(
      expect.objectContaining({
        id: 'trip-1',
        completedAt: '2026-04-07T10:00:00.000Z',
        driverEarnings: 42.25,
      })
    );
  });

  test('calculates weekly stats from completed time instead of created time', async () => {
    resolveDriverPayoutAmount.mockImplementation((trip) => {
      return Number(trip?.pricing?.driverPayout ?? trip?.pickup_location?.pricing?.driverPayout ?? 0);
    });
    fetchTripsByDriverId.mockImplementation(({ status }) => {
      if (status === 'completed') {
        return Promise.resolve({
          data: [
            {
              id: 'trip-week',
              price: 72,
              status: 'completed',
              created_at: '2026-03-30T08:00:00.000Z',
              completed_at: '2026-04-07T14:00:00.000Z',
              pickup_location: { pricing: { driverPayout: 44.5 } },
            },
            {
              id: 'trip-old',
              price: 48,
              status: 'completed',
              created_at: '2026-04-01T10:00:00.000Z',
              completed_at: '2026-04-05T18:00:00.000Z',
              pickup_location: { pricing: { driverPayout: 21.25 } },
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({
        data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        error: null,
      });
    });
    fetchDriverRowById.mockResolvedValue({
      data: {
        id: 'driver-1',
        metadata: {
          availableBalance: 44.5,
          totalPayouts: 0,
        },
      },
      error: null,
    });

    const stats = await getDriverStats('driver-1');

    expect(stats).toEqual(
      expect.objectContaining({
        currentWeekTrips: 1,
        weeklyEarnings: 44.5,
        totalTrips: 2,
        totalEarnings: 65.75,
        availableBalance: 65.75,
        acceptanceRate: 67,
        lastTripCompletedAt: '2026-04-07T14:00:00.000Z',
      })
    );
  });

  test('derives available balance from settled earnings and payouts instead of stale metadata balance', async () => {
    resolveDriverPayoutAmount.mockImplementation((trip) => {
      return Number(trip?.pricing?.driverPayout ?? trip?.pickup_location?.pricing?.driverPayout ?? 0);
    });
    fetchTripsByDriverId.mockImplementation(({ status }) => {
      if (status === 'completed') {
        return Promise.resolve({
          data: [
            {
              id: 'trip-a',
              price: 80,
              status: 'completed',
              completed_at: '2026-04-08T10:00:00.000Z',
              pickup_location: { pricing: { driverPayout: 50 } },
            },
            {
              id: 'trip-b',
              price: 40,
              status: 'completed',
              completed_at: '2026-04-08T11:00:00.000Z',
              pickup_location: { pricing: { driverPayout: 25 } },
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({
        data: [{ id: 'a' }, { id: 'b' }],
        error: null,
      });
    });
    fetchDriverRowById.mockResolvedValue({
      data: {
        id: 'driver-1',
        metadata: {
          availableBalance: 10,
          totalPayouts: 20,
        },
      },
      error: null,
    });

    const stats = await getDriverStats('driver-1');

    expect(stats.availableBalance).toBe(55);
    expect(stats.totalPayouts).toBe(20);
  });
});
