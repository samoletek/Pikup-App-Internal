import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../../services/logger';
import { fetchRemoteOnboardingDraft } from '../../../services/onboardingDraftService';
import {
  getDraftStorageKey,
  mergeFormDataWithDefaults,
  normalizeStep,
  normalizeVerificationStatus,
  pickLatestDraft,
} from '../DriverOnboardingScreen.utils';

const TRANSIENT_VEHICLE_STATUSES = ['uploading', 'verifying'];
const isRlsPermissionError = (error) => {
  const normalizedMessage = String(error?.message || '').toLowerCase();
  const normalizedCode = String(error?.code || '').toUpperCase();
  return (
    normalizedCode === '42501' ||
    normalizedMessage.includes('row-level security policy') ||
    normalizedMessage.includes('permission denied')
  );
};

const hasIdentityPrefill = (formData) => {
  if (!formData || typeof formData !== 'object') {
    return false;
  }

  const firstName = String(formData.firstName || '').trim();
  const lastName = String(formData.lastName || '').trim();
  return Boolean(firstName || lastName);
};

const buildDraftSnapshot = ({
  currentStep,
  verificationStatus,
  verificationDataPopulated,
  vehicleVerificationStatus,
  vinPhotoUri,
  carPhotoUris,
  formData,
}) => ({
  currentStep: normalizeStep(currentStep),
  verificationStatus: normalizeVerificationStatus(verificationStatus),
  verificationDataPopulated,
  vehicleVerificationStatus,
  vinPhotoUri,
  carPhotoUris,
  formData: {
    ...mergeFormDataWithDefaults(formData),
    // Do not persist SSN in local/remote onboarding drafts.
    ssn: '',
  },
});

export default function useOnboardingDraftPersistence({
  userId,
  currentStep,
  verificationStatus,
  verificationDataPopulated,
  vehicleVerificationStatus,
  vinPhotoUri,
  carPhotoUris,
  formData,
  progressAnim,
  stepsLength,
  updateDriverPaymentProfile,
  setCurrentStep,
  setVerificationStatus,
  setFormData,
  setVerificationDataPopulated,
  setVehicleVerificationStatus,
  setVinPhotoUri,
  setCarPhotoUris,
}) {
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const saveTimeoutRef = useRef(null);
  const lastSavedDraftRef = useRef(null);
  const lastRemoteSyncSignatureRef = useRef(null);
  const isRemoteSyncBlockedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateOnboardingDraft = async () => {
      if (!userId) {
        if (isMounted) {
          setIsDraftHydrated(true);
        }
        return;
      }

      try {
        const draftStorageKey = getDraftStorageKey(userId);
        const [storedDraftRaw, remoteDraftResult] = await Promise.all([
          AsyncStorage.getItem(draftStorageKey),
          fetchRemoteOnboardingDraft(userId),
        ]);

        let localDraft = null;
        if (storedDraftRaw) {
          try {
            localDraft = JSON.parse(storedDraftRaw);
          } catch (parseError) {
            logger.error('OnboardingDraftPersistence', 'Failed to parse onboarding draft from storage', parseError);
          }
        }

        const remoteDraft = remoteDraftResult || null;
        const latestDraft = pickLatestDraft(localDraft, remoteDraft);

        if (!latestDraft || !isMounted) {
          return;
        }

        const restoredVerificationStatus = normalizeVerificationStatus(
          latestDraft.verificationStatus
        );
        const restoredStep =
          restoredVerificationStatus === 'completed'
            ? normalizeStep(latestDraft.currentStep)
            : Math.min(normalizeStep(latestDraft.currentStep), 1);
        const restoredFormData = {
          ...mergeFormDataWithDefaults(latestDraft.formData),
          ssn: '',
        };

        setCurrentStep(restoredStep);
        setVerificationStatus(restoredVerificationStatus);
        setFormData(restoredFormData);

        if (latestDraft.verificationDataPopulated && hasIdentityPrefill(restoredFormData)) {
          setVerificationDataPopulated(true);
        } else {
          setVerificationDataPopulated(false);
        }

        if (
          latestDraft.vehicleVerificationStatus &&
          latestDraft.vehicleVerificationStatus !== 'idle'
        ) {
          const restoredVehicleStatus = TRANSIENT_VEHICLE_STATUSES.includes(
            latestDraft.vehicleVerificationStatus
          )
            ? 'idle'
            : latestDraft.vehicleVerificationStatus;
          setVehicleVerificationStatus(restoredVehicleStatus);
        }

        if (latestDraft.vinPhotoUri) {
          setVinPhotoUri(latestDraft.vinPhotoUri);
        }

        if (latestDraft.carPhotoUris) {
          setCarPhotoUris(latestDraft.carPhotoUris);
        } else if (latestDraft.carPhotoUri) {
          setCarPhotoUris([latestDraft.carPhotoUri, null, null]);
        }

        progressAnim.setValue(restoredStep / (stepsLength - 1));

        lastSavedDraftRef.current = JSON.stringify({
          currentStep: restoredStep,
          verificationStatus: restoredVerificationStatus,
          formData: restoredFormData,
        });
        lastRemoteSyncSignatureRef.current = `${restoredStep}:${restoredVerificationStatus}`;
      } catch (error) {
        logger.error('OnboardingDraftPersistence', 'Failed to hydrate onboarding draft', error);
      } finally {
        if (isMounted) {
          setIsDraftHydrated(true);
        }
      }
    };

    hydrateOnboardingDraft();

    return () => {
      isMounted = false;
    };
  }, [
    progressAnim,
    setCarPhotoUris,
    setCurrentStep,
    setFormData,
    setVerificationDataPopulated,
    setVerificationStatus,
    setVehicleVerificationStatus,
    setVinPhotoUri,
    stepsLength,
    userId,
  ]);

  useEffect(() => {
    if (!isDraftHydrated || !userId) {
      return undefined;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const draftSnapshot = buildDraftSnapshot({
        currentStep,
        verificationStatus,
        verificationDataPopulated,
        vehicleVerificationStatus,
        vinPhotoUri,
        carPhotoUris,
        formData,
      });
      const draftSnapshotString = JSON.stringify(draftSnapshot);

      if (draftSnapshotString === lastSavedDraftRef.current) {
        return;
      }

      lastSavedDraftRef.current = draftSnapshotString;

      const draftPayload = {
        ...draftSnapshot,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const draftStorageKey = getDraftStorageKey(userId);

      try {
        await AsyncStorage.setItem(draftStorageKey, JSON.stringify(draftPayload));
      } catch (error) {
        logger.error('OnboardingDraftPersistence', 'Failed to persist onboarding draft locally', error);
      }

      const remoteSyncSignature = `${draftSnapshot.currentStep}:${draftSnapshot.verificationStatus}`;
      if (remoteSyncSignature === lastRemoteSyncSignatureRef.current) {
        return;
      }

      if (isRemoteSyncBlockedRef.current) {
        return;
      }

      try {
        await updateDriverPaymentProfile?.(userId, {
          onboardingStep: draftSnapshot.currentStep,
          onboardingDraft: draftPayload,
          onboardingLastSavedAt: draftPayload.updatedAt,
        });
        lastRemoteSyncSignatureRef.current = remoteSyncSignature;
      } catch (error) {
        if (isRlsPermissionError(error)) {
          isRemoteSyncBlockedRef.current = true;
          logger.warn(
            'OnboardingDraftPersistence',
            'Remote onboarding draft sync disabled due RLS policy; local draft persistence continues',
            error
          );
          return;
        }
        logger.error('OnboardingDraftPersistence', 'Failed to sync onboarding draft with Supabase', error);
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    carPhotoUris,
    currentStep,
    formData,
    isDraftHydrated,
    updateDriverPaymentProfile,
    userId,
    verificationDataPopulated,
    verificationStatus,
    vehicleVerificationStatus,
    vinPhotoUri,
  ]);

  return {
    isDraftHydrated,
  };
}
