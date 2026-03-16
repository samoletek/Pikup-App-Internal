import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { submitClaimRequest } from '../../services/ClaimsService';
import { logFlowError, logFlowInfo, startFlowContext } from '../../services/flowContext';

const DEFAULT_CLAIM_TYPE = 'DAMAGED_GOODS';

export default function useClaimFlowController({
  currentUser,
  loadClaimsData,
  selectedDocuments,
  clearDocuments,
}) {
  const [claimFlowVisible, setClaimFlowVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimType, setClaimType] = useState(DEFAULT_CLAIM_TYPE);
  const [showInsuranceInfo, setShowInsuranceInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetClaimDraft = useCallback(() => {
    setSelectedTrip(null);
    setClaimDescription('');
    setClaimType(DEFAULT_CLAIM_TYPE);
    clearDocuments();
  }, [clearDocuments]);

  const handleStartClaim = useCallback(() => {
    resetClaimDraft();
    setClaimFlowVisible(true);
  }, [resetClaimDraft]);

  const handleSelectTrip = useCallback((trip) => {
    if (!trip?.bookingId) {
      Alert.alert('Error', 'This delivery does not have insurance details.');
      return false;
    }

    setSelectedTrip(trip);
    return true;
  }, []);

  const handleCloseClaimFlow = useCallback(() => {
    setClaimFlowVisible(false);
    resetClaimDraft();
  }, [resetClaimDraft]);

  const handleSubmitClaim = useCallback(async () => {
    const flowContext = startFlowContext('claims.submit', {
      userId: currentUser?.id || currentUser?.uid || null,
      hasDocuments: selectedDocuments.length > 0,
      claimType,
    });
    if (!claimDescription.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    if (!selectedTrip) {
      Alert.alert('Error', 'No trip selected');
      return;
    }

    setSubmitting(true);

    try {
      logFlowInfo('ClaimFlowController', 'claim submission started', flowContext);
      const result = await submitClaimRequest({
        selectedTrip,
        claimType,
        claimDescription,
        currentUser,
        selectedDocuments,
      });

      if (!result.success) {
        logFlowError(
          'ClaimFlowController',
          'claim submission failed',
          result?.error || 'Unknown claim error',
          flowContext,
          'Claim submission failed'
        );
        Alert.alert('Error', result.error || 'Failed to submit claim. Please try again.');
        return;
      }

      setClaimFlowVisible(false);
      resetClaimDraft();

      await loadClaimsData();
      logFlowInfo('ClaimFlowController', 'claim submission succeeded', flowContext);
      Alert.alert('Claim Submitted', 'Your claim has been submitted successfully.', [{ text: 'OK' }]);
    } catch (error) {
      logFlowError(
        'ClaimFlowController',
        'claim submission failed unexpectedly',
        error,
        flowContext,
        'Claim submission failed'
      );
      Alert.alert('Error', 'Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    claimDescription,
    claimType,
    currentUser,
    loadClaimsData,
    resetClaimDraft,
    selectedDocuments,
    selectedTrip,
  ]);

  return {
    claimDescription,
    claimFlowVisible,
    claimType,
    selectedTrip,
    showInsuranceInfo,
    submitting,
    setClaimDescription,
    setClaimType,
    setShowInsuranceInfo,
    handleCloseClaimFlow,
    handleSelectTrip,
    handleStartClaim,
    handleSubmitClaim,
  };
}
