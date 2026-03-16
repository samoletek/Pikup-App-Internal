export const getPricingData = (selectedVehicle) => {
  if (selectedVehicle?.pricing) {
    const vehiclePricing = selectedVehicle.pricing;
    return {
      basePrice: vehiclePricing.baseFare + vehiclePricing.mileageCharge,
      serviceFee: vehiclePricing.serviceFee,
      tax:
        vehiclePricing.tax ||
        (vehiclePricing.subtotal + vehiclePricing.serviceFee) * 0.08,
      total: vehiclePricing.total.toFixed(2),
    };
  }

  const basePrice = parseFloat(selectedVehicle?.price?.replace('$', '') || '40.00');
  const serviceFee = 2.99;
  const tax = (basePrice + serviceFee) * 0.08;

  return {
    basePrice,
    serviceFee,
    tax,
    total: (basePrice + serviceFee + tax).toFixed(2),
  };
};

export const getPaymentMethodDisplay = (defaultPaymentMethod) => {
  if (!defaultPaymentMethod) {
    return {
      icon: 'add-circle-outline',
      text: 'Add Payment Method',
      subtext: 'Required for pickup',
    };
  }

  return {
    icon: 'card',
    text: `${(defaultPaymentMethod.brand || defaultPaymentMethod.cardBrand || 'Card').toUpperCase()} •••• ${defaultPaymentMethod.last4}`,
    subtext: `Expires ${defaultPaymentMethod.expMonth}/${defaultPaymentMethod.expYear}`,
  };
};
