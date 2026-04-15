import { normalizeDriverBadgeStats } from './driverProfileUtils';
import { logger } from './logger';
import { normalizeError } from './errorService';
import { fetchDriverRowById } from './repositories/paymentRepository';
import { refreshAuthenticatedSession } from './repositories/authRepository';
import { extractDriverPreferencesFromDriverProfile } from './driverPreferencesColumns';
import {
  createRealtimeChannel,
  removeRealtimeChannel,
} from './repositories/messagingRepository';

const DRIVER_READINESS_COLUMNS = 'phone_verified, onboarding_complete, can_receive_payments, identity_verified, metadata';

const isAuthOrSessionError = (error) => {
  if (!error) {
    return false;
  }

  const statusCode = Number(error?.status || error?.code || 0);
  if (statusCode === 401) {
    return true;
  }

  const normalizedCode = String(error?.code || '').trim().toUpperCase();
  if (normalizedCode === 'PGRST301' || normalizedCode === '42501') {
    return true;
  }

  const normalizedText = String(error?.message || error?.details || '').trim().toLowerCase();
  return (
    normalizedText.includes('jwt') ||
    normalizedText.includes('token') ||
    normalizedText.includes('auth') ||
    normalizedText.includes('permission denied')
  );
};

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
    let { data: profile, error } = await fetchDriverRowById(
      driverId,
      DRIVER_READINESS_COLUMNS,
      true
    );

    if (error && isAuthOrSessionError(error)) {
      const { data: refreshedSessionData, error: refreshError } = await refreshAuthenticatedSession();
      if (!refreshError && refreshedSessionData?.session?.access_token) {
        const retryResult = await fetchDriverRowById(
          driverId,
          DRIVER_READINESS_COLUMNS,
          true
        );
        profile = retryResult?.data || null;
        error = retryResult?.error || null;
      }
    }

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
    const canReceivePayments = Boolean(
      profile?.can_receive_payments ??
      metadata?.canReceivePayments ??
      false
    );
    const phoneVerified = Boolean(profile?.phone_verified ?? false);

    const issues = [];
    if (!phoneVerified) issues.push('phone');
    if (!onboardingComplete) issues.push('vehicle');
    if (!identityVerified) issues.push('identity');
    if (!canReceivePayments) issues.push('payment');

    return {
      ready: issues.length === 0,
      issues,
      profile: {
        ...profile,
        metadata,
        onboarding_complete: onboardingComplete,
        can_receive_payments: canReceivePayments,
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
