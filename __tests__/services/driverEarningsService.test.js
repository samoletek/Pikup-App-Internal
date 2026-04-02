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

const { updateDriverEarnings } = require('../../services/driverEarningsService');
const {
  fetchDriverRowById,
  updateDriverRowById,
} = require('../../services/repositories/paymentRepository');

describe('driverEarningsService.updateDriverEarnings', () => {
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
});
