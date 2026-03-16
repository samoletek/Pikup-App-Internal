import { useCallback, useEffect, useState } from 'react';
import { subscribeToDriverProfileUpdates } from '../services/DriverService';
import { logger } from '../services/logger';

export default function useDriverProfileData({
  currentUser,
  currentUserId,
  getDriverProfile,
  getDriverStats,
  getUserProfile,
  getProfileImage,
}) {
  const [driverProfile, setDriverProfile] = useState(null);
  const [displayName, setDisplayName] = useState('Driver');
  const [onboardingStatus, setOnboardingStatus] = useState({
    connectAccountCreated: false,
    onboardingComplete: false,
    documentsVerified: false,
    canReceivePayments: false,
  });
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    acceptanceRate: 0,
  });

  const loadDriverStats = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      const stats = await getDriverStats?.(currentUserId);
      const parsedTotalTrips = Number(stats?.totalTrips);
      const parsedAcceptanceRate = Number(stats?.acceptanceRate);

      setDriverStats({
        totalTrips:
          Number.isFinite(parsedTotalTrips) && parsedTotalTrips > 0
            ? parsedTotalTrips
            : 0,
        acceptanceRate:
          Number.isFinite(parsedAcceptanceRate) && parsedAcceptanceRate > 0
            ? Math.round(parsedAcceptanceRate)
            : 0,
      });
    } catch (error) {
      logger.error('DriverProfileData', 'Error loading driver stats', error);
      setDriverStats({
        totalTrips: 0,
        acceptanceRate: 0,
      });
    }
  }, [currentUserId, getDriverStats]);

  const loadDriverProfile = useCallback(async () => {
    try {
      const profile = await getDriverProfile?.(currentUserId);
      setDriverProfile(profile);

      const user = await getUserProfile?.();
      const firstName = user?.first_name || user?.firstName || '';
      const lastName = user?.last_name || user?.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const name =
        fullName ||
        user?.name ||
        currentUser?.email?.split('@')[0] ||
        'Driver';
      setDisplayName(name);

      await getProfileImage?.();

      if (!profile) {
        return;
      }

      setOnboardingStatus({
        connectAccountCreated: !!profile.connectAccountId,
        onboardingComplete: profile.onboardingComplete || false,
        documentsVerified: profile.documentsVerified || false,
        canReceivePayments: profile.canReceivePayments || false,
      });

      await loadDriverStats();
    } catch (error) {
      logger.error('DriverProfileData', 'Error loading driver profile', error);
    }
  }, [
    currentUser?.email,
    currentUserId,
    getDriverProfile,
    getProfileImage,
    getUserProfile,
    loadDriverStats,
  ]);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    return subscribeToDriverProfileUpdates(currentUserId, (nextProfile) => {
      const metadata =
        nextProfile?.metadata &&
        typeof nextProfile.metadata === 'object' &&
        !Array.isArray(nextProfile.metadata)
          ? nextProfile.metadata
          : {};

      setDriverProfile((prev) => ({
        ...(prev || {}),
        ...nextProfile,
        metadata,
        rating_count: Number.isFinite(Number(nextProfile?.rating_count))
          ? Number(nextProfile.rating_count)
          : Number(prev?.rating_count || 0),
      }));

      setOnboardingStatus({
        connectAccountCreated: !!(
          nextProfile?.stripe_account_id || metadata?.connectAccountId
        ),
        onboardingComplete: Boolean(
          nextProfile?.onboarding_complete ??
          metadata?.onboardingComplete ??
          false
        ),
        documentsVerified: Boolean(metadata?.documentsVerified ?? false),
        canReceivePayments: Boolean(
          nextProfile?.can_receive_payments ??
          metadata?.canReceivePayments ??
          false
        ),
      });
    });
  }, [currentUserId]);

  return {
    driverProfile,
    displayName,
    onboardingStatus,
    driverStats,
  };
}
