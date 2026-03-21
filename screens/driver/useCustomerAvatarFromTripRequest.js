import { useEffect, useRef, useState } from 'react';
import { firstNonEmptyString, resolveCustomerAvatarFromRequest } from './navigationAvatar.utils';
import {
  resolveAvatarUrlFromUser,
  resolveCustomerIdFromRequest,
  resolveCustomerNameFromRequest,
  resolveDisplayNameFromUser,
} from '../../utils/participantIdentity';

const isGenericCustomerName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || normalized === 'customer';
};

export default function useCustomerAvatarFromTripRequest({
  requestData,
  routeRequest,
  activeRequestCustomerId,
  getUserProfile,
  enabled = true,
}) {
  const [customerAvatarUrl, setCustomerAvatarUrl] = useState(null);
  const [customerDisplayName, setCustomerDisplayName] = useState('Customer');
  const customerAvatarCacheRef = useRef(new Map());

  useEffect(() => {
    const embeddedAvatar =
      resolveCustomerAvatarFromRequest(requestData) ||
      resolveCustomerAvatarFromRequest(routeRequest);
    const embeddedName = firstNonEmptyString(
      resolveCustomerNameFromRequest(requestData, ''),
      resolveCustomerNameFromRequest(routeRequest, '')
    ) || 'Customer';
    const resolvedCustomerId = firstNonEmptyString(
      activeRequestCustomerId,
      resolveCustomerIdFromRequest(requestData),
      resolveCustomerIdFromRequest(routeRequest)
    );
    const resolvedRequestId = firstNonEmptyString(
      requestData?.id,
      requestData?.requestId,
      requestData?.originalData?.id,
      routeRequest?.id,
      routeRequest?.requestId,
      routeRequest?.originalData?.id
    );

    setCustomerAvatarUrl(embeddedAvatar || null);
    setCustomerDisplayName(embeddedName);

    if (!enabled || !resolvedCustomerId || typeof getUserProfile !== 'function') {
      return;
    }

    if (customerAvatarCacheRef.current.has(resolvedCustomerId)) {
      const cachedProfileData = customerAvatarCacheRef.current.get(resolvedCustomerId) || {};
      setCustomerAvatarUrl(embeddedAvatar || cachedProfileData.avatarUrl || null);
      setCustomerDisplayName(
        isGenericCustomerName(embeddedName)
          ? cachedProfileData.displayName || embeddedName
          : embeddedName
      );
      return;
    }

    let isMounted = true;

    const loadCustomerAvatar = async () => {
      try {
        const profile = await getUserProfile(resolvedCustomerId, {
          requestId: resolvedRequestId || undefined,
        });
        if (!isMounted) {
          return;
        }

        const profileAvatar = firstNonEmptyString(
          resolveAvatarUrlFromUser(profile),
          profile?.photo_url,
          profile?.photo
        );
        const profileDisplayName = resolveDisplayNameFromUser(
          profile,
          embeddedName || 'Customer'
        );
        const cacheValue = {
          avatarUrl: profileAvatar || null,
          displayName: profileDisplayName || embeddedName || 'Customer',
        };

        customerAvatarCacheRef.current.set(resolvedCustomerId, cacheValue);
        setCustomerAvatarUrl(embeddedAvatar || cacheValue.avatarUrl || null);
        setCustomerDisplayName(
          isGenericCustomerName(embeddedName)
            ? cacheValue.displayName
            : embeddedName
        );
      } catch (_error) {
        if (!isMounted) {
          return;
        }

        customerAvatarCacheRef.current.set(resolvedCustomerId, null);
        setCustomerAvatarUrl(embeddedAvatar || null);
        setCustomerDisplayName(embeddedName || 'Customer');
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
    customerDisplayName,
    setCustomerAvatarUrl,
  };
}
