import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRIP_STATUS, normalizeTripStatus } from '../../constants/tripStatus';
import { subscribeToCustomerProfileUpdates } from '../../services/ProfileService';
import { logger } from '../../services/logger';

export default function useCustomerProfileOverview({
  currentUser,
  currentUserId,
  getProfileImage,
  getUserPickupRequests,
  getUserProfile,
}) {
  const [customerProfile, setCustomerProfile] = useState(null);
  const [displayName, setDisplayName] = useState('User');
  const [accountStats, setAccountStats] = useState({
    totalTrips: 0,
    totalSpent: 0,
    avgRating: 0,
  });
  const [memberSince, setMemberSince] = useState('New on Pikup');

  const loadCustomerProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile?.(currentUserId);
      setCustomerProfile(profile?.customerProfile || profile || null);

      const firstName = profile?.first_name || profile?.firstName || '';
      const lastName = profile?.last_name || profile?.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const name = fullName || profile?.name || currentUser?.email?.split('@')[0] || 'User';
      setDisplayName(name);

      await getProfileImage?.();
    } catch (error) {
      logger.error('CustomerProfileOverview', 'Error loading customer profile', error);
    }
  }, [currentUser?.email, currentUserId, getProfileImage, getUserProfile]);

  const loadAccountStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const pickupRequests = await getUserPickupRequests?.();
      const requests = Array.isArray(pickupRequests) ? pickupRequests : [];
      const completedTrips = requests.filter(
        (trip) => normalizeTripStatus(trip.status) === TRIP_STATUS.COMPLETED
      );
      const totalSpent = completedTrips.reduce((sum, trip) => {
        const amount = Number(trip.pricing?.total ?? trip.price ?? 0) || 0;
        return sum + amount;
      }, 0);
      const ratingCount = Number(
        customerProfile?.rating_count || customerProfile?.customerProfile?.rating_count || 0
      );
      const rawRating = Number(
        customerProfile?.rating || customerProfile?.customerProfile?.rating || 0
      );
      const rating = ratingCount > 0 && Number.isFinite(rawRating) ? rawRating : 0;

      setAccountStats({
        totalTrips: completedTrips.length,
        totalSpent,
        avgRating: rating,
      });
    } catch (error) {
      logger.error('CustomerProfileOverview', 'Error loading account stats', error);
    }
  }, [currentUser, customerProfile, getUserPickupRequests]);

  useEffect(() => {
    void loadCustomerProfile();
  }, [loadCustomerProfile]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    return subscribeToCustomerProfileUpdates(currentUserId, (nextProfile) => {
      setCustomerProfile((prev) => ({ ...(prev || {}), ...nextProfile }));
    });
  }, [currentUserId]);

  useEffect(() => {
    void loadAccountStats();
  }, [loadAccountStats]);

  useEffect(() => {
    const dateStr = customerProfile?.created_at || currentUser?.created_at;
    if (dateStr) {
      const createdYear = new Date(dateStr).getFullYear();
      const currentYear = new Date().getFullYear();
      const years = currentYear - createdYear;
      setMemberSince(years > 0 ? `${years} yr on Pikup` : 'New on Pikup');
    }
  }, [customerProfile, currentUser]);

  const initials = useMemo(() => {
    return displayName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, [displayName]);

  const totalTrips = String(accountStats.totalTrips || 0);
  const reviewsCount = String(
    Number(customerProfile?.rating_count || customerProfile?.customerProfile?.rating_count || 0) ||
      0
  );
  const ratingValue =
    Number(accountStats.avgRating) > 0 ? Number(accountStats.avgRating).toFixed(1) : '0';

  return {
    customerProfile,
    displayName,
    memberSince,
    initials,
    totalTrips,
    reviewsCount,
    ratingValue,
  };
}
