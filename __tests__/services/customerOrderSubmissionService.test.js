import { submitCustomerOrder } from '../../services/CustomerOrderSubmissionService';
import { uploadOrderItemsMedia } from '../../services/OrderItemMediaService';

jest.mock('../../services/OrderItemMediaService', () => ({
  uploadOrderItemsMedia: jest.fn(),
}));

const createBaseOrderData = (overrides = {}) => ({
  pricing: {
    total: 19.5,
    distance: 6.2,
  },
  selectedPaymentMethod: {
    stripePaymentMethodId: 'pm_test_123',
  },
  items: [{ name: 'Laptop' }],
  scheduleType: 'asap',
  selectedVehicle: { type: 'car' },
  pickup: { address: 'A' },
  dropoff: { address: 'B' },
  insuranceQuote: {
    offerId: 'offer_test_1',
    premium: 2.5,
    canPurchase: true,
  },
  ...overrides,
});

const createDependencies = (overrides = {}) => ({
  currentUserId: 'user_1',
  uploadToSupabase: jest.fn(),
  createPaymentIntent: jest.fn().mockResolvedValue({
    success: true,
    paymentIntent: {
      client_secret: 'cs_test_123',
    },
  }),
  confirmPayment: jest.fn().mockResolvedValue({
    success: true,
  }),
  createPickupRequest: jest.fn().mockResolvedValue({
    id: 'request_1',
  }),
  purchaseInsurance: jest.fn().mockResolvedValue({
    bookingId: 'booking_1',
  }),
  insuranceRetryDelayMs: 0,
  ...overrides,
});

describe('CustomerOrderSubmissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadOrderItemsMedia.mockResolvedValue({
      success: true,
      items: [{ name: 'Uploaded laptop' }],
    });
  });

  test('submits order successfully with purchased insurance', async () => {
    const orderData = createBaseOrderData();
    const dependencies = createDependencies();

    const result = await submitCustomerOrder({
      orderData,
      ...dependencies,
    });

    expect(result.success).toBe(true);
    expect(result.notices).toEqual([]);
    expect(dependencies.purchaseInsurance).toHaveBeenCalledWith('offer_test_1');
    expect(dependencies.createPaymentIntent).toHaveBeenCalledWith(
      1950,
      'usd',
      expect.any(Object),
      'pm_test_123'
    );
    expect(dependencies.confirmPayment).toHaveBeenCalledWith('cs_test_123', 'pm_test_123');
    expect(dependencies.createPickupRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing: expect.objectContaining({ total: 19.5 }),
        insurance: expect.objectContaining({
          status: 'purchased',
          bookingId: 'booking_1',
          quoteId: 'offer_test_1',
        }),
      })
    );
  });

  test('drops insurance and adds notice when quote has blocking amendments', async () => {
    const orderData = createBaseOrderData({
      pricing: { total: 20, distance: 7 },
      insuranceQuote: {
        offerId: 'offer_blocked',
        premium: 3,
        canPurchase: false,
      },
    });
    const dependencies = createDependencies();

    const result = await submitCustomerOrder({
      orderData,
      ...dependencies,
    });

    expect(result.success).toBe(true);
    expect(result.notices).toEqual([
      expect.objectContaining({
        title: 'Insurance Unavailable',
      }),
    ]);
    expect(dependencies.purchaseInsurance).not.toHaveBeenCalled();
    expect(dependencies.createPaymentIntent).toHaveBeenCalledWith(
      1700,
      'usd',
      expect.any(Object),
      'pm_test_123'
    );
    expect(dependencies.createPickupRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        pricing: expect.objectContaining({ total: 17 }),
        insurance: expect.objectContaining({
          status: 'amendments_blocked',
          quoteId: 'offer_blocked',
        }),
      })
    );
  });

  test('retries insurance purchase and falls back to delivery-only charge', async () => {
    const orderData = createBaseOrderData({
      pricing: { total: 20, distance: 8 },
      insuranceQuote: {
        offerId: 'offer_retry',
        premium: 2,
        canPurchase: true,
      },
    });
    const dependencies = createDependencies({
      purchaseInsurance: jest.fn().mockResolvedValue(null),
    });

    const result = await submitCustomerOrder({
      orderData,
      ...dependencies,
    });

    expect(result.success).toBe(true);
    expect(result.notices).toEqual([
      expect.objectContaining({
        title: 'Insurance Notice',
      }),
    ]);
    expect(dependencies.purchaseInsurance).toHaveBeenCalledTimes(2);
    expect(dependencies.createPaymentIntent).toHaveBeenCalledWith(
      1800,
      'usd',
      expect.any(Object),
      'pm_test_123'
    );
    expect(dependencies.createPickupRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        insurance: expect.objectContaining({
          status: 'purchase_failed',
          quoteId: 'offer_retry',
        }),
      })
    );
  });

  test('returns upload error without creating payment intent', async () => {
    uploadOrderItemsMedia.mockResolvedValue({
      success: false,
      error: 'upload failed',
    });
    const orderData = createBaseOrderData();
    const dependencies = createDependencies();

    const result = await submitCustomerOrder({
      orderData,
      ...dependencies,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('upload failed');
    expect(dependencies.createPaymentIntent).not.toHaveBeenCalled();
    expect(dependencies.createPickupRequest).not.toHaveBeenCalled();
  });

  test('returns payment-intent error and stops flow', async () => {
    const orderData = createBaseOrderData();
    const dependencies = createDependencies({
      createPaymentIntent: jest.fn().mockResolvedValue({
        success: false,
        error: 'payment intent failed',
      }),
    });

    const result = await submitCustomerOrder({
      orderData,
      ...dependencies,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('payment intent failed');
    expect(dependencies.confirmPayment).not.toHaveBeenCalled();
    expect(dependencies.createPickupRequest).not.toHaveBeenCalled();
  });
});
