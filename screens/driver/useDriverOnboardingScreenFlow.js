import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking } from "react-native";
import useDriverIdentityVerification from "../../hooks/useDriverIdentityVerification";
import {
  WEBSITE_URL,
  initialFormData,
  steps,
} from "./DriverOnboardingScreen.constants";
import useAddressSearch from "./onboarding/useAddressSearch";
import useVehicleVerificationFlow from "./onboarding/useVehicleVerificationFlow";
import useOnboardingVideoState from "./onboarding/useOnboardingVideoState";
import useOnboardingDraftPersistence from "./onboarding/useOnboardingDraftPersistence";
import useOnboardingActions from "./onboarding/useOnboardingActions";
import { logger } from "../../services/logger";

export default function useDriverOnboardingScreenFlow({
  navigation,
  route,
  currentUser,
  refreshProfile,
  updateDriverPaymentProfile,
  createDriverConnectAccount,
  getDriverOnboardingLink,
}) {
  const userId = currentUser?.uid || currentUser?.id;
  const forceIdentityStep = Boolean(route?.params?.forceIdentityStep);
  const forcePaymentSetupStep = Boolean(
    route?.params?.forcePaymentSetupStep ||
    currentUser?.metadata?.onboardingDebugForcePaymentSetupStep
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [hasForcedIdentityStepApplied, setHasForcedIdentityStepApplied] = useState(!forceIdentityStep);
  const [hasForcedPaymentSetupStepApplied, setHasForcedPaymentSetupStepApplied] = useState(!forcePaymentSetupStep);
  const forceIdentityAppliedRef = useRef(false);
  const forcePaymentSetupAppliedRef = useRef(false);

  const {
    verificationStatus,
    setVerificationStatus,
    isLoadingVerificationData,
    isCheckingVerificationStatus,
    verificationDataPopulated,
    setVerificationDataPopulated,
    present,
    checkVerificationStatusNow,
    identityLoading,
  } = useDriverIdentityVerification({
    currentUser,
    setFormData,
    refreshProfile,
  });

  const updateFormData = useCallback((field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prevFormData) => ({
        ...prevFormData,
        [parent]: {
          ...prevFormData[parent],
          [child]: value,
        },
      }));
      return;
    }

    setFormData((prevFormData) => ({
      ...prevFormData,
      [field]: value,
    }));
  }, []);

  const videoRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const {
    vinPhotoUri,
    setVinPhotoUri,
    carPhotoUris,
    setCarPhotoUris,
    vehicleVerificationStatus,
    setVehicleVerificationStatus,
    vehicleVerificationResult,
    vehicleVerificationError,
    takeVinPhoto,
    takeCarPhoto,
    resetVinPhoto,
    resetCarPhoto,
    showVinHintAlert,
    showVehiclePhotoHintAlert,
    handleVerifyVehicle,
  } = useVehicleVerificationFlow({
    currentUser,
    setFormData,
  });

  const {
    videoWatched,
    isVideoPlaying,
    handleVideoPlaybackStatus,
    toggleVideoPlayback,
  } = useOnboardingVideoState({
    userId,
    videoRef,
  });

  const {
    showStatePicker,
    setShowStatePicker,
    addressSuggestions,
    isLoadingAddress,
    statePickerRef,
    searchAddress,
    handleAddressSelect,
    closeStatePicker,
  } = useAddressSearch({
    updateFormData,
  });

  const { isDraftHydrated } = useOnboardingDraftPersistence({
    userId,
    currentStep,
    verificationStatus,
    verificationDataPopulated,
    vehicleVerificationStatus,
    vinPhotoUri,
    carPhotoUris,
    formData,
    progressAnim,
    stepsLength: steps.length,
    updateDriverPaymentProfile,
    setCurrentStep,
    setVerificationStatus,
    setFormData,
    setVerificationDataPopulated,
    setVehicleVerificationStatus,
    setVinPhotoUri,
    setCarPhotoUris,
  });

  useEffect(() => {
    if (!forceIdentityStep) {
      setHasForcedIdentityStepApplied(true);
      return;
    }

    if (!isDraftHydrated || forceIdentityAppliedRef.current) {
      return;
    }

    forceIdentityAppliedRef.current = true;
    setCurrentStep(1);
    progressAnim.setValue(1 / (steps.length - 1));
    setVerificationStatus('pending');
    setHasForcedIdentityStepApplied(true);
  }, [forceIdentityStep, isDraftHydrated, progressAnim, setCurrentStep, setVerificationStatus]);

  useEffect(() => {
    if (!forcePaymentSetupStep) {
      setHasForcedPaymentSetupStepApplied(true);
      return;
    }

    if (!isDraftHydrated || forcePaymentSetupAppliedRef.current) {
      return;
    }

    forcePaymentSetupAppliedRef.current = true;
    setVerificationStatus('completed');
    setCurrentStep(steps.length - 1);
    progressAnim.setValue(1);
    setHasForcedPaymentSetupStepApplied(true);
  }, [
    forcePaymentSetupStep,
    isDraftHydrated,
    progressAnim,
    setCurrentStep,
    setVerificationStatus,
  ]);

  const openWebsite = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(WEBSITE_URL);
      if (!supported) {
        throw new Error("Website URL is not supported");
      }
      await Linking.openURL(WEBSITE_URL);
    } catch (error) {
      logger.error("DriverOnboardingScreenFlow", "Failed to open website URL", error);
      Alert.alert(
        "Unable to Open Website",
        "Please open pikup-app.com in your browser."
      );
    }
  }, []);

  const openSupport = useCallback(() => {
    navigation.navigate("CustomerHelpScreen");
  }, [navigation]);

  useEffect(() => {
    if (
      currentStep > 1 &&
      (verificationStatus !== "completed" || !verificationDataPopulated)
    ) {
      setCurrentStep(1);
      progressAnim.setValue(1 / (steps.length - 1));
    }
  }, [currentStep, progressAnim, verificationDataPopulated, verificationStatus]);

  useEffect(() => {
    if (forceIdentityStep || !isDraftHydrated) {
      return;
    }

    if (
      currentStep === 1 &&
      verificationStatus === "completed" &&
      verificationDataPopulated
    ) {
      setCurrentStep(2);
      progressAnim.setValue(2 / (steps.length - 1));
    }
  }, [
    currentStep,
    forceIdentityStep,
    isDraftHydrated,
    progressAnim,
    setCurrentStep,
    verificationDataPopulated,
    verificationStatus,
  ]);

  const previousVerificationStatusRef = useRef(verificationStatus);
  useEffect(() => {
    const previousStatus = previousVerificationStatusRef.current;
    const hasJustCompletedVerification =
      previousStatus !== "completed" && verificationStatus === "completed";

    if (
      hasJustCompletedVerification &&
      currentStep === 1 &&
      verificationDataPopulated
    ) {
      Animated.timing(progressAnim, {
        toValue: 2 / (steps.length - 1),
        duration: 300,
        useNativeDriver: false,
      }).start();
      setCurrentStep(2);
    }

    previousVerificationStatusRef.current = verificationStatus;
  }, [currentStep, progressAnim, setCurrentStep, verificationDataPopulated, verificationStatus]);

  const {
    handleNext,
    handlePrevious,
    isNextDisabled,
    nextButtonLabel,
    isIdentityVerificationRejected,
  } = useOnboardingActions({
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
  });

  return {
    addressSuggestions,
    carPhotoUris,
    closeStatePicker,
    currentStep,
    formData,
    handleAddressSelect,
    handleNext,
    handlePrevious,
    handleVerifyVehicle,
    handleVideoPlaybackStatus,
    identityLoading,
    isIdentityVerificationRejected,
    isLoadingAddress,
    isLoadingVerificationData,
    isCheckingVerificationStatus,
    isNextDisabled,
    isVideoPlaying,
    loading,
    nextButtonLabel,
    openSupport,
    openWebsite,
    present,
    checkVerificationStatusNow,
    progressAnim,
    resetCarPhoto,
    resetVinPhoto,
    screenSteps: steps,
    searchAddress,
    setShowStatePicker,
    showStatePicker,
    showVehiclePhotoHintAlert,
    showVinHintAlert,
    statePickerRef,
    takeCarPhoto,
    takeVinPhoto,
    toggleVideoPlayback,
    updateFormData,
    vehicleVerificationError,
    vehicleVerificationResult,
    vehicleVerificationStatus,
    hasForcedIdentityStepApplied,
    hasForcedPaymentSetupStepApplied,
    isDraftHydrated,
    verificationDataPopulated,
    verificationStatus,
    videoRef,
    videoWatched,
    vinPhotoUri,
  };
}
