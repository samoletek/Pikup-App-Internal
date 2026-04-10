const toTrimmedString = (value) => {
  return typeof value === 'string' ? value.trim() : '';
};

const splitAddressParts = (value) => {
  return toTrimmedString(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

const findContextEntry = (context, prefix) => {
  return context.find((entry) => {
    return toTrimmedString(entry?.id).startsWith(prefix);
  });
};

const normalizeUsStateCode = (value) => {
  const normalized = toTrimmedString(value).toUpperCase();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('US-')) {
    return normalized.slice(3);
  }

  return normalized;
};

const resolvePrimaryLine = (feature, placeName) => {
  const streetName = toTrimmedString(feature?.text);
  const streetNumber = toTrimmedString(feature?.address);

  if (streetName && streetNumber) {
    return `${streetNumber} ${streetName}`;
  }

  if (streetName) {
    return streetName;
  }

  const parts = splitAddressParts(placeName);
  if (parts.length > 0) {
    return parts[0];
  }

  return placeName;
};

const resolveSecondaryLine = (feature, placeName, primaryLine) => {
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const placeEntry = findContextEntry(context, 'place') || findContextEntry(context, 'locality');
  const regionEntry = findContextEntry(context, 'region');
  const postcodeEntry = findContextEntry(context, 'postcode');
  const countryEntry = findContextEntry(context, 'country');

  const city = toTrimmedString(placeEntry?.text);
  const state =
    normalizeUsStateCode(regionEntry?.short_code) || toTrimmedString(regionEntry?.text);
  const postalCode = toTrimmedString(postcodeEntry?.text);
  const country = toTrimmedString(countryEntry?.text);

  const contextualSecondaryLine = [city, state, postalCode, country]
    .filter(Boolean)
    .join(', ');

  if (contextualSecondaryLine) {
    return contextualSecondaryLine;
  }

  const parts = splitAddressParts(placeName);
  if (parts.length <= 1) {
    return '';
  }

  if (
    primaryLine &&
    parts[0] &&
    parts[0].toLowerCase() === primaryLine.toLowerCase()
  ) {
    return parts.slice(1).join(', ');
  }

  return parts.slice(1).join(', ');
};

export const buildAddressSuggestionFromMapboxFeature = (feature) => {
  const placeName = toTrimmedString(feature?.place_name);
  const name = resolvePrimaryLine(feature, placeName);
  const address = resolveSecondaryLine(feature, placeName, name);

  const longitude = Number(feature?.center?.[0]);
  const latitude = Number(feature?.center?.[1]);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    id: toTrimmedString(feature?.id) || `feature-${Date.now()}`,
    name: name || placeName || 'Address',
    address: address || placeName || 'Address unavailable',
    full_description: placeName || [name, address].filter(Boolean).join(', '),
    coordinates: hasCoordinates
      ? {
          latitude,
          longitude,
        }
      : null,
  };
};
