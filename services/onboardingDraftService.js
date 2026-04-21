import { logger } from './logger';
import { fetchProfileByTableAndUserId } from './repositories/authRepository';
import { normalizeError } from './errorService';

const hasIdentityPrefill = (formData) => {
  if (!formData || typeof formData !== 'object') {
    return false;
  }

  const firstName = String(formData.firstName || '').trim();
  const lastName = String(formData.lastName || '').trim();
  return Boolean(firstName && lastName);
};

export const fetchRemoteOnboardingDraft = async (userId) => {
  if (!userId) {
    return null;
  }

  try {
    const { data, error } = await fetchProfileByTableAndUserId('drivers', userId, {
      columns: 'metadata, identity_verified, first_name, last_name',
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

    const metadataIdentityStatus = String(metadata?.identityVerificationStatus || '')
      .trim()
      .toLowerCase();
    const identityVerified = Boolean(
      data?.identity_verified ||
      metadataIdentityStatus === 'completed' ||
      metadata?.documentsVerified
    );
    const identityProcessing = (
      metadataIdentityStatus === 'processing' ||
      metadataIdentityStatus === 'under_review'
    );

    if (metadata?.onboardingDraft && typeof metadata.onboardingDraft === 'object') {
      const draft = {
        ...metadata.onboardingDraft,
      };
      const draftFormData = draft?.formData && typeof draft.formData === 'object'
        ? { ...draft.formData }
        : {};
      const profileFirstName = String(data?.first_name || '').trim();
      const profileLastName = String(data?.last_name || '').trim();
      if (!String(draftFormData.firstName || '').trim() && profileFirstName) {
        draftFormData.firstName = profileFirstName;
      }
      if (!String(draftFormData.lastName || '').trim() && profileLastName) {
        draftFormData.lastName = profileLastName;
      }
      draft.formData = draftFormData;

      const hasPrefill = hasIdentityPrefill(draftFormData);

      if (identityVerified) {
        draft.verificationStatus = 'completed';
        draft.verificationDataPopulated = Boolean(hasPrefill);
      } else if (identityProcessing) {
        draft.verificationStatus = 'processing';
      }

      return draft;
    }

    const fallbackStep = Number(metadata?.onboardingStep);
    if (!Number.isFinite(fallbackStep)) {
      return null;
    }

    return {
      currentStep: Math.max(0, Math.floor(fallbackStep)),
      verificationStatus: identityVerified ? 'completed' : (identityProcessing ? 'processing' : 'pending'),
      verificationDataPopulated: false,
      formData: null,
      updatedAt: metadata?.onboardingLastSavedAt || null,
    };
  } catch (error) {
    const normalized = normalizeError(error, 'Failed to fetch onboarding draft');
    logger.warn('OnboardingDraftService', 'Failed to fetch remote onboarding draft', normalized, error);
    return null;
  }
};
