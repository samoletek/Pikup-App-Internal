import { firstAvatarUrl, firstNonEmptyString } from '../../utils/profileDisplay';

export { firstNonEmptyString };

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

  return firstAvatarUrl(
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
