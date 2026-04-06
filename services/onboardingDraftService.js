import { logger } from './logger';
import { fetchProfileByTableAndUserId } from './repositories/authRepository';
import { normalizeError } from './errorService';

export const fetchRemoteOnboardingDraft = async (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await fetchProfileByTableAndUserId('drivers', userId, {
      columns: 'metadata, identity_verified',
      maybeSingle: true,
    });

    if (error) {
      throw error;
    }

    const metadata =
      data?.metadata &&
      typeof data.metadata === 'object' &&
      !Array.isArray(data.metadata)
        ? data.metadata
        : {};

    if (metadata?.onboardingDraft) {
      return metadata.onboardingDraft;
    }

    const fallbackStep = Number(metadata?.onboardingStep);
    if (!Number.isFinite(fallbackStep)) {
      return null;
    }

    const identityVerified = Boolean(
      data?.identity_verified ||
      metadata?.identityVerificationStatus === 'completed' ||
      metadata?.documentsVerified
    );

    return {
      currentStep: Math.max(0, Math.floor(fallbackStep)),
      verificationStatus: identityVerified ? 'completed' : 'pending',
      verificationDataPopulated: identityVerified,
      formData: null,
      updatedAt: metadata?.onboardingLastSavedAt || null,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch onboarding draft');
    logger.warn('OnboardingDraftService', 'Failed to fetch remote onboarding draft', normalized, error);
    return null;
  }
};
