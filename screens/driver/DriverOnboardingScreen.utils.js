import {
  initialFormData,
  ONBOARDING_DRAFT_STORAGE_PREFIX,
  VALID_VERIFICATION_STATUSES,
  steps,
} from './DriverOnboardingScreen.constants';

export const formatName = (text) => text.replace(/[^a-zA-Z\s-]/g, '');

export const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const formatDateOfBirth = (value) => {
  if (!value) return value;
  const dob = value.replace(/[^\d]/g, '');
  const dobLength = dob.length;
  if (dobLength < 3) return dob;
  if (dobLength < 5) {
    return `${dob.slice(0, 2)}/${dob.slice(2)}`;
  }
  return `${dob.slice(0, 2)}/${dob.slice(2, 4)}/${dob.slice(4, 8)}`;
};

export const formatZipCode = (value) => value.replace(/[^\d]/g, '').slice(0, 5);
export const formatYear = (value) => value.replace(/[^\d]/g, '').slice(0, 4);
export const formatLicensePlate = (value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const getDraftStorageKey = (userId) => `${ONBOARDING_DRAFT_STORAGE_PREFIX}:${userId}`;

export const normalizeStep = (value) => {
  const parsedStep = Number(value);
  if (!Number.isFinite(parsedStep)) {
    return 0;
  }
  return Math.max(0, Math.min(steps.length - 1, Math.floor(parsedStep)));
};

export const normalizeVerificationStatus = (value) => {
  if (VALID_VERIFICATION_STATUSES.includes(value)) {
    return value;
  }
  return 'pending';
};

export const mergeFormDataWithDefaults = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return initialFormData;
  }

  return {
    ...initialFormData,
    ...candidate,
    address: {
      ...initialFormData.address,
      ...(candidate.address || {}),
    },
    vehicleInfo: {
      ...initialFormData.vehicleInfo,
      ...(candidate.vehicleInfo || {}),
    },
  };
};

export const getDraftTimestamp = (draft) => {
  const raw = draft?.updatedAt || draft?.savedAt || draft?.updated_at;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const pickLatestDraft = (localDraft, remoteDraft) => {
  if (!localDraft) return remoteDraft || null;
  if (!remoteDraft) return localDraft;
  return getDraftTimestamp(remoteDraft) > getDraftTimestamp(localDraft)
    ? remoteDraft
    : localDraft;
};
