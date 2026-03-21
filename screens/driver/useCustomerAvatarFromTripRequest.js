import { useEffect, useRef, useState } from 'react';
import { firstAvatarUrl } from '../../utils/profileDisplay';
import { resolveCustomerAvatarFromRequest } from './navigationAvatar.utils';

export default function useCustomerAvatarFromTripRequest({
  requestData,
  routeRequest,
  activeRequestCustomerId,
  getUserProfile,
  enabled = true,
}) {
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState(null);
  const customerAvatarCacheRef = useRef(new Map());

  useEffect(() => {
    const embeddedAvatar =
      resolveCustomerAvatarFromRequest(requestData) ||
      resolveCustomerAvatarFromRequest(routeRequest);

    if (embeddedAvatar) {
      setCustomerAvatarUrl(embeddedAvatar);
      if (activeRequestCustomerId) {
        customerAvatarCacheRef.current.set(activeRequestCustomerId, embeddedAvatar);
      }
      return;
    }

    if (!enabled || !activeRequestCustomerId || typeof getUserProfile !== 'function') {
      setCustomerAvatarUrl(null);
      return;
    }

    if (customerAvatarCacheRef.current.has(activeRequestCustomerId)) {
      setCustomerAvatarUrl(customerAvatarCacheRef.current.get(activeRequestCustomerId));
      return;
    }

    let isMounted = true;

    const loadCustomerAvatar = async () => {
      try {
        const profile = await getUserProfile(activeRequestCustomerId);
        if (!isMounted) {
          return;
        }

        const profileAvatar = firstAvatarUrl(
          profile?.profileImageUrl,
          profile?.profile_image_url,
          profile?.avatarUrl,
          profile?.avatar_url
        );

        customerAvatarCacheRef.current.set(activeRequestCustomerId, profileAvatar);
        setCustomerAvatarUrl(profileAvatar);
      } catch (_error) {
        if (!isMounted) {
          return;
        }

        customerAvatarCacheRef.current.set(activeRequestCustomerId, null);
        setCustomerAvatarUrl(null);
      }
    };

    loadCustomerAvatar();

    return () => {
      isMounted = false;
    };
  }, [
    activeRequestCustomerId,
    enabled,
    getUserProfile,
    requestData,
    routeRequest,
  ]);

  return {
    customerAvatarUrl,
    setCustomerAvatarUrl,
  };
}
