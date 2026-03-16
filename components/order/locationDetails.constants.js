export const LOCATION_TYPES = [
  { id: 'store', label: 'Store', icon: 'storefront-outline' },
  { id: 'apartment', label: 'Apartment/Condo', icon: 'business-outline' },
  { id: 'residential_other', label: 'Residential/Other', icon: 'home-outline' },
];

export const normalizeLocationType = (value) => {
  if (value === 'house_other') {
    return 'residential_other';
  }

  return value || 'store';
};
