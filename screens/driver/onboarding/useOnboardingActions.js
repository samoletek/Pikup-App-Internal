import { useCallback, useMemo } from 'react';
import { Alert, Animated, Linking } from 'react-native';
import { animation } from '../../../styles/theme';
import { saveVehicleData } from '../../../services/VehicleVerificationService';
import { logger } from '../../../services/logger';

export default function useOnboardingActions({
  currentStep,
  setCurrentStep,
  steps,
  progressAnim,
  navigation,
  currentUser,
  formData,
  videoWatched,
  verificationStatus,
  verificationDataPopulated,
  vinPhotoUri,
  carPhotoUris,
  vehicleVerificationStatus,
  createDriverConnectAccount,
  getDriverOnboardingLink,
  loading,
  setLoading,
}) {
  const isIdentityVerificationCompleted =
    verificationStatus === 'completed' &&
    verificationDataPopulated;
  const isIdentityVerificationRejected = verificationStatus === 'failed';

  const validateStep = useCallback(() => {
    const normalizedVehicleVin = String(formData.vehicleInfo.vin || '').trim();
    const normalizedVehicleMake = String(formData.vehicleInfo.make || '').trim();
    const normalizedVehicleModel = String(formData.vehicleInfo.model || '').trim();
    const normalizedVehicleYear = String(formData.vehicleInfo.year || '').trim();
    const normalizedVehiclePlate = String(formData.vehicleInfo.licensePlate || '').trim();
    const hasVehiclePhotoEvidence =
      vehicleVerificationStatus === 'approved'
        ? true
        : !!vinPhotoUri && carPhotoUris.some(Boolean);

    switch (currentStep) {
      case 1:
        return isIdentityVerificationCompleted;
      case 2:
        return (
          formData.firstName.length >= 2 &&
          formData.lastName.length >= 2 &&
          formData.phoneNumber.length >= 14 &&
          formData.dateOfBirth.length === 10
        );
      case 3:
        return (
          formData.address.line1.length > 5 &&
          formData.address.city.length > 2 &&
          formData.address.state &&
          formData.address.postalCode.length === 5
        );
      case 0:
        return videoWatched;
      case 4:
        return (
          hasVehiclePhotoEvidence &&
          vehicleVerificationStatus === 'approved' &&
          normalizedVehicleVin.length === 17 &&
          normalizedVehicleMake.length >= 1 &&
          normalizedVehicleModel.length >= 1 &&
          normalizedVehicleYear.length === 4 &&
          normalizedVehiclePlate.length >= 2
        );
      default:
        return true;
    }
  }, [
    carPhotoUris,
    currentStep,
    formData,
    isIdentityVerificationCompleted,
    vehicleVerificationStatus,
    videoWatched,
    vinPhotoUri,
  ]);

  const handleCreateConnectAccount = useCallback(async () => {
    setLoading(true);
    try {
      const driverId = currentUser?.uid || currentUser?.id;
      if (!driverId) {
        throw new Error('User not authenticated');
      }

      const createResult = await createDriverConnectAccount?.({
        driverId,
        email: currentUser?.email,
      });

      if (!createResult?.success || !createResult?.connectAccountId) {
        throw new Error(createResult?.error || 'Failed to create Stripe Connect account');
      }

      const connectAccountId = createResult.connectAccountId;
      const onboardingResult = createResult.onboardingUrl
        ? {
          success: true,
          onboardingUrl: createResult.onboardingUrl,
          connectAccountId,
        }
        : await getDriverOnboardingLink?.(connectAccountId);

      if (!onboardingResult?.success || !onboardingResult?.onboardingUrl) {
        throw new Error(onboardingResult?.error || 'Failed to get onboarding link');
      }

      await Linking.openURL(onboardingResult.onboardingUrl);

      navigation.navigate('DriverOnboardingCompleteScreen', {
        connectAccountId: onboardingResult.connectAccountId || connectAccountId,
      });
    } catch (error) {
      logger.error('OnboardingActions', 'Error in onboarding', error);
      Alert.alert(
        'Onboarding Error',
        error?.message || 'Failed to start Stripe onboarding. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    createDriverConnectAccount,
    currentUser?.email,
    currentUser?.id,
    currentUser?.uid,
    getDriverOnboardingLink,
    navigation,
    setLoading,
  ]);

  const handleNext = useCallback(async () => {
    if (!validateStep()) {
      if (currentStep === 0) {
        Alert.alert('Watch the Video', 'Please watch the onboarding video before continuing.');
      } else if (currentStep === 1) {
        if (verificationStatus === 'failed') {
          Alert.alert(
            'Onboarding Declined',
            'Identity verification was not approved. Contact support or visit pikup-app.com.'
          );
        } else if (verificationStatus === 'completed' && !verificationDataPopulated) {
          Alert.alert(
            'Loading Verified Information',
            'We are still loading your verified details from Stripe. This step unlocks automatically once data is ready.'
          );
        } else if (verificationStatus === 'processing') {
          Alert.alert(
            'Verification In Review',
            'Stripe is reviewing your ID submission. This step unlocks automatically after approval.'
          );
        } else {
          Alert.alert('Identity Verification Required', 'Please complete identity verification to continue.');
        }
      } else if (currentStep === 4 && vehicleVerificationStatus !== 'approved') {
        Alert.alert(
          'Vehicle Verification Required',
          'Verify your VIN and vehicle photos first. This step unlocks only after successful vehicle verification.'
        );
      } else {
        Alert.alert('Missing Information', 'Please fill in all required fields correctly.');
      }
      return;
    }

    if (currentStep === 4) {
      try {
        const driverId = currentUser?.uid || currentUser?.id;
        await saveVehicleData(driverId, {
          color: formData.vehicleInfo.color,
          licensePlate: formData.vehicleInfo.licensePlate,
        });
      } catch (error) {
        logger.error('OnboardingActions', 'Error saving vehicle data', error);
      }
    }

    if (currentStep === steps.length - 1) {
      await handleCreateConnectAccount();
      return;
    }

    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / (steps.length - 1),
      duration: animation.normal,
      useNativeDriver: false,
    }).start();
    setCurrentStep(currentStep + 1);
  }, [
    currentStep,
    currentUser?.id,
    currentUser?.uid,
    formData.vehicleInfo.color,
    formData.vehicleInfo.licensePlate,
    handleCreateConnectAccount,
    progressAnim,
    setCurrentStep,
    steps.length,
    validateStep,
    verificationDataPopulated,
    verificationStatus,
    vehicleVerificationStatus,
  ]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      Animated.timing(progressAnim, {
        toValue: (currentStep - 1) / (steps.length - 1),
        duration: animation.normal,
        useNativeDriver: false,
      }).start();

      setCurrentStep(currentStep - 1);
      return;
    }

    navigation.goBack();
  }, [currentStep, navigation, progressAnim, setCurrentStep, steps.length]);

  const nextButtonState = useMemo(() => {
    const isIdentityStep = currentStep === 1;
    const isBlockedByIdentity = isIdentityStep && !isIdentityVerificationCompleted;
    const isIdentityInReview = isIdentityStep && verificationStatus === 'processing';
    const isIdentityDataHydrating = (
      isIdentityStep &&
      verificationStatus === 'completed' &&
      !verificationDataPopulated
    );
    const isNextDisabled = loading || (currentStep === 0 && !videoWatched) || isBlockedByIdentity;
    const nextButtonLabel = loading
      ? 'Setting up...'
      : isIdentityStep && isIdentityVerificationRejected
        ? 'Try Again'
        : isIdentityDataHydrating
          ? 'Loading Verified Information'
        : isIdentityInReview
          ? 'Verification In Review'
        : isBlockedByIdentity
          ? 'Complete Verification'
          : currentStep === steps.length - 1
            ? 'Complete Setup'
            : 'Continue';

    return {
      isNextDisabled,
      nextButtonLabel,
      isIdentityVerificationCompleted,
      isIdentityVerificationRejected,
    };
  }, [
    currentStep,
    isIdentityVerificationCompleted,
    isIdentityVerificationRejected,
    loading,
    steps.length,
    verificationDataPopulated,
    verificationStatus,
    videoWatched,
  ]);

  return {
    handleNext,
    handlePrevious,
    validateStep,
    ...nextButtonState,
  };
}
