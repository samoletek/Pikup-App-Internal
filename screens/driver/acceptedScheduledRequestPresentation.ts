import {
  firstNonEmptyString,
  resolveAvatarUrlFromUser,
  resolveCustomerAvatarFromRequest,
  resolveCustomerNameFromRequest,
  resolveCustomerRatingFromRequest,
  resolveDisplayNameFromUser,
} from '../../utils/participantIdentity';

type AnyRecord = Record<string, any>;

export const resolveNumericRating = (...values: unknown[]) => {
  for (const value of values) {
    const normalizedValue = typeof value === 'string' ? value.replace(',', '.').trim() : value;
    const directNumeric = Number(normalizedValue);
    const fallbackMatch = typeof normalizedValue === 'string'
      ? normalizedValue.match(/-?\d+(?:\.\d+)?/)
      : null;
    const fallbackNumeric = fallbackMatch?.[0] ? Number(fallbackMatch[0]) : Number.NaN;
    const numeric = Number.isFinite(directNumeric) ? directNumeric : fallbackNumeric;
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.max(0, Math.min(numeric, 5));
    }
  }

  return null;
};

export const resolveParticipantRating = (participant: AnyRecord) =>
  resolveNumericRating(
    participant?.rating,
    participant?.user_rating,
    participant?.customer_rating,
    participant?.average_rating,
    participant?.avg_rating,
    participant?.averageRating,
    participant?.avgRating,
    participant?.metadata?.rating,
    participant?.metadata?.customer_rating,
    participant?.metadata?.average_rating,
    participant?.metadata?.avg_rating
  );

const isGenericCustomerLabel = (value: unknown) => {
  const normalized = firstNonEmptyString(value).toLowerCase();
  return !normalized || normalized === 'customer' || normalized === 'user' || normalized === 'not assigned';
};

export const isMeaningfulParticipantProfile = (profileLike: AnyRecord | null | undefined) => {
  const profile = profileLike && typeof profileLike === 'object' ? profileLike : null;
  if (!profile) {
    return false;
  }

  const displayName = resolveDisplayNameFromUser(profile, '');
  const avatarUrl = firstNonEmptyString(resolveAvatarUrlFromUser(profile));
  const rating = resolveParticipantRating(profile);
  const email = firstNonEmptyString(profile?.email);

  return Boolean(
    (!isGenericCustomerLabel(displayName) && displayName) ||
    avatarUrl ||
    Number.isFinite(rating) ||
    email
  );
};

const hasMeaningfulCustomerPresentation = (tripLike: AnyRecord) => {
  const trip = tripLike || {};
  const resolvedName = resolveCustomerNameFromRequest(trip, 'Customer');
  const resolvedAvatar = firstNonEmptyString(
    trip?.customerAvatarUrl,
    resolveCustomerAvatarFromRequest(trip)
  );
  const resolvedRating = resolveCustomerRatingFromRequest(trip);

  return (
    !isGenericCustomerLabel(resolvedName) ||
    Boolean(resolvedAvatar) ||
    Number.isFinite(resolvedRating)
  );
};

export const mergeAcceptedTripWithFallbackPresentation = (
  freshTrip: AnyRecord,
  fallbackTrip: AnyRecord | null | undefined
) => {
  if (!fallbackTrip) {
    return freshTrip;
  }
  if (hasMeaningfulCustomerPresentation(freshTrip)) {
    return freshTrip;
  }
  if (!hasMeaningfulCustomerPresentation(fallbackTrip)) {
    return freshTrip;
  }

  const fallbackCustomer = fallbackTrip?.customer || {};
  const freshCustomer = freshTrip?.customer || {};

  return {
    ...freshTrip,
    customerName: firstNonEmptyString(freshTrip?.customerName, fallbackTrip?.customerName),
    customerFirstName: firstNonEmptyString(
      freshTrip?.customerFirstName,
      fallbackTrip?.customerFirstName
    ),
    customerLastName: firstNonEmptyString(
      freshTrip?.customerLastName,
      fallbackTrip?.customerLastName
    ),
    customerAvatarUrl: firstNonEmptyString(
      freshTrip?.customerAvatarUrl,
      fallbackTrip?.customerAvatarUrl
    ) || null,
    customerRating: resolveNumericRating(
      freshTrip?.customerRating,
      fallbackTrip?.customerRating
    ),
    customer: {
      ...fallbackCustomer,
      ...freshCustomer,
      name: firstNonEmptyString(freshCustomer?.name, fallbackCustomer?.name),
      first_name: firstNonEmptyString(
        freshCustomer?.first_name,
        fallbackCustomer?.first_name
      ) || null,
      last_name: firstNonEmptyString(
        freshCustomer?.last_name,
        fallbackCustomer?.last_name
      ) || null,
      photo: firstNonEmptyString(freshCustomer?.photo, fallbackCustomer?.photo) || null,
      profile_image_url: firstNonEmptyString(
        freshCustomer?.profile_image_url,
        fallbackCustomer?.profile_image_url
      ) || null,
      avatar_url: firstNonEmptyString(
        freshCustomer?.avatar_url,
        fallbackCustomer?.avatar_url
      ) || null,
      rating: resolveNumericRating(freshCustomer?.rating, fallbackCustomer?.rating),
    },
  };
};
