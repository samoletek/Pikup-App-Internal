import { logger } from './logger';
import { fetchProfileByTableAndUserId } from './repositories/authRepository';
import { normalizeError } from './errorService';

export const fetchRemoteOnboardingDraft = async (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await fetchProfileByTableAndUserId('drivers', userId, {
      columns: 'metadata',
      maybeSingle: true,
    });

    if (error) {
      throw error;
    }

    return data?.metadata?.onboardingDraft || null;
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch onboarding draft');
    logger.warn('OnboardingDraftService', 'Failed to fetch remote onboarding draft', normalized, error);
    return null;
  }
};
