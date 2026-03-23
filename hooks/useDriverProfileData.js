import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToDriverProfileUpdates } from '../services/DriverService';
import { logger } from '../services/logger';

const EMPTY_ONBOARDING_STATUS = Object.freeze({
  connectAccountCreated: false,
  onboardingComplete: false,
  documentsVerified: false,
  canReceivePayments: false,
});

const EMPTY_DRIVER_STATS = Object.freeze({
  totalTrips: 0,
  acceptanceRate: 0,
});

const toOnboardingStatus = (profile) => {
  if (!profile) {
    return EMPTY_ONBOARDING_STATUS;
  }

  return {
    connectAccountCreated: Boolean(profile.connectAccountId || profile.stripe_account_id),
    onboardingComplete: Boolean(profile.onboardingComplete ?? profile.onboarding_complete),
    documentsVerified: Boolean(
      profile.documentsVerified ??
      profile.documents_verified ??
      profile?.metadata?.documentsVerified
    ),
    canReceivePayments: Boolean(profile.canReceivePayments ?? profile.can_receive_payments),
  };
};

const toDriverStats = (stats) => {
  const parsedTotalTrips = Number(stats?.totalTrips);
  const parsedAcceptanceRate = Number(stats?.acceptanceRate);

  return {
    totalTrips:
      Number.isFinite(parsedTotalTrips) && parsedTotalTrips > 0
        ? parsedTotalTrips
        : 0,
    acceptanceRate:
      Number.isFinite(parsedAcceptanceRate) && parsedAcceptanceRate > 0
        ? Math.round(parsedAcceptanceRate)
        : 0,
  };
};

const toDisplayName = (profileUser, fallbackEmail) => {
  const firstName = profileUser?.first_name || profileUser?.firstName || '';
  const lastName = profileUser?.last_name || profileUser?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }

  const directName = String(profileUser?.name || '').trim();
  if (directName) {
    return directName;
  }

  const emailPrefix = String(fallbackEmail || '')
    .trim()
    .split('@')[0];
  if (emailPrefix) {
    return emailPrefix;
  }

  return 'Driver';
};

const shallowEqualObject = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => Object.is(left[key], right[key]));
};

const toProfileFingerprint = (profile) => {
  if (!profile) {
    return 'none';
  }

  return [
    profile.id || profile.user_id || profile.userId || '',
    profile.updated_at || profile.updatedAt || '',
    profile.rating ?? '',
    profile.rating_count ?? '',
    profile.connectAccountId || profile.stripe_account_id || '',
    profile.onboardingComplete ?? profile.onboarding_complete ?? '',
    profile.canReceivePayments ?? profile.can_receive_payments ?? '',
  ].join('|');
};

const toNormalizedProfile = (profile) => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const metadata =
    profile?.metadata &&
    typeof profile.metadata === 'object' &&
    !Array.isArray(profile.metadata)
      ? profile.metadata
      : {};
  const badgeStats = (
    profile?.badge_stats &&
    typeof profile.badge_stats === 'object' &&
    !Array.isArray(profile.badge_stats)
  )
    ? profile.badge_stats
    : (
      metadata?.badge_stats &&
      typeof metadata.badge_stats === 'object' &&
      !Array.isArray(metadata.badge_stats)
        ? metadata.badge_stats
        : {}
    );
  const ratingCount = Number.isFinite(Number(profile?.rating_count))
    ? Number(profile.rating_count)
    : 0;
  const connectAccountId = (
    profile?.connectAccountId ||
    profile?.stripe_account_id ||
    metadata?.connectAccountId ||
    null
  );
  const onboardingComplete = Boolean(
    profile?.onboardingComplete ??
    profile?.onboarding_complete ??
    metadata?.onboardingComplete ??
    false
  );
  const canReceivePayments = Boolean(
    profile?.canReceivePayments ??
    profile?.can_receive_payments ??
    metadata?.canReceivePayments ??
    false
  );
  const documentsVerified = Boolean(
    profile?.documentsVerified ??
    profile?.documents_verified ??
    metadata?.documentsVerified ??
    false
  );

  return {
    ...profile,
    metadata,
    badge_stats: badgeStats,
    rating_count: ratingCount,
    connectAccountId,
    onboardingComplete,
    canReceivePayments,
    documentsVerified,
    driverProfile: {
      ...metadata,
      badge_stats: badgeStats,
      rating_count: ratingCount,
      onboardingComplete,
      canReceivePayments,
      connectAccountId,
      documentsVerified,
      email: profile?.email || null,
    },
  };
};

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
  const [onboardingStatus, setOnboardingStatus] = useState(EMPTY_ONBOARDING_STATUS);
  const [driverStats, setDriverStats] = useState(EMPTY_DRIVER_STATS);
  const profileFingerprintRef = useRef('none');

  const actionsRef = useRef({
    getDriverProfile,
    getDriverStats,
    getUserProfile,
    getProfileImage,
  });

  useEffect(() => {
    actionsRef.current = {
      getDriverProfile,
      getDriverStats,
      getUserProfile,
      getProfileImage,
    };
  }, [getDriverProfile, getDriverStats, getUserProfile, getProfileImage]);

  const fallbackEmail = useMemo(() => {
    return currentUser?.email || null;
  }, [currentUser?.email]);

  useEffect(() => {
    if (!currentUserId) {
      profileFingerprintRef.current = 'none';
      setDriverProfile((prev) => (prev ? null : prev));
      setDisplayName((prev) => (prev === 'Driver' ? prev : 'Driver'));
      setOnboardingStatus((prev) => (
        shallowEqualObject(prev, EMPTY_ONBOARDING_STATUS) ? prev : EMPTY_ONBOARDING_STATUS
      ));
      setDriverStats((prev) => (
        shallowEqualObject(prev, EMPTY_DRIVER_STATS) ? prev : EMPTY_DRIVER_STATS
      ));
      return;
    }

    let cancelled = false;

    const loadDriverProfileSnapshot = async () => {
      try {
        const [profile, profileUser, stats] = await Promise.all([
          actionsRef.current.getDriverProfile?.(currentUserId),
          actionsRef.current.getUserProfile?.(),
          actionsRef.current.getDriverStats?.(currentUserId),
        ]);

        if (cancelled) {
          return;
        }

        const nextProfile = toNormalizedProfile(profile);
        const nextProfileFingerprint = toProfileFingerprint(nextProfile);
        if (profileFingerprintRef.current !== nextProfileFingerprint) {
          profileFingerprintRef.current = nextProfileFingerprint;
          setDriverProfile(nextProfile);
        }

        const nextDisplayName = toDisplayName(profileUser, fallbackEmail);
        setDisplayName((prev) => (prev === nextDisplayName ? prev : nextDisplayName));

        const nextOnboardingStatus = toOnboardingStatus(nextProfile);
        setOnboardingStatus((prev) => (
          shallowEqualObject(prev, nextOnboardingStatus) ? prev : nextOnboardingStatus
        ));

        const nextDriverStats = toDriverStats(stats);
        setDriverStats((prev) => (
          shallowEqualObject(prev, nextDriverStats) ? prev : nextDriverStats
        ));

        // Keep profile image refresh outside render loops.
        await actionsRef.current.getProfileImage?.();
      } catch (error) {
        if (cancelled) {
          return;
        }

        logger.error('DriverProfileData', 'Error loading driver profile snapshot', error);
        profileFingerprintRef.current = 'none';
        setDriverProfile((prev) => (prev ? null : prev));
        setOnboardingStatus((prev) => (
          shallowEqualObject(prev, EMPTY_ONBOARDING_STATUS) ? prev : EMPTY_ONBOARDING_STATUS
        ));
        setDriverStats((prev) => (
          shallowEqualObject(prev, EMPTY_DRIVER_STATS) ? prev : EMPTY_DRIVER_STATS
        ));
      }
    };

    void loadDriverProfileSnapshot();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, fallbackEmail]);

  useEffect(() => {
    if (!currentUserId) {
      return undefined;
    }

    return subscribeToDriverProfileUpdates(currentUserId, (realtimeRow) => {
      const nextProfile = toNormalizedProfile(realtimeRow);
      const nextProfileFingerprint = toProfileFingerprint(nextProfile);
      if (profileFingerprintRef.current === nextProfileFingerprint) {
        return;
      }

      profileFingerprintRef.current = nextProfileFingerprint;
      setDriverProfile(nextProfile);

      const nextOnboardingStatus = toOnboardingStatus(nextProfile);
      setOnboardingStatus((prev) => (
        shallowEqualObject(prev, nextOnboardingStatus) ? prev : nextOnboardingStatus
      ));
    });
  }, [currentUserId]);

  return {
    driverProfile,
    displayName,
    onboardingStatus,
    driverStats,
  };
}
