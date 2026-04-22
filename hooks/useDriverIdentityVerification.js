import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform } from 'react-native';
import { useStripeIdentity } from '@stripe/stripe-identity-react-native';
import { appConfig } from '../config/appConfig';
import { logger } from '../services/logger';
import {
  createVerificationSession,
  getVerificationData,
  markDriverIdentityVerified,
} from '../services/payment/verification';

const RETRYABLE_VERIFICATION_STATUSES = new Set([
  'processing',
  'under_review',
]);
const RETRYABLE_HTTP_STATUSES = new Set([401, 408, 409, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_MESSAGE_FRAGMENTS = [
  'network',
  'timeout',
  'timed out',
  'fetch failed',
  'temporar',
  'unavailable',
  'connection',
  'econn',
  'socket',
  'rate limit',
];

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const extractResponsePayload = async (response) => {
  if (!response) {
    return null;
  }

  try {
    if (typeof response.clone === 'function') {
      return await response.clone().json();
    }

    if (typeof response.json === 'function') {
      return await response.json();
    }
  } catch (_parseError) {
    return null;
  }

  return null;
};

export default function useDriverIdentityVerification({ currentUser, setFormData, refreshProfile }) {
  const asRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  };

  const resolvePersistedSessionId = () => String(currentUser?.verification_session_id || '').trim();
  const hasPersistedSessionId = () => Boolean(resolvePersistedSessionId());
  const resolveMetadataIdentityStatus = () => {
    const metadataStatus = String(currentUser?.metadata?.identityVerificationStatus || '')
      .trim()
      .toLowerCase();
    const draftStatus = String(currentUser?.metadata?.onboardingDraft?.verificationStatus || '')
      .trim()
      .toLowerCase();
    const resolved = metadataStatus || draftStatus;

    if (resolved === 'requires_input' || resolved === 'rejected' || resolved === 'declined') {
      return 'failed';
    }

    return resolved;
  };

  const resolveInitialVerificationStatus = () => {
    const metadataStatus = resolveMetadataIdentityStatus();
    const isIdentityVerified = Boolean(currentUser?.identity_verified || metadataStatus === 'completed');
    if (isIdentityVerified) {
      return 'completed';
    }

    if ((metadataStatus === 'processing' || metadataStatus === 'under_review') && hasPersistedSessionId()) {
      return 'processing';
    }

    if (metadataStatus === 'failed') {
      return 'failed';
    }

    return 'pending';
  };

  const [verificationSessionId, setVerificationSessionId] = useState(null);
  const verificationSessionIdRef = useRef(null);
  const handledFlowCompletedSessionRef = useRef(null);
  const handledFlowCanceledSessionRef = useRef(null);
  const handledFlowFailedSessionRef = useRef(null);
  const [verificationStatus, setVerificationStatus] = useState(resolveInitialVerificationStatus);
  const [isLoadingVerificationData, setIsLoadingVerificationData] = useState(false);
  const [verificationDataPopulated, setVerificationDataPopulated] = useState(false);
  const [isCheckingVerificationStatus, setIsCheckingVerificationStatus] = useState(false);

  const resolveIdentityPrefillFromUser = (sourceUser = currentUser) => {
    const metadata = asRecord(sourceUser?.metadata);
    const onboardingDraft = asRecord(metadata.onboardingDraft);
    const draftFormData = asRecord(onboardingDraft.formData);
    const draftAddress = asRecord(draftFormData.address);

    const firstName = String(
      draftFormData.firstName ||
      sourceUser?.first_name ||
      sourceUser?.firstName ||
      ''
    ).trim();
    const lastName = String(
      draftFormData.lastName ||
      sourceUser?.last_name ||
      sourceUser?.lastName ||
      ''
    ).trim();
    const dateOfBirth = String(
      draftFormData.dateOfBirth ||
      sourceUser?.date_of_birth ||
      sourceUser?.dateOfBirth ||
      ''
    ).trim();
    const address = {
      line1: String(draftAddress.line1 || '').trim(),
      city: String(draftAddress.city || '').trim(),
      state: String(draftAddress.state || '').trim(),
      postalCode: String(draftAddress.postalCode || '').trim(),
    };
    const hasIdentityNamePrefill = Boolean(firstName && lastName);

    return {
      firstName,
      lastName,
      dateOfBirth,
      address,
      hasIdentityNamePrefill,
    };
  };

  const applyIdentityPrefill = (prefill, reason = 'unknown') => {
    if (!prefill || typeof prefill !== 'object') {
      return false;
    }

    const fallbackFirstName = String(prefill.firstName || '').trim();
    const fallbackLastName = String(prefill.lastName || '').trim();
    const fallbackDateOfBirth = String(prefill.dateOfBirth || '').trim();
    const fallbackAddress = {
      line1: String(prefill.address?.line1 || '').trim(),
      city: String(prefill.address?.city || '').trim(),
      state: String(prefill.address?.state || '').trim(),
      postalCode: String(prefill.address?.postalCode || '').trim(),
    };
    const hasIdentityNamePrefill = Boolean(prefill.hasIdentityNamePrefill);

    setFormData((prev) => {
      const previous = prev || {};
      const previousAddress = previous.address || {};
      return {
        ...previous,
        firstName: previous.firstName || fallbackFirstName,
        lastName: previous.lastName || fallbackLastName,
        dateOfBirth: previous.dateOfBirth || fallbackDateOfBirth,
        address: {
          ...previousAddress,
          line1: previousAddress.line1 || fallbackAddress.line1,
          city: previousAddress.city || fallbackAddress.city,
          state: previousAddress.state || fallbackAddress.state,
          postalCode: previousAddress.postalCode || fallbackAddress.postalCode,
        },
      };
    });

    setVerificationDataPopulated((previouslyPopulated) => {
      if (!previouslyPopulated) {
        logger.warn('DriverIdentityVerification', 'Identity verification fallback unlocked onboarding step', {
          reason,
          hasFirstName: Boolean(fallbackFirstName),
          hasLastName: Boolean(fallbackLastName),
          hasIdentityNamePrefill,
          hasDateOfBirth: Boolean(fallbackDateOfBirth),
          hasAddress: Boolean(
            fallbackAddress.line1 ||
            fallbackAddress.city ||
            fallbackAddress.state ||
            fallbackAddress.postalCode
          ),
        });
      }
      return previouslyPopulated || hasIdentityNamePrefill;
    });

    return hasIdentityNamePrefill;
  };

  const applyPersistedIdentityFallback = (reason = 'unknown') => {
    const prefill = resolveIdentityPrefillFromUser(currentUser);
    return applyIdentityPrefill(prefill, reason);
  };

  useEffect(() => {
    const persistedSessionId = String(currentUser?.verification_session_id || '').trim();
    if (!persistedSessionId) {
      return;
    }

    if (verificationSessionIdRef.current === persistedSessionId) {
      return;
    }

    verificationSessionIdRef.current = persistedSessionId;
    setVerificationSessionId(persistedSessionId);
  }, [currentUser?.verification_session_id]);

  const resolveIdentityBrandLogo = () => {
    // Android identity SDK in this version is unstable with bundled asset URIs.
    // Provide a stable HTTPS logo source to avoid native crashes when opening the sheet.
    if (Platform.OS === 'android') {
      const remoteLogoUrl = String(
        appConfig?.stripe?.identityBrandLogoUrl || 'https://pikup-app.com/favicon.png'
      ).trim();

      if (remoteLogoUrl) {
        return { uri: remoteLogoUrl };
      }
    }

    return Image.resolveAssetSource(require('../assets/pikup-logo.png'));
  };

  const fetchVerificationSessionParams = async () => {
    try {
      logger.info('DriverIdentityVerification', 'Fetching verification session params via Edge Function');
      if (!currentUser?.uid && !currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const data = await createVerificationSession({}, currentUser);

      if (!data?.id || !data?.client_secret) {
        logger.error('DriverIdentityVerification', 'Invalid data returned', data);
        throw new Error(`Invalid verification session data returned: ${JSON.stringify(data)}`);
      }

      logger.info('DriverIdentityVerification', 'Verification session received', { sessionId: data.id });
      setVerificationSessionId(data.id);
      verificationSessionIdRef.current = data.id;
      handledFlowCompletedSessionRef.current = null;
      handledFlowCanceledSessionRef.current = null;
      handledFlowFailedSessionRef.current = null;

      if (!data.ephemeral_key_secret) {
        logger.error('DriverIdentityVerification', 'MISSING ephemeral_key_secret in response', data);
        throw new Error('Missing ephemeral key secret for Stripe Identity');
      }

      const logo = resolveIdentityBrandLogo();

      return {
        sessionId: data.id,
        ephemeralKeySecret: data.ephemeral_key_secret,
        brandLogo: logo,
      };
    } catch (error) {
      logger.error('DriverIdentityVerification', 'Error fetching verification params', error);
      Alert.alert('Verification Error', 'Could not initialize verification. Please try again.');
      throw error;
    }
  };

  const persistVerifiedIdentity = async (sessionId, originLabel) => {
    setVerificationStatus('completed');
    try {
      await markDriverIdentityVerified({
        currentUser,
        verificationSessionId: sessionId,
      });
      logger.info('DriverIdentityVerification', 'Driver verification status saved to DB', {
        sessionId,
        origin: originLabel,
      });
      await refreshProfile?.();
    } catch (error) {
      logger.error('DriverIdentityVerification', 'Failed to update driver verification status', {
        sessionId,
        origin: originLabel,
        error,
      });
    }
  };

  const fetchVerificationData = async (sessionId, retryCount = 0, options = {}) => {
    const {
      maxRetries = 10,
      retryDelayMs = 4000,
      suppressLoader = false,
      origin = 'manual-check',
    } = options;
    const setLoader = (value) => {
      if (!suppressLoader) {
        setIsLoadingVerificationData(value);
      }
    };

    try {
      setLoader(true);

      let data = null;
      try {
        data = await getVerificationData(sessionId, currentUser);
      } catch (error) {
        let errorStatus = null;
        let httpStatus = null;
        let errorMessage = '';
        const response = error?.context;
        if (response) {
          httpStatus = Number(response?.status || 0) || null;
          try {
            const errorPayload = await extractResponsePayload(response);
            errorStatus = errorPayload?.status || null;
            errorMessage = String(errorPayload?.error || errorPayload?.message || '').trim().toLowerCase();
          } catch (parseError) {
            logger.warn('DriverIdentityVerification', 'Failed to parse verification error payload', parseError);
          }
        }
        if (!errorMessage && error?.message) {
          errorMessage = String(error.message).trim().toLowerCase();
        }

        const normalizedStatus = String(errorStatus || '').trim().toLowerCase() || null;
        const isRetryableStatus = normalizedStatus
          ? RETRYABLE_VERIFICATION_STATUSES.has(normalizedStatus)
          : false;
        const isRetryableHttp = Boolean(httpStatus && RETRYABLE_HTTP_STATUSES.has(httpStatus));
        const isRetryableTransientMessage = TRANSIENT_ERROR_MESSAGE_FRAGMENTS.some((fragment) =>
          errorMessage.includes(fragment)
        );

        const isRetryableUnauthorized400 =
          httpStatus === 400 &&
          (errorMessage.includes('unauthorized') || errorMessage.includes('jwt'));

        const isExpectedVerificationState =
          normalizedStatus === 'requires_input' ||
          normalizedStatus === 'canceled' ||
          normalizedStatus === 'pending' ||
          isRetryableStatus;

        if (isExpectedVerificationState) {
          logger.info('DriverIdentityVerification', 'Verification data request returned expected non-final status', {
            httpStatus,
            errorStatus: normalizedStatus,
            errorMessage,
            origin,
          });
        } else {
          logger.warn('DriverIdentityVerification', 'Unexpected verification data response', {
            httpStatus,
            errorStatus: normalizedStatus,
            errorMessage,
            origin,
          });
        }

        if (
          (isRetryableHttp || isRetryableUnauthorized400 || isRetryableStatus || isRetryableTransientMessage) &&
          retryCount < maxRetries
        ) {
          logger.warn('DriverIdentityVerification', 'Verification data request is transient, retrying', {
            httpStatus,
            errorStatus: normalizedStatus,
            errorMessage,
            retryInSeconds: retryDelayMs / 1000,
            origin,
            attempt: retryCount + 1,
            maxRetries,
          });
          await wait(retryDelayMs);
          return fetchVerificationData(sessionId, retryCount + 1, options);
        }

        const fallbackStatus = (
          normalizedStatus === 'requires_input'
            ? 'failed'
            : normalizedStatus
        ) || (
          isRetryableHttp || isRetryableUnauthorized400 || isRetryableTransientMessage
            ? 'processing'
            : 'error'
        );
        setLoader(false);
        return { verified: false, status: fallbackStatus };
      }

      const normalizedStatus = String(data?.status || '').trim().toLowerCase();

      if (normalizedStatus && RETRYABLE_VERIFICATION_STATUSES.has(normalizedStatus) && retryCount < maxRetries) {
        logger.info('DriverIdentityVerification', 'Verification processing, retrying', {
          status: normalizedStatus,
          retryInSeconds: retryDelayMs / 1000,
          origin,
          attempt: retryCount + 1,
          maxRetries,
        });
        await wait(retryDelayMs);
        return fetchVerificationData(sessionId, retryCount + 1, options);
      }

      if (normalizedStatus && RETRYABLE_VERIFICATION_STATUSES.has(normalizedStatus)) {
        setLoader(false);
        return { verified: false, status: normalizedStatus };
      }

      if (normalizedStatus === 'requires_input') {
        const hasAttemptedVerification = Boolean(
          data?.hasAttemptedVerification ||
          data?.lastError ||
          data?.lastVerificationReport
        );
        setLoader(false);
        return {
          verified: false,
          status: hasAttemptedVerification ? 'failed' : 'pending',
        };
      }

      if (normalizedStatus && normalizedStatus !== 'verified') {
        setLoader(false);
        return { verified: false, status: normalizedStatus };
      }

      if (!data || data.error) {
        logger.info('DriverIdentityVerification', 'Verification data not available');
        setLoader(false);
        return { verified: false, status: 'error' };
      }

      const payloadFirstName = String(data.firstName || '').trim();
      const payloadLastName = String(data.lastName || '').trim();
      const metadata = asRecord(currentUser?.metadata);
      const onboardingDraft = asRecord(metadata.onboardingDraft);
      const draftFormData = asRecord(onboardingDraft.formData);
      const fallbackFirstName = String(
        payloadFirstName ||
        draftFormData.firstName ||
        currentUser?.first_name ||
        currentUser?.firstName ||
        ''
      ).trim();
      const fallbackLastName = String(
        payloadLastName ||
        draftFormData.lastName ||
        currentUser?.last_name ||
        currentUser?.lastName ||
        ''
      ).trim();
      const hasIdentityNamePrefill = Boolean(fallbackFirstName && fallbackLastName);

      setFormData((prev) => {
        const updated = { ...prev };

        if (fallbackFirstName && !prev.firstName) updated.firstName = fallbackFirstName;
        if (fallbackLastName && !prev.lastName) updated.lastName = fallbackLastName;
        if (data.address) {
          updated.address = {
            ...prev.address,
            line1: data.address.line1 || prev.address.line1,
            city: data.address.city || prev.address.city,
            state: data.address.state || prev.address.state,
            postalCode: data.address.postalCode || prev.address.postalCode,
          };
        }

        return updated;
      });

      setVerificationDataPopulated((previouslyPopulated) => (
        previouslyPopulated || hasIdentityNamePrefill
      ));
      setLoader(false);
      return { verified: true, status: 'verified' };
    } catch (error) {
      logger.warn('DriverIdentityVerification', 'Failed to fetch verification data', error);
      setLoader(false);
      return { verified: false, status: 'error' };
    }
  };

  const {
    status,
    error: identityError,
    present,
    loading: identityLoading,
  } = useStripeIdentity(fetchVerificationSessionParams);

  const startIdentityVerification = async () => {
    try {
      setVerificationStatus('pending');
      await present();
    } catch (error) {
      logger.error('DriverIdentityVerification', 'Failed to present Stripe identity sheet', error);
      Alert.alert(
        'Verification Error',
        'Could not open identity verification right now. Please try again.'
      );
    }
  };

  const hydrateVerifiedIdentityFromProfile = async ({
    maxAttempts = 4,
    retryDelayMs = 1200,
  } = {}) => {
    if (!currentUser) {
      return { success: false, reason: 'unauthenticated' };
    }

    setIsLoadingVerificationData(true);
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        let profileCandidate = currentUser;
        if (typeof refreshProfile === 'function') {
          try {
            const refreshedProfile = await refreshProfile();
            if (refreshedProfile) {
              profileCandidate = refreshedProfile;
            }
          } catch (refreshError) {
            logger.warn('DriverIdentityVerification', 'Failed to refresh profile while hydrating verified identity data', {
              attempt: attempt + 1,
              maxAttempts,
              error: refreshError,
            });
          }
        }

        const prefill = resolveIdentityPrefillFromUser(profileCandidate || currentUser);
        const hasPrefill = applyIdentityPrefill(prefill, 'continue-button');
        if (hasPrefill) {
          return { success: true };
        }

        if (attempt < maxAttempts - 1) {
          await wait(retryDelayMs);
        }
      }

      return { success: false, reason: 'missing_prefill' };
    } finally {
      setIsLoadingVerificationData(false);
    }
  };

  const checkVerificationStatusNow = async ({ showAlert = true } = {}) => {
    let activeSessionId = (
      verificationSessionIdRef.current ||
      verificationSessionId ||
      resolvePersistedSessionId()
    );

    if (!activeSessionId && typeof refreshProfile === 'function') {
      try {
        const refreshedProfile = await refreshProfile();
        const refreshedSessionId = String(refreshedProfile?.verification_session_id || '').trim();
        if (refreshedSessionId) {
          verificationSessionIdRef.current = refreshedSessionId;
          setVerificationSessionId(refreshedSessionId);
          activeSessionId = refreshedSessionId;
        }
      } catch (refreshError) {
        logger.warn('DriverIdentityVerification', 'Failed to refresh profile before manual status check', refreshError);
      }
    }

    if (!activeSessionId || !currentUser) {
      const persistedIdentityStatus = resolveMetadataIdentityStatus();
      if (persistedIdentityStatus === 'completed' || currentUser?.identity_verified) {
        setVerificationStatus('completed');
        applyPersistedIdentityFallback('manual-status-check-missing-session');
        if (showAlert) {
          Alert.alert('Verification Complete', 'Your identity is verified. You can continue onboarding.');
        }
        return { verified: true, status: 'verified' };
      }

      if (persistedIdentityStatus === 'failed') {
        setVerificationStatus('failed');
        if (showAlert) {
          Alert.alert(
            'Verification Failed',
            'Stripe rejected your previous submission. Please tap Try Again.'
          );
        }
        return { verified: false, status: 'failed' };
      }

      if (verificationStatus === 'processing') {
        setVerificationStatus('pending');
      }
      if (showAlert) {
        Alert.alert(
          'No Active Verification',
          'No active Stripe verification session was found. You can start verification again now.'
        );
      }
      return { verified: false, status: 'pending' };
    }

    setIsCheckingVerificationStatus(true);
    try {
      const result = await fetchVerificationData(activeSessionId, 0, {
        maxRetries: 2,
        retryDelayMs: 3000,
        origin: 'manual-status-check',
      });

      if (result?.verified) {
        await persistVerifiedIdentity(activeSessionId, 'manual-status-check');
        if (showAlert) {
          Alert.alert('Verification Complete', 'Your verified information is now loaded.');
        }
        return result;
      }

      const resultStatus = String(result?.status || '').trim().toLowerCase();
      if (resultStatus === 'processing' || resultStatus === 'under_review') {
        setVerificationStatus('processing');
        return result;
      }

      if (resultStatus === 'canceled' || resultStatus === 'requires_input' || resultStatus === 'pending') {
        const shouldMarkRejected = resultStatus === 'requires_input';
        setVerificationStatus(shouldMarkRejected ? 'failed' : 'pending');
        if (showAlert) {
          if (shouldMarkRejected) {
            Alert.alert(
              'Verification Failed',
              'Stripe rejected this submission. Please tap Try Again and submit clearer photos.'
            );
          } else {
            Alert.alert(
              'Verification Not Submitted',
              'No completed submission was found. You can start verification again now.'
            );
          }
        }
        return result;
      }

      if (resultStatus === 'error') {
        setVerificationStatus('processing');
        return result;
      }

      setVerificationStatus('failed');
      if (showAlert) {
        Alert.alert(
          'Verification Failed',
          'Your identity verification was not approved. Contact support or visit pikup-app.com.'
        );
      }
      return result;
    } finally {
      setIsCheckingVerificationStatus(false);
    }
  };

  useEffect(() => {
    const metadataIdentityStatus = String(currentUser?.metadata?.identityVerificationStatus || '')
      .trim()
      .toLowerCase();
    const draftVerificationStatus = String(currentUser?.metadata?.onboardingDraft?.verificationStatus || '')
      .trim()
      .toLowerCase();
    const metadataStatus = (
      metadataIdentityStatus === 'requires_input' ||
      metadataIdentityStatus === 'rejected' ||
      metadataIdentityStatus === 'declined'
    )
      ? 'failed'
      : (
        metadataIdentityStatus ||
        (draftVerificationStatus === 'requires_input' ? 'failed' : draftVerificationStatus)
      );
    const persistedSessionId = String(currentUser?.verification_session_id || '').trim();
    const hasSessionId = Boolean(persistedSessionId);
    if (!currentUser?.identity_verified && metadataStatus !== 'completed') {
      if (
        (metadataStatus === 'processing' || metadataStatus === 'under_review') &&
        hasSessionId
      ) {
        setVerificationStatus('processing');
      } else if (metadataStatus === 'failed') {
        setVerificationStatus('failed');
      } else if (metadataStatus === 'canceled') {
        setVerificationStatus('pending');
      } else {
        setVerificationStatus('pending');
      }
      return;
    }

    setVerificationStatus((prev) => (prev === 'completed' ? prev : 'completed'));
  }, [
    currentUser?.identity_verified,
    currentUser?.metadata?.identityVerificationStatus,
    currentUser?.metadata?.onboardingDraft?.verificationStatus,
    currentUser?.verification_session_id,
  ]);

  useEffect(() => {
    logger.info('DriverIdentityVerification', 'Stripe Identity status changed', { status });

    if (status === 'FlowCompleted') {
      const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
      if (activeSessionId && handledFlowCompletedSessionRef.current === activeSessionId) {
        logger.info('DriverIdentityVerification', 'FlowCompleted already processed for session', {
          sessionId: activeSessionId,
        });
        return;
      }

      if (activeSessionId) {
        handledFlowCompletedSessionRef.current = activeSessionId;
      }

      const finalizeIdentityVerification = async () => {
        const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
        if (!activeSessionId || !currentUser) {
          setVerificationStatus('failed');
          return;
        }

        const verificationResult = await fetchVerificationData(activeSessionId, 0, {
          maxRetries: 10,
          retryDelayMs: 4000,
          origin: 'flow-completed',
        });
        const latestSessionId = verificationSessionIdRef.current;
        if (latestSessionId && activeSessionId !== latestSessionId) {
          logger.warn('DriverIdentityVerification', 'Ignoring stale FlowCompleted verification result', {
            staleSessionId: activeSessionId,
            latestSessionId,
            status: verificationResult?.status,
          });
          return;
        }

        if (verificationResult?.verified) {
          logger.info('DriverIdentityVerification', 'Verification completed successfully');
          await persistVerifiedIdentity(activeSessionId, 'flow-completed');
          return;
        }

        const resultStatus = String(verificationResult?.status || '').trim().toLowerCase();
        if (resultStatus === 'canceled' || resultStatus === 'requires_input' || resultStatus === 'pending') {
          setVerificationStatus(resultStatus === 'requires_input' ? 'failed' : 'pending');
          return;
        }

        if (RETRYABLE_VERIFICATION_STATUSES.has(String(verificationResult?.status || '').trim().toLowerCase())) {
          setVerificationStatus('processing');
          return;
        }

        if (verificationResult?.status === 'error') {
          setVerificationStatus('processing');
          return;
        }

        setVerificationStatus('failed');
      };

      void finalizeIdentityVerification();
    } else if (status === 'FlowCanceled') {
      const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
      if (activeSessionId && handledFlowCanceledSessionRef.current === activeSessionId) {
        logger.info('DriverIdentityVerification', 'FlowCanceled already processed for session', {
          sessionId: activeSessionId,
        });
        return;
      }

      if (activeSessionId) {
        handledFlowCanceledSessionRef.current = activeSessionId;
      }

      logger.warn('DriverIdentityVerification', 'Verification flow reported FlowCanceled', {
        sessionId: activeSessionId || null,
      });

      const reconcileCanceledStatus = async () => {
        if (!activeSessionId || !currentUser) {
          setVerificationStatus('canceled');
          return;
        }

        const verificationResult = await fetchVerificationData(activeSessionId, 0, {
          maxRetries: 10,
          retryDelayMs: 4000,
          origin: 'flow-canceled-reconcile',
        });
        const latestSessionId = verificationSessionIdRef.current;
        if (latestSessionId && activeSessionId !== latestSessionId) {
          logger.warn('DriverIdentityVerification', 'Ignoring stale FlowCanceled verification result', {
            staleSessionId: activeSessionId,
            latestSessionId,
            status: verificationResult?.status,
          });
          return;
        }

        if (verificationResult?.verified) {
          await persistVerifiedIdentity(activeSessionId, 'flow-canceled-reconcile');
          return;
        }

        const resultStatus = String(verificationResult?.status || '').trim().toLowerCase();
        if (resultStatus === 'canceled' || resultStatus === 'requires_input' || resultStatus === 'pending') {
          setVerificationStatus(resultStatus === 'requires_input' ? 'failed' : 'pending');
          return;
        }

        if (RETRYABLE_VERIFICATION_STATUSES.has(String(verificationResult?.status || '').trim().toLowerCase())) {
          setVerificationStatus('processing');
          return;
        }

        if (verificationResult?.status === 'error') {
          setVerificationStatus('processing');
          return;
        }

        setVerificationStatus('canceled');
      };

      void reconcileCanceledStatus();
    } else if (status === 'FlowFailed') {
      const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
      if (activeSessionId && handledFlowFailedSessionRef.current === activeSessionId) {
        logger.info('DriverIdentityVerification', 'FlowFailed already processed for session', {
          sessionId: activeSessionId,
        });
        return;
      }

      if (activeSessionId) {
        handledFlowFailedSessionRef.current = activeSessionId;
      }

      logger.warn('DriverIdentityVerification', 'Identity SDK reported FlowFailed, rechecking session status');
      const reconcileFailedStatus = async () => {
        const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
        if (!activeSessionId || !currentUser) {
          setVerificationStatus('failed');
          return;
        }

        const verificationResult = await fetchVerificationData(activeSessionId, 0, {
          maxRetries: 10,
          retryDelayMs: 4000,
          origin: 'flow-failed-reconcile',
        });
        const latestSessionId = verificationSessionIdRef.current;
        if (latestSessionId && activeSessionId !== latestSessionId) {
          logger.warn('DriverIdentityVerification', 'Ignoring stale FlowFailed verification result', {
            staleSessionId: activeSessionId,
            latestSessionId,
            status: verificationResult?.status,
          });
          return;
        }
        if (verificationResult?.verified) {
          await persistVerifiedIdentity(activeSessionId, 'flow-failed-reconcile');
          return;
        }

        const resultStatus = String(verificationResult?.status || '').trim().toLowerCase();
        if (resultStatus === 'canceled' || resultStatus === 'requires_input' || resultStatus === 'pending') {
          setVerificationStatus(resultStatus === 'requires_input' ? 'failed' : 'pending');
          return;
        }

        if (RETRYABLE_VERIFICATION_STATUSES.has(String(verificationResult?.status || '').trim().toLowerCase())) {
          setVerificationStatus('processing');
          return;
        }

        if (verificationResult?.status === 'error') {
          setVerificationStatus('processing');
          return;
        }

        setVerificationStatus('failed');
      };

      void reconcileFailedStatus();
    }
    // fetchVerificationData remains non-memoized to preserve recursive retry behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, verificationSessionId, currentUser, refreshProfile]);

  useEffect(() => {
    if (verificationStatus !== 'processing') {
      return undefined;
    }

    let isUnmounted = false;
    const pollStatus = async () => {
      const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
      if (!activeSessionId || !currentUser) {
        return;
      }

      const result = await fetchVerificationData(activeSessionId, 0, {
        maxRetries: 1,
        retryDelayMs: 3000,
        suppressLoader: true,
        origin: 'processing-poll',
      });

      if (isUnmounted) {
        return;
      }

      if (result?.verified) {
        await persistVerifiedIdentity(activeSessionId, 'processing-poll');
        return;
      }

      const resultStatus = String(result?.status || '').trim().toLowerCase();
      if (resultStatus === 'canceled' || resultStatus === 'requires_input' || resultStatus === 'pending') {
        setVerificationStatus(resultStatus === 'requires_input' ? 'failed' : 'pending');
        return;
      }

      if (resultStatus && !RETRYABLE_VERIFICATION_STATUSES.has(resultStatus) && resultStatus !== 'error') {
        setVerificationStatus('failed');
      }
    };

    const intervalId = setInterval(() => {
      void pollStatus();
      if (typeof refreshProfile === 'function') {
        void refreshProfile().catch((refreshError) => {
          logger.warn('DriverIdentityVerification', 'Failed to refresh profile during status polling', refreshError);
        });
      }
    }, 8000);
    void pollStatus();

    return () => {
      isUnmounted = true;
      clearInterval(intervalId);
    };
    // fetchVerificationData remains non-memoized to preserve recursive retry behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationStatus, verificationSessionId, currentUser, refreshProfile]);

  useEffect(() => {
    if (!identityError) {
      return;
    }

    logger.error('DriverIdentityVerification', 'Stripe Identity native error', identityError);
    Alert.alert(
      'Verification Error',
      identityError?.message || 'Unable to open Stripe verification flow.'
    );
  }, [identityError]);

  return {
    verificationSessionId,
    verificationStatus,
    setVerificationStatus,
    isLoadingVerificationData,
    isCheckingVerificationStatus,
    verificationDataPopulated,
    setVerificationDataPopulated,
    present: startIdentityVerification,
    hydrateVerifiedIdentityFromProfile,
    checkVerificationStatusNow,
    identityLoading,
  };
}
