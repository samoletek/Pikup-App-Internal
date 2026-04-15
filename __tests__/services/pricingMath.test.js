import {
  recalculatePricingWithLabor,
  roundPricingAmount,
} from '../../services/pricing/pricingMath';

describe('pricingMath', () => {
  it('applies peak and traffic multipliers to base fare only', () => {
    const pricing = recalculatePricingWithLabor(
      {
        baseFare: 20,
        mileageFee: 30,
        laborPerMin: 2,
        laborBufferMinutes: 0,
        peakMultiplier: 1.5,
        trafficMultiplier: 1.3,
        weatherSurcharge: 7.5,
        mandatoryInsurance: 12.99,
      },
      10,
      {
        serviceFeePercent: 0.25,
        driverPayoutPercent: 0.75,
      }
    );

    expect(pricing.laborFee).toBe(20);
    expect(pricing.grossFare).toBe(70);
    expect(pricing.peakSurcharge).toBe(10);
    expect(pricing.trafficSurcharge).toBe(6);
    expect(pricing.surgeFee).toBe(23.5);
    expect(pricing.splitBaseAmount).toBe(93.5);
    expect(pricing.platformShare).toBe(23.38);
    expect(pricing.driverPayout).toBe(70.13);
    expect(pricing.total).toBe(roundPricingAmount(93.5 + 12.99));
  });
});
