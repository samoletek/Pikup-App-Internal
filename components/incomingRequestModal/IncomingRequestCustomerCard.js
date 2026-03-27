import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileActions } from '../../contexts/AuthContext';
import { colors } from '../../styles/theme';
import {
  firstNonEmptyString,
  resolveAvatarUrlFromUser,
  resolveCustomerAvatarFromRequest,
  resolveCustomerIdFromRequest,
  resolveCustomerNameFromRequest,
  resolveCustomerRatingFromRequest,
  resolveDisplayNameFromUser,
} from '../../utils/participantIdentity';

const resolveNumericRating = (...values) => {
  for (const value of values) {
    const normalizedValue =
      typeof value === 'string' ? value.replace(',', '.').trim() : value;
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

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

const resolveProfilePayload = (profileLike) => {
  const profile = asObject(profileLike);
  if (!profile) {
    return null;
  }

  return (
    asObject(profile.customerProfile) ||
    asObject(profile.customer_profile) ||
    asObject(profile.profile) ||
    profile
  );
};

const resolveProfileRating = (profileLike) => {
  const profile = resolveProfilePayload(profileLike);
  const metadata = asObject(profile?.metadata);

  return resolveNumericRating(
    profile?.rating,
    profile?.userRating,
    profile?.customerRating,
    profile?.customer_rating,
    profile?.averageRating,
    profile?.average_rating,
    profile?.avgRating,
    profile?.avg_rating,
    metadata?.rating,
    metadata?.userRating,
    metadata?.customerRating,
    metadata?.customer_rating,
    metadata?.averageRating,
    metadata?.average_rating,
    metadata?.avgRating,
    metadata?.avg_rating
  );
};

export default function IncomingRequestCustomerCard({ request, styles }) {
  const { getUserProfile } = useProfileActions();
  const profileCacheRef = useRef(new Map());
  const [customerProfile, setCustomerProfile] = useState(null);

  const customerId = useMemo(
    () => resolveCustomerIdFromRequest(request),
    [request]
  );
  const profileRequestId = useMemo(
    () => request?.id || request?.requestId || request?.originalData?.id || null,
    [request]
  );

  useEffect(() => {
    if (!customerId || typeof getUserProfile !== 'function') {
      setCustomerProfile(null);
      return undefined;
    }

    if (profileCacheRef.current.has(customerId)) {
      setCustomerProfile(profileCacheRef.current.get(customerId));
      return undefined;
    }

    let isCancelled = false;

    const loadCustomerProfile = async () => {
      try {
        const profile = await getUserProfile(customerId, {
          requestId: profileRequestId || undefined,
        });
        if (isCancelled) {
          return;
        }

        const normalizedProfile = resolveProfilePayload(profile) || profile || null;
        if (normalizedProfile) {
          profileCacheRef.current.set(customerId, normalizedProfile);
        } else {
          profileCacheRef.current.delete(customerId);
        }
        setCustomerProfile(normalizedProfile);
      } catch (_error) {
        if (isCancelled) {
          return;
        }

        profileCacheRef.current.delete(customerId);
        setCustomerProfile(null);
      }
    };

    loadCustomerProfile();

    return () => {
      isCancelled = true;
    };
  }, [customerId, getUserProfile, profileRequestId]);

  const requestCustomerName = useMemo(
    () => resolveCustomerNameFromRequest(request, 'Customer'),
    [request]
  );
  const customerName = useMemo(
    () => resolveDisplayNameFromUser(customerProfile, requestCustomerName),
    [customerProfile, requestCustomerName]
  );
  const customerAvatarUrl = useMemo(
    () =>
      firstNonEmptyString(
        resolveAvatarUrlFromUser(customerProfile),
        resolveCustomerAvatarFromRequest(request)
      ),
    [customerProfile, request]
  );
  const customerRating = useMemo(
    () =>
      resolveNumericRating(
        resolveProfileRating(customerProfile),
        resolveCustomerRatingFromRequest(request)
      ),
    [customerProfile, request]
  );
  const ratingStars = customerRating ? Math.round(customerRating) : 0;
  const ratingLabel = customerRating ? customerRating.toFixed(1) : 'No ratings yet';
  const customerPhotoPlaceholderStyle =
    styles.customerPhotoPlaceholder || styles.customerPhotoFallback || styles.customerPhoto;

  return (
    <View style={styles.customerCard}>
      {customerAvatarUrl ? (
        <Image source={{ uri: customerAvatarUrl }} style={styles.customerPhoto} />
      ) : (
        <View style={customerPhotoPlaceholderStyle}>
          <Ionicons name="person" size={22} color={colors.text.muted} />
        </View>
      )}
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>
          {customerName}
        </Text>
        <View style={styles.ratingRow}>
          {[...Array(5)].map((_, index) => (
            <Ionicons
              key={index}
              name="star"
              size={12}
              color={index < ratingStars ? colors.gold : colors.border.default}
            />
          ))}
          <Text style={styles.ratingText}>{ratingLabel}</Text>
        </View>
      </View>
    </View>
  );
}
