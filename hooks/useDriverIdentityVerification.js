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

export default function useDriverIdentityVerification({ currentUser, setFormData }) {
  const [verificationSessionId, setVerificationSessionId] = useState(null);
  const verificationSessionIdRef = useRef(null);
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [isLoadingVerificationData, setIsLoadingVerificationData] = useState(false);
  const [verificationDataPopulated, setVerificationDataPopulated] = useState(false);

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

  const fetchVerificationData = async (sessionId, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000;
    const RETRYABLE_STATUSES = new Set(['processing', 'requires_input']);

    try {
      setIsLoadingVerificationData(true);

      let data = null;
      try {
        data = await getVerificationData(sessionId);
      } catch (error) {
        logger.error('DriverIdentityVerification', 'Error fetching verification data', error);
        let errorStatus = null;
        const response = error?.context;
        if (response) {
          try {
            let errorPayload = null;
            if (typeof response.clone === 'function') {
              errorPayload = await response.clone().json();
            } else if (typeof response.json === 'function') {
              errorPayload = await response.json();
            }
            errorStatus = errorPayload?.status || null;
          } catch (parseError) {
            logger.error('DriverIdentityVerification', 'Failed to parse verification error payload', parseError);
          }
        }
        setIsLoadingVerificationData(false);
        return { verified: false, status: errorStatus || 'error' };
      }

      if (RETRYABLE_STATUSES.has(data?.status) && retryCount < MAX_RETRIES) {
        logger.info('DriverIdentityVerification', 'Verification processing, retrying', {
          status: data?.status,
          retryInSeconds: RETRY_DELAY / 1000,
          attempt: retryCount + 1,
          maxRetries: MAX_RETRIES,
        });
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return fetchVerificationData(sessionId, retryCount + 1);
      }

      if (RETRYABLE_STATUSES.has(data?.status)) {
        setIsLoadingVerificationData(false);
        return { verified: false, status: data.status };
      }

      if (data?.status && data.status !== 'verified') {
        setIsLoadingVerificationData(false);
        return { verified: false, status: data.status };
      }

      if (!data || data.error) {
        logger.info('DriverIdentityVerification', 'Verification data not available');
        setIsLoadingVerificationData(false);
        return { verified: false, status: 'error' };
      }

      setFormData((prev) => {
        const updated = { ...prev };

        if (data.firstName && !prev.firstName) updated.firstName = data.firstName;
        if (data.lastName && !prev.lastName) updated.lastName = data.lastName;
        if (data.dob && !prev.dateOfBirth) {
          const month = String(data.dob.month).padStart(2, '0');
          const day = String(data.dob.day).padStart(2, '0');
          const year = String(data.dob.year);
          updated.dateOfBirth = `${month}/${day}/${year}`;
        }

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

      setVerificationDataPopulated(true);
      setIsLoadingVerificationData(false);
      return { verified: true, status: 'verified' };
    } catch (error) {
      logger.error('DriverIdentityVerification', 'Failed to fetch verification data', error);
      setIsLoadingVerificationData(false);
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

  useEffect(() => {
    logger.info('DriverIdentityVerification', 'Stripe Identity status changed', { status });

    if (status === 'FlowCompleted') {
      const finalizeIdentityVerification = async () => {
        const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
        if (!activeSessionId || !currentUser) {
          setVerificationStatus('failed');
          return;
        }

        const verificationResult = await fetchVerificationData(activeSessionId);
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
          setVerificationStatus('completed');

          markDriverIdentityVerified({
            currentUser,
            verificationSessionId: activeSessionId,
          })
            .then(() => {
              logger.info('DriverIdentityVerification', 'Driver verification status saved to DB');
            })
            .catch((error) => {
              logger.error('DriverIdentityVerification', 'Failed to update driver verification status', error);
            });
          return;
        }

        if (verificationResult?.status === 'processing' || verificationResult?.status === 'requires_input') {
          setVerificationStatus('pending');
          Alert.alert(
            'Verification In Progress',
            'We are still reviewing your ID. Please wait a moment and try again.'
          );
          return;
        }

        if (verificationResult?.status === 'error') {
          setVerificationStatus('pending');
          Alert.alert(
            'Verification Check Delayed',
            'We could not confirm verification status yet. Please try again in a moment.'
          );
          return;
        }

        setVerificationStatus('failed');
        Alert.alert(
          'Verification Failed',
          'Your identity verification was not approved. Contact support or visit pikup-app.com.'
        );
      };

      void finalizeIdentityVerification();
    } else if (status === 'FlowCanceled') {
      logger.warn('DriverIdentityVerification', 'Verification was canceled by user');
      setVerificationStatus('canceled');
    } else if (status === 'FlowFailed') {
      logger.warn('DriverIdentityVerification', 'Identity SDK reported FlowFailed, rechecking session status');
      const reconcileFailedStatus = async () => {
        const activeSessionId = verificationSessionIdRef.current || verificationSessionId;
        if (!activeSessionId || !currentUser) {
          setVerificationStatus('failed');
          Alert.alert(
            'Verification Failed',
            'Your identity verification was not approved. Contact support or visit pikup-app.com.'
          );
          return;
        }

        const verificationResult = await fetchVerificationData(activeSessionId);
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
          setVerificationStatus('completed');
          markDriverIdentityVerified({
            currentUser,
            verificationSessionId: activeSessionId,
          })
            .then(() => {
              logger.info('DriverIdentityVerification', 'Driver verification status reconciled after FlowFailed');
            })
            .catch((error) => {
              logger.error('DriverIdentityVerification', 'Failed to persist reconciled verification status', error);
            });
          return;
        }

        if (verificationResult?.status === 'processing' || verificationResult?.status === 'requires_input') {
          setVerificationStatus('pending');
          Alert.alert(
            'Verification In Progress',
            'We are still reviewing your ID. Please wait a moment and try again.'
          );
          return;
        }

        if (verificationResult?.status === 'error') {
          setVerificationStatus('pending');
          Alert.alert(
            'Verification Check Delayed',
            'We could not confirm verification status yet. Please try again in a moment.'
          );
          return;
        }

        setVerificationStatus('failed');
        Alert.alert(
          'Verification Failed',
          'Your identity verification was not approved. Contact support or visit pikup-app.com.'
        );
      };

      void reconcileFailedStatus();
    }
    // fetchVerificationData remains non-memoized to preserve recursive retry behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, verificationSessionId, currentUser]);

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
    verificationDataPopulated,
    setVerificationDataPopulated,
    present: startIdentityVerification,
    identityLoading,
  };
}
