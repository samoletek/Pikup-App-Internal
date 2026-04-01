import {
  buildSettledTripPricing,
  buildTripPricingCreditPatch,
  hasDriverEarningsCredit,
} from '../../services/payment/tripSettlement';

describe('tripSettlement', () => {
  it('rebuilds settled pricing from persisted trip totals', () => {
    const pricing = buildSettledTripPricing({
      price: 106.49,
      insurance_premium: 12.99,
      pickup_location: {
        pricing: {
          baseFare: 20,
          mileageFee: 30,
          laborFee: 20,
          tax: 0,
          peakMultiplier: 1.5,
          peakSurcharge: 10,
          trafficMultiplier: 1.3,
          trafficSurcharge: 6,
          weatherSurcharge: 7.5,
          surgeFee: 23.5,
          splitBaseAmount: 93.5,
          serviceFeeIncludedInTotal: false,
          driverPayoutPercent: 0.75,
          platformSharePercent: 0.25,
        },
      },
    });

    expect(pricing.total).toBe(106.49);
    expect(pricing.customerTotal).toBe(106.49);
    expect(pricing.platformShare).toBe(23.38);
    expect(pricing.driverPayout).toBe(70.13);
    expect(pricing.platformRetainedTotal).toBe(36.37);
  });

  it('marks driver earnings credit inside pickup pricing payload', () => {
    const trip = {
      price: 50,
      pickup_location: {
        address: '123 Main St',
        pricing: {
          total: 50,
          splitBaseAmount: 40,
          tax: 0,
          mandatoryInsurance: 10,
          driverPayoutPercent: 0.75,
          platformSharePercent: 0.25,
        },
      },
    };

    expect(hasDriverEarningsCredit(trip)).toBe(false);

    const patch = buildTripPricingCreditPatch(trip, '2026-03-12T10:00:00.000Z');

    expect(patch.address).toBe('123 Main St');
    expect(patch.pricing.driverEarningsCreditedAt).toBe('2026-03-12T10:00:00.000Z');
    expect(patch.pricing.driverPayout).toBe(30);
    expect(hasDriverEarningsCredit({ pickup_location: patch })).toBe(true);
  });
});
