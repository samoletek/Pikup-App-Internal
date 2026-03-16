export const RECENT_ADDRESSES_KEY = '@pikup_recent_addresses';

export const buildAddressRecord = (text, previousRecord, selectedPlace = null) => {
  const normalizedText = text.trim();
  const [namePart, ...restParts] = normalizedText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const resolvedName =
    selectedPlace?.name || namePart || previousRecord?.name || normalizedText;
  const resolvedAddress =
    selectedPlace?.address ||
    restParts.join(', ') ||
    previousRecord?.address ||
    normalizedText;

  return {
    id: selectedPlace?.id || previousRecord?.id || `saved-${Date.now()}`,
    name: resolvedName,
    address: resolvedAddress,
    full_description: selectedPlace?.full_description || normalizedText,
    coordinates: selectedPlace?.coordinates || previousRecord?.coordinates || null,
  };
};
