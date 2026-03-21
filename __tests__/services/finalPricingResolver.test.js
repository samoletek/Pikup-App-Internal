import { resolveFinalPricing } from '../../components/CustomerOrderModal/utils/finalPricingResolver';
import RedkikService from '../../services/RedkikService';

jest.mock('../../services/RedkikService', () => ({
  __esModule: true,
  default: {
    getQuote: jest.fn(),
  },
}));

jest.mock('../../services/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const makePreviewPricing = (overrides = {}) => ({
  baseFare: 15,
  mileageFee: 10,
  laborFee: 20,
  laborMinutes: 30,
  laborBillableMinutes: 20,
  laborBufferMinutes: 10,
  laborPerMin: 1.0,
  grossFare: 45,
  surgeFee: 0,
  surgeLabel: null,
  serviceFee: 11.25,
  tax: 1.40,
  taxRate: 0.07,
  taxableLaborAmount: 20,
  mandatoryInsurance: 12.99,
  insuranceApplied: true,
  total: 70.64,
  driverPayout: 33.75,
  distance: 5,
  ...overrides,
});

const makeOrderData = (overrides = {}) => ({
  items: [{ name: 'Laptop', condition: 'new', hasInsurance: true, value: 1500 }],
  pickup: { address: '123 Main St' },
  dropoff: { address: '456 Oak Ave' },
  scheduleType: 'asap',
  scheduledDateTime: null,
  duration: null,
  ...overrides,
});

const makeInsuranceQuote = (overrides = {}) => ({
  offerId: 'offer-abc',
  premium: 12.99,
  redkikPremium: 11,
  serviceFee: 1.99,
  canPurchase: true,
  amendments: [],
  details: {},
  fetchedAt: Date.now(),
  ...overrides,
});

const defaultDeps = () => ({
  calculatePricing: jest.fn(),
  customerEmail: 'test@example.com',
  customerName: 'Test User',
  laborAdjustment: null,
  orderData: makeOrderData(),
  setInsuranceQuote: jest.fn(),
  getInsuredItems: jest.fn((items) => items.filter(i => i.hasInsurance)),
});

describe('resolveFinalPricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Basic pass-through ──

  test('returns preview pricing as-is when no labor adjustment and no insurance quote', async () => {
    const pricing = makePreviewPricing({ insuranceApplied: false, mandatoryInsurance: 0, total: 57.65 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: null,
    });

    expect(result.pricing).toEqual(pricing);
    expect(result.insuranceQuote).toBeNull();
  });

  test('falls back to calculatePricing when previewPricing is null', async () => {
    const pricing = makePreviewPricing();
    const deps = defaultDeps();
    deps.calculatePricing.mockResolvedValue(pricing);

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: null,
      insuranceQuote: null,
    });

    expect(deps.calculatePricing).toHaveBeenCalledTimes(1);
    expect(result.pricing.baseFare).toBe(15);
  });

  // ── Insurance quote replacement ──

  test('replaces flat-rate insurance with actual Redkik quote (minimum: $12.99)', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const quote = makeInsuranceQuote({ premium: 12.99 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
    });

    // $12.99 flat → $12.99 actual = same total
    expect(result.pricing.mandatoryInsurance).toBe(12.99);
    expect(result.pricing.total).toBe(70.64);
  });

  test('replaces flat-rate with higher Redkik quote ($23.60)', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    // Redkik returned $20 premium → service fee $3.60 → total $23.60
    const quote = makeInsuranceQuote({ premium: 23.60 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
    });

    // total = 70.64 - 12.99 (old) + 23.60 (new) = 81.25
    expect(result.pricing.mandatoryInsurance).toBe(23.60);
    expect(result.pricing.total).toBe(81.25);
  });

  test('replaces flat-rate with lower Redkik quote ($6.99)', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    // Redkik returned $5 premium → fee $1.99 → total $6.99
    const quote = makeInsuranceQuote({ premium: 6.99 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
    });

    // total = 70.64 - 12.99 + 6.99 = 64.64
    expect(result.pricing.mandatoryInsurance).toBe(6.99);
    expect(result.pricing.total).toBe(64.64);
  });

  test('does NOT replace insurance when insuranceApplied is false', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 0,
      insuranceApplied: false,
      total: 57.65,
    });
    const quote = makeInsuranceQuote({ premium: 12.99 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
    });

    expect(result.pricing.mandatoryInsurance).toBe(0);
    expect(result.pricing.total).toBe(57.65);
  });

  test('does NOT replace insurance when quote premium is 0', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const quote = makeInsuranceQuote({ premium: 0 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
    });

    // premium 0 → condition `premium > 0` is false → no replacement
    expect(result.pricing.mandatoryInsurance).toBe(12.99);
    expect(result.pricing.total).toBe(70.64);
  });

  // ── Labor adjustment ──

  test('adjusts labor when laborAdjustment is provided', async () => {
    const pricing = makePreviewPricing({
      laborFee: 20,
      laborMinutes: 30,
      laborBillableMinutes: 20,
      laborBufferMinutes: 10,
      laborPerMin: 1.0,
      tax: 1.40,
      taxRate: 0.07,
      taxableLaborAmount: 20,
      total: 70.64,
      insuranceApplied: false,
      mandatoryInsurance: 0,
    });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: null,
      laborAdjustment: 40, // increase from 30 → 40 min
    });

    // billable = max(0, 40 - 10 buffer) = 30
    // newLaborFee = 30 * 1.0 = 30
    // laborDiff = 30 - 20 = 10
    // newTax = 30 * 0.07 = 2.10
    // taxDiff = 2.10 - 1.40 = 0.70
    // total = 70.64 + 10 + 0.70 = 81.34
    expect(result.pricing.laborFee).toBe(30);
    expect(result.pricing.laborBillableMinutes).toBe(30);
    expect(result.pricing.laborMinutes).toBe(40);
    expect(result.pricing.tax).toBe(2.10);
    expect(result.pricing.total).toBe(81.34);
  });

  test('labor adjustment respects buffer (adjustment within buffer = 0 billable)', async () => {
    const pricing = makePreviewPricing({
      laborFee: 20,
      laborMinutes: 30,
      laborBillableMinutes: 20,
      laborBufferMinutes: 10,
      laborPerMin: 1.0,
      tax: 1.40,
      taxRate: 0.07,
      total: 70.64,
      insuranceApplied: false,
      mandatoryInsurance: 0,
    });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: null,
      laborAdjustment: 5, // only 5 min → within 10 min buffer
    });

    // billable = max(0, 5 - 10) = 0
    expect(result.pricing.laborFee).toBe(0);
    expect(result.pricing.laborBillableMinutes).toBe(0);
    expect(result.pricing.tax).toBe(0);
  });

  test('labor adjustment + insurance quote combined', async () => {
    const pricing = makePreviewPricing({
      laborFee: 20,
      laborMinutes: 30,
      laborBillableMinutes: 20,
      laborBufferMinutes: 10,
      laborPerMin: 1.0,
      tax: 1.40,
      taxRate: 0.07,
      taxableLaborAmount: 20,
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    // Insurance: $20 Redkik + $3.60 fee = $23.60
    const quote = makeInsuranceQuote({ premium: 23.60 });
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: quote,
      laborAdjustment: 25, // 25 min total, 15 billable
    });

    // Labor: billable = max(0, 25-10) = 15, fee = 15*1.0 = 15
    // laborDiff = 15 - 20 = -5
    // newTax = 15 * 0.07 = 1.05
    // taxDiff = 1.05 - 1.40 = -0.35
    // total after labor = 70.64 + (-5) + (-0.35) = 65.29
    // Insurance: 65.29 - 12.99 + 23.60 = 75.90
    expect(result.pricing.laborFee).toBe(15);
    expect(result.pricing.mandatoryInsurance).toBe(23.60);
    expect(result.pricing.total).toBe(75.90);
  });

  // ── Quote refresh ──

  test('refreshes stale insurance quote (older than 10 min)', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const staleQuote = makeInsuranceQuote({
      premium: 12.99,
      fetchedAt: Date.now() - 11 * 60 * 1000, // 11 min ago
    });
    const freshQuote = {
      offerId: 'offer-fresh',
      premium: 17.70,
      redkikPremium: 15,
      serviceFee: 2.70,
      canPurchase: true,
      amendments: [],
      details: {},
    };
    RedkikService.getQuote.mockResolvedValue(freshQuote);

    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: staleQuote,
    });

    expect(RedkikService.getQuote).toHaveBeenCalledTimes(1);
    expect(deps.setInsuranceQuote).toHaveBeenCalled();
    // Fresh quote premium = 17.70, so total = 70.64 - 12.99 + 17.70 = 75.35
    expect(result.pricing.mandatoryInsurance).toBe(17.70);
    expect(result.pricing.total).toBe(75.35);
  });

  test('does NOT refresh fresh insurance quote (under 10 min)', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const freshQuote = makeInsuranceQuote({
      premium: 12.99,
      fetchedAt: Date.now() - 5 * 60 * 1000, // 5 min ago
    });
    const deps = defaultDeps();

    await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: freshQuote,
    });

    expect(RedkikService.getQuote).not.toHaveBeenCalled();
  });

  test('keeps previous quote when refresh returns null', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const staleQuote = makeInsuranceQuote({
      premium: 12.99,
      fetchedAt: Date.now() - 15 * 60 * 1000,
    });
    RedkikService.getQuote.mockResolvedValue(null);
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: staleQuote,
    });

    // Falls back to previous quote
    expect(result.pricing.mandatoryInsurance).toBe(12.99);
    expect(result.pricing.total).toBe(70.64);
  });

  test('keeps previous quote when refresh throws', async () => {
    const pricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });
    const staleQuote = makeInsuranceQuote({
      premium: 12.99,
      fetchedAt: Date.now() - 15 * 60 * 1000,
    });
    RedkikService.getQuote.mockRejectedValue(new Error('Network error'));
    const deps = defaultDeps();

    const result = await resolveFinalPricing({
      ...deps,
      previewPricing: pricing,
      insuranceQuote: staleQuote,
    });

    expect(result.pricing.mandatoryInsurance).toBe(12.99);
    expect(result.pricing.total).toBe(70.64);
  });

  // ── Various insurance amounts end-to-end ──

  describe('insurance replacement with various premium amounts', () => {
    const basePricing = makePreviewPricing({
      mandatoryInsurance: 12.99,
      insuranceApplied: true,
      total: 70.64,
    });

    const cases = [
      // [premium, expectedTotal, description]
      [12.99, 70.64, 'minimum $12.99 (same as flat rate)'],
      [6.99, 64.64, '$6.99 (below minimum Redkik)'],
      [17.70, 75.35, '$17.70 ($15 premium + 18% fee)'],
      [23.60, 81.25, '$23.60 ($20 premium + 18% fee)'],
      [59.00, 116.65, '$59.00 ($50 premium + 18% fee)'],
      [118.00, 175.65, '$118.00 ($100 premium + 18% fee)'],
    ];

    test.each(cases)(
      'premium $%d → total $%d (%s)',
      async (premium, expectedTotal) => {
        const quote = makeInsuranceQuote({ premium });
        const deps = defaultDeps();

        const result = await resolveFinalPricing({
          ...deps,
          previewPricing: { ...basePricing },
          insuranceQuote: quote,
        });

        expect(result.pricing.mandatoryInsurance).toBe(premium);
        expect(result.pricing.total).toBe(expectedTotal);
      }
    );
  });
});
