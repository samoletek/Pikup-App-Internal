export const getPricingData = (selectedVehicle) => {
  if (selectedVehicle?.pricing) {
    const vehiclePricing = selectedVehicle.pricing;
    return {
      baseFare: Number(vehiclePricing.baseFare || 0),
      mileageFee: Number(vehiclePricing.mileageFee || vehiclePricing.mileageCharge || 0),
      insurance: Number(vehiclePricing.mandatoryInsurance || 0),
      total: vehiclePricing.total.toFixed(2),
    };
  }

  const baseFare = parseFloat(selectedVehicle?.price?.replace('$', '') || '40.00');

  return {
    baseFare,
    mileageFee: 0,
    insurance: 0,
    total: baseFare.toFixed(2),
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
