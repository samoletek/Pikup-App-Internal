jest.mock('../../services/repositories/paymentRepository', () => ({
  fetchDriverRowById: jest.fn(),
}));

jest.mock('../../services/repositories/messagingRepository', () => ({
  createRealtimeChannel: jest.fn(),
  removeRealtimeChannel: jest.fn(),
}));

const { fetchDriverRowById } = require('../../services/repositories/paymentRepository');
const { getDriverReadinessProfile } = require('../../services/driverProfileService');

describe('driverProfileService.getDriverReadinessProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks readiness when payouts are still pending review', async () => {
    fetchDriverRowById.mockResolvedValue({
      data: {
        phone_verified: true,
        onboarding_complete: true,
        can_receive_payments: false,
        identity_verified: true,
        metadata: {},
      },
      error: null,
    });

    const result = await getDriverReadinessProfile('driver-1');

    expect(result.ready).toBe(false);
    expect(result.issues).toContain('payment');
  });

  test('allows readiness when all required checks pass', async () => {
    fetchDriverRowById.mockResolvedValue({
      data: {
        phone_verified: true,
        onboarding_complete: true,
        can_receive_payments: true,
        identity_verified: true,
        metadata: {},
      },
      error: null,
    });

    const result = await getDriverReadinessProfile('driver-1');

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test('uses metadata fallback for payment readiness', async () => {
    fetchDriverRowById.mockResolvedValue({
      data: {
        phone_verified: true,
        onboarding_complete: true,
        can_receive_payments: null,
        identity_verified: true,
        metadata: {
          canReceivePayments: true,
        },
      },
      error: null,
    });

    const result = await getDriverReadinessProfile('driver-1');

    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
