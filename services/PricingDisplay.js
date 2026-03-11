const toCurrencyNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const formatMoney = (value) => {
  const parsed = toCurrencyNumber(value);
  const safeValue = Number.isFinite(parsed) ? parsed : 0;
  return `$${safeValue.toFixed(2)}`;
};

export const resolveDriverPayoutLabel = (request, fallback = '$0.00') => {
  if (typeof request?.driverPayout === 'string' && request.driverPayout.trim()) {
    const parsed = toCurrencyNumber(request.driverPayout);
    return Number.isFinite(parsed) ? formatMoney(parsed) : request.driverPayout;
  }

  const explicitAmount = toCurrencyNumber(request?.driverPayout);
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
    return formatMoney(explicitAmount);
  }

  const pricingPayout = toCurrencyNumber(request?.pricing?.driverPayout);
  if (Number.isFinite(pricingPayout) && pricingPayout > 0) {
    return formatMoney(pricingPayout);
  }

  if (typeof request?.earnings === 'string' && request.earnings.trim()) {
    const parsed = toCurrencyNumber(request.earnings);
    return Number.isFinite(parsed) ? formatMoney(parsed) : request.earnings;
  }

  const earningsAmount = toCurrencyNumber(request?.earnings);
  if (Number.isFinite(earningsAmount) && earningsAmount > 0) {
    return formatMoney(earningsAmount);
  }

  if (typeof request?.price === 'string' && request.price.trim()) {
    const parsed = toCurrencyNumber(request.price);
    return Number.isFinite(parsed) ? formatMoney(parsed) : request.price;
  }

  const priceAmount = toCurrencyNumber(request?.price);
  if (Number.isFinite(priceAmount) && priceAmount > 0) {
    return formatMoney(priceAmount);
  }

  return fallback;
};
