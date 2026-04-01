import { refreshPricingSnapshot } from "../pricing/pricingMath"

const toAmount = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toRecord = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, any>
}

export const resolveTripPricingRecord = (tripLike: Record<string, any> = {}) => {
  const pickupLocation = toRecord(tripLike.pickup_location ?? tripLike.pickup)
  return toRecord(tripLike.pricing ?? pickupLocation.pricing)
}

export const hasDriverEarningsCredit = (tripLike: Record<string, any> = {}) => {
  const pricing = resolveTripPricingRecord(tripLike)
  return Boolean(pricing.driverEarningsCreditedAt)
}

export const buildSettledTripPricing = (tripLike: Record<string, any> = {}) => {
  const pricing = resolveTripPricingRecord(tripLike)
  const total = toAmount(tripLike.price ?? pricing.total)
  const mandatoryInsurance = toAmount(
    tripLike.insurance_premium ?? pricing.mandatoryInsurance,
  )

  const refreshedPricing = refreshPricingSnapshot(
    {
      ...pricing,
      total,
      mandatoryInsurance,
    },
    pricing,
  )

  return {
    ...refreshedPricing,
    customerTotal: refreshedPricing.total,
  }
}

export const buildTripPricingCreditPatch = (
  tripLike: Record<string, any> = {},
  creditedAt = new Date().toISOString(),
) => {
  const pickupLocation = toRecord(tripLike.pickup_location ?? tripLike.pickup)
  const settledPricing = buildSettledTripPricing(tripLike)

  return {
    ...pickupLocation,
    pricing: {
      ...settledPricing,
      driverEarningsCreditedAt: creditedAt,
    },
  }
}
