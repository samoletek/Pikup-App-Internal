import { normalizeDriverBadgeStats } from './driverProfileUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { fetchDriverRowById } from './repositories/paymentRepository';
import { extractDriverPreferencesFromDriverProfile } from './driverPreferencesColumns';
import {
  createRealtimeChannel,
  removeRealtimeChannel,
} from './repositories/messagingRepository';

export const getDriverProfile = async (driverId) => {
  try {
    const { data, error } = await fetchDriverRowById(driverId, '*', false);

    if (error) return null;

    const metadata = data?.metadata || {};
    const onboardingComplete =
      data?.onboarding_complete ??
      metadata?.onboardingComplete ??
      false;
    const canReceivePayments =
      data?.can_receive_payments ??
      metadata?.canReceivePayments ??
      false;
    const connectAccountId =
      data?.stripe_account_id ||
      metadata?.connectAccountId ||
      null;
    const documentsVerified =
      metadata?.documentsVerified ??
      false;
    const badgeStats = normalizeDriverBadgeStats(
      data?.badge_stats || metadata?.badge_stats
    );
    const ratingCount = Number.isFinite(Number(data?.rating_count))
      ? Number(data.rating_count)
      : 0;
    const driverPreferences = extractDriverPreferencesFromDriverProfile(data);

    return {
      ...data,
      metadata,
      badge_stats: badgeStats,
      rating_count: ratingCount,
      driverPreferences,
      onboardingComplete,
      canReceivePayments,
      connectAccountId,
      documentsVerified,
      driverProfile: {
        ...metadata,
        badge_stats: badgeStats,
        rating_count: ratingCount,
        driverPreferences,
        onboardingComplete,
        canReceivePayments,
        connectAccountId,
        documentsVerified,
        email: data.email,
      },
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to load driver profile');
    logger.error('DriverProfileService', 'Error getting driver profile', normalized, error);
    return null;
  }
};

export const getDriverReadinessProfile = async (driverId) => {
  if (!driverId) {
    return { ready: false, issues: ['Not authenticated'], profile: null };
  }

  try {
    const { data: profile, error } = await fetchDriverRowById(
      driverId,
      'phone_verified, onboarding_complete, identity_verified, metadata',
      true
    );

    if (error || !profile) {
      return { ready: false, issues: ['Could not load profile'], profile: null };
    }

    const metadata =
      profile?.metadata &&
      typeof profile.metadata === 'object' &&
      !Array.isArray(profile.metadata)
        ? profile.metadata
        : {};

    const onboardingComplete = Boolean(
      profile?.onboarding_complete ??
      metadata?.onboardingComplete ??
      false
    );
    const identityVerified = Boolean(
      profile?.identity_verified ??
      metadata?.documentsVerified ??
      false
    );
    const phoneVerified = Boolean(profile?.phone_verified ?? false);

    const issues = [];
    if (!phoneVerified) issues.push('phone');
    if (!onboardingComplete) issues.push('vehicle');
    if (!identityVerified) issues.push('identity');

    return {
      ready: issues.length === 0,
      issues,
      profile: {
        ...profile,
        metadata,
        onboarding_complete: onboardingComplete,
        identity_verified: identityVerified,
        phone_verified: phoneVerified,
      },
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to check driver readiness');
    logger.error('DriverProfileService', 'Error checking driver readiness', normalized, error);
    return { ready: false, issues: ['Could not load profile'], profile: null };
  }
};

export const subscribeToDriverProfileUpdates = (driverId, onProfileUpdate) => {
  if (!driverId) {
    return () => {};
  }

  const channel = createRealtimeChannel(`driver:profile:${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'drivers',
        filter: `id=eq.${driverId}`,
      },
      (payload) => {
        const nextProfile = payload?.new;
        if (!nextProfile) return;
        onProfileUpdate?.(nextProfile);
      }
    )
    .subscribe();

  return () => {
    removeRealtimeChannel(channel);
  };
};
