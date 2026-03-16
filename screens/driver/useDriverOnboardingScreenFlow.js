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
  currentUser,
  updateDriverPaymentProfile,
  createDriverConnectAccount,
  getDriverOnboardingLink,
}) {
  const userId = currentUser?.uid || currentUser?.id;
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const {
    verificationStatus,
    setVerificationStatus,
    isLoadingVerificationData,
    verificationDataPopulated,
    setVerificationDataPopulated,
    present,
    identityLoading,
  } = useDriverIdentityVerification({
    currentUser,
    setFormData,
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

  useOnboardingDraftPersistence({
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
    if (currentStep > 1 && verificationStatus !== "completed") {
      setCurrentStep(1);
      progressAnim.setValue(1 / (steps.length - 1));
    }
  }, [currentStep, progressAnim, verificationStatus]);

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
    vinPhotoUri,
    carPhotoUris,
    vehicleVerificationStatus,
    createDriverConnectAccount,
    getDriverOnboardingLink,
    updateDriverPaymentProfile,
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
    isNextDisabled,
    isVideoPlaying,
    loading,
    nextButtonLabel,
    openSupport,
    openWebsite,
    present,
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
    verificationDataPopulated,
    verificationStatus,
    videoRef,
    videoWatched,
    vinPhotoUri,
  };
}
