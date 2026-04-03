jest.mock('../../services/repositories/paymentRepository', () => ({
  fetchCompletedDriverTrips: jest.fn(),
  invokeProcessPayout: jest.fn(),
}));

jest.mock('../../services/payment/common', () => ({
  getDriverProfileRow: jest.fn(),
  periodStartIso: jest.fn(() => '2026-04-07T00:00:00.000Z'),
  toNumber: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
}));

jest.mock('../../services/payment/profile', () => ({
  updateDriverPaymentProfile: jest.fn(),
}));

jest.mock('../../services/driverEarningsService', () => ({
  getDriverStats: jest.fn(),
}));

jest.mock('../../services/PricingService', () => ({
  resolveDriverPayoutAmount: jest.fn(),
}));

const { requestInstantPayout } = require('../../services/payment/payouts');
const { getDriverProfileRow } = require('../../services/payment/common');
const { updateDriverPaymentProfile } = require('../../services/payment/profile');
const { invokeProcessPayout } = require('../../services/repositories/paymentRepository');
const { getDriverStats } = require('../../services/driverEarningsService');

describe('payment/payouts.requestInstantPayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDriverProfileRow.mockResolvedValue({
      id: 'driver-1',
      stripe_account_id: 'acct_123',
      metadata: {
        availableBalance: 5,
        totalPayouts: 10,
        payouts: [],
      },
    });
    getDriverStats.mockResolvedValue({
      availableBalance: 30,
      totalPayouts: 10,
    });
    invokeProcessPayout.mockResolvedValue({
      data: {
        success: true,
        transferId: 'tr_123',
        feeAmount: 0,
        netAmount: 20,
      },
      error: null,
    });
    updateDriverPaymentProfile.mockResolvedValue({});
  });

  test('uses recalculated driver stats balance instead of stale metadata balance', async () => {
    const result = await requestInstantPayout('driver-1', 20);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        availableBalance: 10,
      })
    );
    expect(getDriverStats).toHaveBeenCalledWith('driver-1');
    expect(updateDriverPaymentProfile).toHaveBeenCalledWith(
      'driver-1',
      expect.objectContaining({
        totalPayouts: 30,
        availableBalance: 10,
      })
    );
  });
});
