const DEFAULT_PLATFORM_SHARE_PERCENT = 0.25
const DEFAULT_DRIVER_PAYOUT_PERCENT = 0.75

export const roundPricingAmount = (value: number): number =>
  Math.round(value * 100) / 100

const toFiniteAmount = (value: unknown, fallback = 0): number => {
  const normalizedValue =
    typeof value === "string" ? value.replace(/[^0-9.-]/g, "") : value
  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const toPercentOrNull = (value: unknown): number | null => {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 1) {
    return null
  }
  return parsedValue
}

const resolveAppliedMultiplier = (
  explicitMultiplier: unknown,
  surchargeAmount: unknown,
  baseAmount: number,
): number => {
  const parsedMultiplier = Number(explicitMultiplier)
  if (Number.isFinite(parsedMultiplier) && parsedMultiplier >= 1) {
    return parsedMultiplier
  }

  if (baseAmount > 0) {
    const parsedSurcharge = toFiniteAmount(surchargeAmount, 0)
    if (parsedSurcharge > 0) {
      return 1 + parsedSurcharge / baseAmount
    }
  }

  return 1
}

export const resolvePricingPercentages = (
  source: Record<string, any> = {},
): {
  driverPayoutPercent: number
  platformSharePercent: number
} => {
  const driverPayoutPercent = toPercentOrNull(source.driverPayoutPercent)
  const platformSharePercent = toPercentOrNull(
    source.platformSharePercent ?? source.serviceFeePercent,
  )

  if (driverPayoutPercent !== null && platformSharePercent !== null) {
    return { driverPayoutPercent, platformSharePercent }
  }

  if (driverPayoutPercent !== null) {
    return {
      driverPayoutPercent,
      platformSharePercent: Math.max(0, roundPricingAmount(1 - driverPayoutPercent)),
    }
  }

  if (platformSharePercent !== null) {
    return {
      platformSharePercent,
      driverPayoutPercent: Math.max(0, roundPricingAmount(1 - platformSharePercent)),
    }
  }

  return {
    platformSharePercent: DEFAULT_PLATFORM_SHARE_PERCENT,
    driverPayoutPercent: DEFAULT_DRIVER_PAYOUT_PERCENT,
  }
}

export const resolveSplitBaseAmount = (pricing: Record<string, any> = {}): number => {
  const directAmount = toFiniteAmount(
    pricing.splitBaseAmount ?? pricing.fareAfterSurge ?? pricing.customerSubtotal,
    0,
  )
  if (directAmount > 0) {
    return roundPricingAmount(directAmount)
  }

  const grossFare = toFiniteAmount(pricing.grossFare, 0)
  const surgeFee = toFiniteAmount(pricing.surgeFee, 0)
  if (grossFare > 0 || surgeFee > 0) {
    return roundPricingAmount(grossFare + surgeFee)
  }

  const total = toFiniteAmount(pricing.total ?? pricing.price, 0)
  const insuranceAmount = toFiniteAmount(
    pricing.mandatoryInsurance ?? pricing.insurancePremium ?? pricing.insurance_premium,
    0,
  )
  const platformShare = toFiniteAmount(pricing.platformShare ?? pricing.serviceFee, 0)
  const serviceFeeIncludedInTotal = pricing.serviceFeeIncludedInTotal !== false

  if (total > 0) {
    return roundPricingAmount(
      Math.max(
        0,
        total - insuranceAmount - (serviceFeeIncludedInTotal ? platformShare : 0),
      ),
    )
  }

  return 0
}

export const refreshPricingSnapshot = (
  pricing: Record<string, any> = {},
  source: Record<string, any> = {},
) => {
  const percentages = resolvePricingPercentages({
    ...source,
    ...pricing,
  })
  const splitBaseAmount = resolveSplitBaseAmount(pricing)
  const mandatoryInsurance = roundPricingAmount(
    toFiniteAmount(pricing.mandatoryInsurance, 0),
  )
  const { tax: _tax, taxRate: _taxRate, taxableLaborAmount: _taxableLaborAmount, ...pricingWithoutTax } = pricing
  const platformShare = roundPricingAmount(
    splitBaseAmount * percentages.platformSharePercent,
  )
  const driverPayout = roundPricingAmount(
    splitBaseAmount * percentages.driverPayoutPercent,
  )
  const total = roundPricingAmount(splitBaseAmount + mandatoryInsurance)

  return {
    ...pricingWithoutTax,
    splitBaseAmount,
    fareAfterSurge: splitBaseAmount,
    serviceFee: platformShare,
    platformShare,
    serviceFeeIncludedInTotal: false,
    driverPayout,
    driverPayoutPercent: percentages.driverPayoutPercent,
    platformSharePercent: percentages.platformSharePercent,
    platformRetainedTotal: roundPricingAmount(platformShare + mandatoryInsurance),
    total,
  }
}

export const recalculatePricingWithLabor = (
  pricing: Record<string, any> = {},
  laborMinutes = 0,
  source: Record<string, any> = {},
) => {
  const bufferMinutes = toFiniteAmount(pricing.laborBufferMinutes, 0)
  const normalizedLaborMinutes = Math.max(0, toFiniteAmount(laborMinutes, 0))
  const billableMinutes = Math.max(0, normalizedLaborMinutes - bufferMinutes)
  const laborPerMin = toFiniteAmount(pricing.laborPerMin, 0)
  const laborFee = roundPricingAmount(billableMinutes * laborPerMin)

  const baseFare = toFiniteAmount(pricing.baseFare, 0)
  const mileageFee = toFiniteAmount(pricing.mileageFee, 0)
  const grossFare = roundPricingAmount(baseFare + mileageFee + laborFee)
  const originalSurgeBaseFare = Math.max(
    0,
    toFiniteAmount(pricing.baseFare, baseFare),
  )

  const peakMultiplier = resolveAppliedMultiplier(
    pricing.peakMultiplier,
    pricing.peakSurcharge,
    originalSurgeBaseFare,
  )
  const trafficMultiplier = resolveAppliedMultiplier(
    pricing.trafficMultiplier,
    pricing.trafficSurcharge,
    originalSurgeBaseFare,
  )

  const peakSurcharge =
    peakMultiplier > 1
      ? roundPricingAmount(baseFare * (peakMultiplier - 1))
      : 0
  const trafficSurcharge =
    trafficMultiplier > 1
      ? roundPricingAmount(baseFare * (trafficMultiplier - 1))
      : 0

  const fallbackWeatherSurcharge = Math.max(
    0,
    toFiniteAmount(pricing.surgeFee, 0) -
      toFiniteAmount(pricing.peakSurcharge, 0) -
      toFiniteAmount(pricing.trafficSurcharge, 0),
  )
  const weatherSurcharge = roundPricingAmount(
    toFiniteAmount(pricing.weatherSurcharge, fallbackWeatherSurcharge),
  )

  const surgeFee = roundPricingAmount(
    peakSurcharge + trafficSurcharge + weatherSurcharge,
  )

  return refreshPricingSnapshot(
    {
      ...pricing,
      grossFare,
      surgeFee,
      peakMultiplier: peakMultiplier > 1 ? peakMultiplier : undefined,
      peakSurcharge,
      trafficMultiplier: trafficMultiplier > 1 ? trafficMultiplier : undefined,
      trafficSurcharge,
      weatherSurcharge,
      laborFee,
      laborMinutes: normalizedLaborMinutes,
      laborBillableMinutes: billableMinutes,
      splitBaseAmount: roundPricingAmount(grossFare + surgeFee),
      fareAfterSurge: roundPricingAmount(grossFare + surgeFee),
    },
    source,
  )
}

export const resolveDriverPayoutAmount = (
  tripLike: Record<string, any> | number = {},
  source: Record<string, any> = {},
): number => {
  if (typeof tripLike === "number") {
    const { driverPayoutPercent } = resolvePricingPercentages(source)
    return roundPricingAmount(toFiniteAmount(tripLike, 0) * driverPayoutPercent)
  }

  const pricing = tripLike?.pricing || {}
  const candidates = [
    tripLike?.driverPayout,
    tripLike?.driver_payout,
    tripLike?.driverEarnings,
    tripLike?.earnings,
    pricing?.driverPayout,
    pricing?.driver_payout,
  ]

  for (const candidate of candidates) {
    const amount = toFiniteAmount(candidate, -1)
    if (amount >= 0) {
      return roundPricingAmount(amount)
    }
  }

  const refreshedPricing = refreshPricingSnapshot(
    {
      ...pricing,
      total: toFiniteAmount(pricing.total ?? tripLike?.price, 0),
      mandatoryInsurance: toFiniteAmount(
        pricing.mandatoryInsurance ?? tripLike?.insurance_premium,
        0,
      ),
    },
    source,
  )

  if (refreshedPricing.driverPayout > 0) {
    return refreshedPricing.driverPayout
  }

  const fallbackTotal = toFiniteAmount(pricing.total ?? tripLike?.price, 0)
  const { driverPayoutPercent } = resolvePricingPercentages({
    ...source,
    ...pricing,
  })
  return roundPricingAmount(fallbackTotal * driverPayoutPercent)
}
