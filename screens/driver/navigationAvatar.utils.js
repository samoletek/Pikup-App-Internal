export const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export const resolveCustomerAvatarFromRequest = (requestLike) => {
  if (!requestLike || typeof requestLike !== 'object') {
    return null;
  }

  const customer =
    requestLike.customer ||
    requestLike.customerProfile ||
    requestLike.customer_profile ||
    {};
  const originalData =
    requestLike.originalData && typeof requestLike.originalData === 'object'
      ? requestLike.originalData
      : {};
  const originalCustomer =
    originalData.customer ||
    originalData.customerProfile ||
    originalData.customer_profile ||
    {};

  return firstNonEmptyString(
    requestLike.customerPhoto,
    customer.profileImageUrl,
    customer.profile_image_url,
    customer.avatarUrl,
    customer.avatar_url,
    requestLike.customerProfileImageUrl,
    requestLike.customer_profile_image_url,
    requestLike.customerAvatarUrl,
    requestLike.customer_avatar_url,
    originalCustomer.profileImageUrl,
    originalCustomer.profile_image_url,
    originalCustomer.avatarUrl,
    originalCustomer.avatar_url,
    originalData.customerProfileImageUrl,
    originalData.customer_profile_image_url,
    originalData.customerAvatarUrl,
    originalData.customer_avatar_url
  );
};
