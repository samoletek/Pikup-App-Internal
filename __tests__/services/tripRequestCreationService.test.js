jest.mock('../../services/DispatchMatchingService', () => ({
  buildDispatchRequirementsFromRequest: jest.fn().mockReturnValue({
    estimatedDistanceMiles: 5.2,
    estimatedDurationMinutes: 42,
  }),
}));

jest.mock('../../services/errorService', () => ({
  normalizeError: jest.fn((error, fallbackMessage) => ({
    message: error?.message || fallbackMessage,
  })),
}));

jest.mock('../../services/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/repositories/tripRepository', () => ({
  fetchTripsByParticipantId: jest.fn(),
  insertTripWithSelect: jest.fn(),
}));

jest.mock('../../services/tripMapper', () => ({
  mapTripFromDb: jest.fn((trip) => trip),
}));

const { createPickupRequest } = require('../../services/tripRequestCreationService');
const { buildDispatchRequirementsFromRequest } = require('../../services/DispatchMatchingService');
const { insertTripWithSelect } = require('../../services/repositories/tripRepository');

describe('tripRequestCreationService.createPickupRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists duration in trip payload and nested pricing when available', async () => {
    insertTripWithSelect.mockResolvedValue({
      data: { id: 'trip-1' },
      error: null,
    });

    await createPickupRequest({
      pickup: { address: 'Pickup Address' },
      dropoff: { address: 'Dropoff Address' },
      pickupDetails: {},
      dropoffDetails: {},
      vehicle: { type: 'Standard' },
      pricing: {
        total: 24.9,
        distance: 5.2,
        durationMinutes: 42,
      },
      selectedPaymentMethodId: 'pm_123',
    }, { id: 'customer-1' });

    expect(buildDispatchRequirementsFromRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing: expect.objectContaining({
          duration: 42,
          durationMinutes: 42,
        }),
      })
    );
    expect(insertTripWithSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_minutes: 42,
        pickup_location: expect.objectContaining({
          pricing: expect.objectContaining({
            duration: 42,
            durationMinutes: 42,
          }),
          details: expect.objectContaining({
            dispatchRequirements: expect.objectContaining({
              estimatedDurationMinutes: 42,
            }),
          }),
        }),
      })
    );
  });

  test('retries insert without duration_minutes when older schema does not have the column', async () => {
    const capturedPayloads = [];
    insertTripWithSelect.mockImplementation((payload) => {
      capturedPayloads.push({ ...payload });

      if (capturedPayloads.length === 1) {
        return Promise.resolve({
          data: null,
          error: {
            message: 'column "duration_minutes" does not exist',
          },
        });
      }

      return Promise.resolve({
        data: { id: 'trip-2' },
        error: null,
      });
    });

    await createPickupRequest({
      pickup: { address: 'Pickup Address' },
      dropoff: { address: 'Dropoff Address' },
      pickupDetails: {},
      dropoffDetails: {},
      vehicle: { type: 'Standard' },
      pricing: {
        total: 32.81,
        distance: 7.8,
      },
      duration: 38,
      selectedPaymentMethodId: 'pm_456',
    }, { id: 'customer-1' });

    expect(insertTripWithSelect).toHaveBeenCalledTimes(2);
    expect(capturedPayloads[0].duration_minutes).toBe(38);
    expect(capturedPayloads[1].duration_minutes).toBeUndefined();
  });
});
